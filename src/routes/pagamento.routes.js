const { createHmac, randomUUID, timingSafeEqual } = require("node:crypto");
const express = require("express");
const db = require("../db");
const { appUrl, mercadoPagoAccessToken, mercadoPagoWebhookSecret } = require("../config");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const paymentApi = "https://api.mercadopago.com";

router.post("/checkout", requireAuth, async (req, res) => {
  if (!mercadoPagoAccessToken || !appUrl || !mercadoPagoWebhookSecret) {
    return res.status(503).json({
      erro: "Configure o Mercado Pago, APP_URL e o segredo do webhook para habilitar pagamentos.",
    });
  }

  const paymentMethod = req.body.forma_pagamento;
  const itemIds = [...new Set(
    (Array.isArray(req.body.itens) ? req.body.itens : []).map(Number),
  )];
  if (
    !itemIds.length ||
    itemIds.some((id) => !Number.isSafeInteger(id) || id < 1) ||
    !["pix", "cartao"].includes(paymentMethod)
  ) {
    return res.status(400).json({ erro: "Selecione os quadros e uma forma de pagamento valida." });
  }

  const placeholders = itemIds.map(() => "?").join(",");
  const items = db.prepare(`
    SELECT id_quadro, titulo, tamanho, preco_u
    FROM Quadro WHERE id_quadro IN (${placeholders})
  `).all(...itemIds);
  if (items.length !== itemIds.length) {
    return res.status(404).json({ erro: "Um ou mais quadros nao foram encontrados." });
  }
  if (items.some((item) => !Number.isFinite(item.preco_u) || item.preco_u <= 0)) {
    return res.status(400).json({ erro: "Ha quadro sem preco cadastrado. Fale com o atelie." });
  }

  const reference = randomUUID();
  const expectedDate = new Date(Date.now() + 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const pendingStatus = db
    .prepare("SELECT id_status FROM Status WHERE descricao_status = ?")
    .get("Aguardando pagamento");
  const paymentInsert = db.prepare(`
    INSERT INTO Pagamento (referencia_externa, forma_pagamento, id_cli)
    VALUES (?, ?, ?)
  `);
  const orderInsert = db.prepare(`
    INSERT INTO Pedido (id_qua, id_status, id_cli, previsao_entrega)
    VALUES (?, ?, ?, ?)
  `);
  const linkInsert = db.prepare(
    "INSERT INTO Pagamento_Pedido (id_pagamento, id_ped) VALUES (?, ?)",
  );

  try {
    db.exec("BEGIN");
    const payment = paymentInsert.run(reference, paymentMethod, req.user.id);
    for (const item of items) {
      const order = orderInsert.run(
        item.id_quadro,
        pendingStatus.id_status,
        req.user.id,
        expectedDate,
      );
      linkInsert.run(payment.lastInsertRowid, order.lastInsertRowid);
    }

    const excludedTypes = paymentMethod === "pix"
      ? ["credit_card", "debit_card", "ticket", "atm"]
      : ["bank_transfer", "ticket", "atm"];
    const siteUrl = appUrl.replace(/\/$/, "");
    const preferenceResponse = await fetch(`${paymentApi}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mercadoPagoAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: items.map((item) => ({
          id: String(item.id_quadro),
          title: item.titulo,
          description: item.tamanho || "Quadro original Pinturas da Sophi",
          quantity: 1,
          currency_id: "BRL",
          unit_price: item.preco_u,
        })),
        payer: { email: req.user.email },
        external_reference: reference,
        notification_url: `${siteUrl}/api/pagamentos/webhook`,
        back_urls: {
          success: `${siteUrl}/#cart?pagamento=sucesso`,
          pending: `${siteUrl}/#cart?pagamento=pendente`,
          failure: `${siteUrl}/#cart?pagamento=falhou`,
        },
        auto_return: "approved",
        payment_methods: {
          excluded_payment_types: excludedTypes.map((id) => ({ id })),
        },
      }),
    });
    const preference = await preferenceResponse.json();
    if (!preferenceResponse.ok || !preference.init_point) {
      throw new Error(preference.message || "O Mercado Pago nao criou o checkout.");
    }

    db.prepare("UPDATE Pagamento SET preference_id = ? WHERE id_pagamento = ?")
      .run(preference.id, payment.lastInsertRowid);
    db.exec("COMMIT");
    return res.status(201).json({ checkout_url: preference.init_point, referencia: reference });
  } catch (error) {
    db.exec("ROLLBACK");
    return res.status(502).json({ erro: error.message || "Nao foi possivel iniciar o pagamento." });
  }
});

router.post("/webhook", async (req, res) => {
  if (!mercadoPagoAccessToken || !mercadoPagoWebhookSecret) {
    return res.status(503).json({ erro: "Webhook de pagamento nao configurado." });
  }

  const dataId = String(req.query["data.id"] || req.body?.data?.id || "").toLowerCase();
  const requestId = req.get("x-request-id") || "";
  const signature = Object.fromEntries(
    (req.get("x-signature") || "").split(",").map((part) => part.trim().split("=")),
  );
  if (!dataId || !requestId || !signature.ts || !signature.v1) {
    return res.status(401).json({ erro: "Assinatura do webhook invalida." });
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${signature.ts};`;
  const expectedSignature = createHmac("sha256", mercadoPagoWebhookSecret)
    .update(manifest)
    .digest();
  let receivedSignature;
  try {
    receivedSignature = Buffer.from(signature.v1, "hex");
  } catch {
    return res.status(401).json({ erro: "Assinatura do webhook invalida." });
  }
  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    return res.status(401).json({ erro: "Assinatura do webhook invalida." });
  }

  try {
    const paymentResponse = await fetch(`${paymentApi}/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${mercadoPagoAccessToken}` },
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok || !payment.external_reference) {
      return res.status(400).json({ erro: "Pagamento nao localizado no Mercado Pago." });
    }

    const localPayment = db.prepare(
      "SELECT id_pagamento FROM Pagamento WHERE referencia_externa = ?",
    ).get(payment.external_reference);
    if (!localPayment) return res.status(404).json({ erro: "Referencia de pedido desconhecida." });

    db.prepare("UPDATE Pagamento SET status_pagamento = ? WHERE id_pagamento = ?")
      .run(payment.status, localPayment.id_pagamento);
    if (["approved", "cancelled", "rejected"].includes(payment.status)) {
      const description = payment.status === "approved"
        ? "Pagamento aprovado"
        : "Cancelado";
      const status = db.prepare(
        "SELECT id_status FROM Status WHERE descricao_status = ?",
      ).get(description);
      db.prepare("UPDATE Pedido SET id_status = ? WHERE id_ped IN (SELECT id_ped FROM Pagamento_Pedido WHERE id_pagamento = ?)")
        .run(status.id_status, localPayment.id_pagamento);
    }
    return res.sendStatus(200);
  } catch {
    return res.status(502).json({ erro: "Nao foi possivel confirmar o pagamento." });
  }
});

module.exports = router;