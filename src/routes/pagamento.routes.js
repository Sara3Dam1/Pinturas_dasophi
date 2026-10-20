const { randomUUID } = require("node:crypto");
const express = require("express");
const Stripe = require("stripe");
const db = require("../db");
const { appUrl, paymentMode, stripeSecretKey, stripeWebhookSecret } = require("../config");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const demoMode = paymentMode === "demo";

router.post("/checkout", requireAuth, async (req, res) => {
  if (!demoMode && (!stripe || !appUrl || !stripeWebhookSecret)) {
    return res.status(503).json({
      erro: "Configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET e APP_URL para habilitar pagamentos.",
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

  const endereco = req.body.endereco || {};
  const address = {
    rua: String(endereco.rua || "").trim(),
    numero_casa: String(endereco.numero_casa || "").trim(),
    bairro: String(endereco.bairro || "").trim(),
    cep: String(endereco.cep || "").replace(/\D/g, ""),
  };
  if (
    !address.rua || address.rua.length > 160 ||
    !address.numero_casa || address.numero_casa.length > 30 ||
    !address.bairro || address.bairro.length > 100 ||
    !/^\d{8}$/.test(address.cep)
  ) {
    return res.status(400).json({ erro: "Confirme rua, numero, bairro e CEP valido antes de pagar." });
  }

  const placeholders = itemIds.map(() => "?").join(",");
  const items = db.prepare(`
    SELECT id_quadro, titulo, tamanho, preco_u
    FROM Quadro WHERE id_quadro IN (${placeholders}) AND disponivel = 1
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
  const approvedStatus = db
    .prepare("SELECT id_status FROM Status WHERE descricao_status = ?")
    .get("Pagamento aprovado");
  const paymentInsert = db.prepare(`
    INSERT INTO Pagamento (referencia_externa, forma_pagamento, id_cli)
    VALUES (?, ?, ?)
  `);
  const orderInsert = db.prepare(`
    INSERT INTO Pedido (
      id_qua, id_status, id_cli, previsao_entrega,
      rua_entrega, numero_casa_entrega, bairro_entrega, cep_entrega
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const linkInsert = db.prepare(
    "INSERT INTO Pagamento_Pedido (id_pagamento, id_ped) VALUES (?, ?)",
  );

  try {
    db.exec("BEGIN");
    const payment = paymentInsert.run(reference, paymentMethod, req.user.id);
    db.prepare(`
      UPDATE Clientes SET rua = ?, numero_casa = ?, bairro = ?, cep = ?
      WHERE Id_Cli = ?
    `).run(address.rua, address.numero_casa, address.bairro, address.cep, req.user.id);
    for (const item of items) {
      const order = orderInsert.run(
        item.id_quadro,
        demoMode ? approvedStatus.id_status : pendingStatus.id_status,
        req.user.id,
        expectedDate,
        address.rua,
        address.numero_casa,
        address.bairro,
        address.cep,
      );
      linkInsert.run(payment.lastInsertRowid, order.lastInsertRowid);
    }

    if (demoMode) {
      db.prepare("UPDATE Pagamento SET status_pagamento = ? WHERE id_pagamento = ?")
        .run("demo", payment.lastInsertRowid);
      db.exec("COMMIT");
      return res.status(201).json({
        checkout_url: `/#cart?pagamento=demo&referencia=${encodeURIComponent(reference)}`,
        referencia: reference,
        modo_demo: true,
      });
    }

    const siteUrl = appUrl.replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "pt-BR",
      customer_email: req.user.email,
      payment_method_types: [paymentMethod === "pix" ? "pix" : "card"],
      line_items: items.map((item) => ({
        price_data: {
          currency: "brl",
          product_data: {
            name: item.titulo,
            description: item.tamanho || "Quadro original Pinturas da Sophi",
          },
          unit_amount: Math.round(item.preco_u * 100),
        },
        quantity: 1,
      })),
      metadata: { referencia_externa: reference },
      success_url: `${siteUrl}/#cart?pagamento=sucesso&referencia=${encodeURIComponent(reference)}`,
      cancel_url: `${siteUrl}/#cart?pagamento=falhou&referencia=${encodeURIComponent(reference)}`,
    });
    if (!session.url) throw new Error("O Stripe nao retornou a URL do checkout.");

    db.prepare("UPDATE Pagamento SET preference_id = ? WHERE id_pagamento = ?")
      .run(session.id, payment.lastInsertRowid);
    db.exec("COMMIT");
    return res.status(201).json({ checkout_url: session.url, referencia: reference });
  } catch (error) {
    db.exec("ROLLBACK");
    return res.status(502).json({ erro: error.message || "Nao foi possivel iniciar o pagamento." });
  }
});

router.get("/status/:reference", requireAuth, (req, res) => {
  const payment = db.prepare(`
    SELECT status_pagamento
    FROM Pagamento
    WHERE referencia_externa = ? AND id_cli = ?
  `).get(req.params.reference, req.user.id);
  if (!payment) return res.status(404).json({ erro: "Pagamento nao encontrado." });
  return res.json({ status_pagamento: payment.status_pagamento });
});

router.post("/webhook", (req, res) => {
  if (!stripe || !stripeWebhookSecret) {
    return res.status(503).json({ erro: "Webhook de pagamento nao configurado." });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.get("stripe-signature"),
      stripeWebhookSecret,
    );
  } catch {
    return res.status(400).json({ erro: "Assinatura do webhook Stripe invalida." });
  }

  const supportedEvents = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
  ];
  if (!supportedEvents.includes(event.type)) return res.sendStatus(200);

  const session = event.data.object;
  const reference = session.metadata?.referencia_externa;
  if (!reference) return res.status(400).json({ erro: "Referencia do pagamento ausente." });

  const localPayment = db.prepare(
    "SELECT id_pagamento FROM Pagamento WHERE referencia_externa = ?",
  ).get(reference);
  if (!localPayment) return res.status(404).json({ erro: "Referencia de pedido desconhecida." });

  let paymentStatus;
  let orderStatus;
  if (
    event.type === "checkout.session.async_payment_succeeded" ||
    (event.type === "checkout.session.completed" && session.payment_status === "paid")
  ) {
    paymentStatus = "succeeded";
    orderStatus = "Pagamento aprovado";
  } else if (event.type === "checkout.session.async_payment_failed") {
    paymentStatus = "failed";
    orderStatus = "Cancelado";
  } else if (event.type === "checkout.session.expired") {
    paymentStatus = "expired";
    orderStatus = "Cancelado";
  } else {
    return res.sendStatus(200);
  }

  db.prepare("UPDATE Pagamento SET status_pagamento = ? WHERE id_pagamento = ?")
    .run(paymentStatus, localPayment.id_pagamento);
  const status = db.prepare(
    "SELECT id_status FROM Status WHERE descricao_status = ?",
  ).get(orderStatus);
  const awaitingPayment = db.prepare(
    "SELECT id_status FROM Status WHERE descricao_status = ?",
  ).get("Aguardando pagamento");
  db.prepare(`
    UPDATE Pedido SET id_status = ?
    WHERE id_ped IN (
      SELECT id_ped FROM Pagamento_Pedido WHERE id_pagamento = ?
    ) AND id_status = ?
  `).run(status.id_status, localPayment.id_pagamento, awaitingPayment.id_status);

  return res.sendStatus(200);
});

module.exports = router;