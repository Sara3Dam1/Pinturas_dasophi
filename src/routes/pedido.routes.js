const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");

const router = express.Router();
const orderQuery = `
  SELECT
    p.*,
    q.titulo,
    q.tamanho,
    q.preco_u,
    s.descricao_status,
    p.data_envio
  FROM Pedido p
  JOIN Quadro q ON q.id_quadro = p.id_qua
  JOIN Status s ON s.id_status = p.id_status
`;

router.post("/", requireAuth, (req, res) => {
  return res.status(410).json({
    erro: "Use /api/pagamentos/checkout para criar pedidos com pagamento.",
  });
});

router.get("/", requireAuth, (req, res) => {
  const orders = db
    .prepare(`${orderQuery} WHERE p.id_cli = ? ORDER BY p.data_pedido DESC`)
    .all(req.user.id);

  res.json(orders);
});

router.get("/rastrear/:codigo", (req, res) => {
  const order = db
    .prepare(`${orderQuery} WHERE p.codigo_rastreamento = ?`)
    .get(req.params.codigo);

  if (!order) {
    return res.status(404).json({ erro: "Pedido nao encontrado." });
  }

  return res.json(order);
});

router.post("/:id/feedback", requireAuth, (req, res) => {
  const order = db
    .prepare("SELECT id_ped FROM Pedido WHERE id_ped = ? AND id_cli = ?")
    .get(req.params.id, req.user.id);

  if (!order) {
    return res.status(404).json({ erro: "Pedido nao encontrado." });
  }

  const { avaliacao, comentario } = req.body;
  if (!Number.isInteger(avaliacao) || avaliacao < 1 || avaliacao > 5) {
    return res.status(400).json({ erro: "A avaliacao deve ser de 1 a 5." });
  }

  db.prepare(
    `
    INSERT INTO Feedback (id_cli, id_ped, avaliacao, comentario)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id_cli, id_ped) DO UPDATE SET
      avaliacao = excluded.avaliacao,
      comentario = excluded.comentario,
      data_pedido = CURRENT_TIMESTAMP
  `,
  ).run(req.user.id, req.params.id, avaliacao, comentario || null);

  return res.status(201).json({ mensagem: "Feedback registrado." });
});

router.patch("/:id/envio", requireAdmin, (req, res) => {
  const trackingCode = String(req.body.codigo_rastreamento || "").trim();
  if (!trackingCode) {
    return res.status(400).json({ erro: "Informe o codigo de rastreio dos Correios." });
  }

  const order = db
    .prepare(`${orderQuery} WHERE p.id_ped = ?`)
    .get(req.params.id);
  if (!order) {
    return res.status(404).json({ erro: "Pedido nao encontrado." });
  }
  if (!["Pagamento aprovado", "Em producao"].includes(order.descricao_status)) {
    return res.status(409).json({ erro: "O pedido precisa estar pago antes do envio." });
  }
  const duplicateCode = db
    .prepare("SELECT id_ped FROM Pedido WHERE codigo_rastreamento = ? AND id_ped <> ?")
    .get(trackingCode, req.params.id);
  if (duplicateCode) {
    return res.status(409).json({ erro: "Este codigo de rastreio ja esta vinculado a outro pedido." });
  }

  const sentStatus = db
    .prepare("SELECT id_status FROM Status WHERE descricao_status = ?")
    .get("Enviado");
  const estimatedDelivery = new Date(Date.now() + 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  db.prepare(`
    UPDATE Pedido
    SET id_status = ?, codigo_rastreamento = ?, data_envio = CURRENT_TIMESTAMP,
        previsao_entrega = ?
    WHERE id_ped = ?
  `).run(sentStatus.id_status, trackingCode, estimatedDelivery, req.params.id);

  return res.json(
    db.prepare(`${orderQuery} WHERE p.id_ped = ?`).get(req.params.id),
  );
});

module.exports = router;
