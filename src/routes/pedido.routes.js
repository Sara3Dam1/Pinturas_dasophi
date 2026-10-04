const express = require("express");
const fs = require("node:fs");
const db = require("../db");
const upload = require("../middleware/upload");
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
    f.avaliacao AS avaliacao_feedback,
    f.comentario AS comentario_feedback,
    f.foto AS foto_feedback,
    p.data_envio,
    p.data_entrega_confirmada
  FROM Pedido p
  JOIN Quadro q ON q.id_quadro = p.id_qua
  JOIN Status s ON s.id_status = p.id_status
  LEFT JOIN Feedback f ON f.id_ped = p.id_ped
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

router.get("/feedbacks", (_req, res) => {
  const feedbacks = db.prepare(`
    SELECT q.titulo, f.avaliacao, f.comentario, f.foto, f.data_pedido
    FROM Feedback f
    JOIN Pedido p ON p.id_ped = f.id_ped
    JOIN Quadro q ON q.id_quadro = p.id_qua
    JOIN Status s ON s.id_status = p.id_status
    WHERE s.descricao_status = 'Entregue'
      AND p.data_entrega_confirmada IS NOT NULL
      AND f.foto IS NOT NULL
    ORDER BY f.data_pedido DESC
  `).all();
  res.json(feedbacks);
});

router.get("/rastrear/:codigo", (req, res) => {
  const order = db
    .prepare(`
      SELECT q.titulo, q.tamanho, q.preco_u, s.descricao_status,
        p.codigo_rastreamento, p.previsao_entrega, p.data_envio
      FROM Pedido p
      JOIN Quadro q ON q.id_quadro = p.id_qua
      JOIN Status s ON s.id_status = p.id_status
      WHERE p.codigo_rastreamento = ?
    `)
    .get(req.params.codigo);

  if (!order) {
    return res.status(404).json({ erro: "Pedido nao encontrado." });
  }

  return res.json(order);
});

router.post("/:id/feedback", requireAuth, upload.single("foto"), (req, res) => {
  const order = db
    .prepare(`
      SELECT p.id_ped, p.data_entrega_confirmada, s.descricao_status
      FROM Pedido p JOIN Status s ON s.id_status = p.id_status
      WHERE p.id_ped = ? AND p.id_cli = ?
    `)
    .get(req.params.id, req.user.id);

  if (!order) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ erro: "Pedido nao encontrado." });
  }

  if (order.descricao_status !== "Entregue" || !order.data_entrega_confirmada) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(409).json({ erro: "Confirme o recebimento do pedido antes de avaliá-lo." });
  }

  const avaliacao = Number(req.body.avaliacao);
  const comentario = String(req.body.comentario || "").trim();
  if (!Number.isInteger(avaliacao) || avaliacao < 1 || avaliacao > 5) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ erro: "A avaliacao deve ser de 1 a 5." });
  }
  if (!comentario || comentario.length > 1000 || !req.file || !req.file.mimetype.startsWith("image/")) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ erro: "Envie uma foto e uma opinião de até 1000 caracteres." });
  }

  db.prepare(
    `
    INSERT INTO Feedback (id_cli, id_ped, avaliacao, comentario, foto)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id_cli, id_ped) DO UPDATE SET
      avaliacao = excluded.avaliacao,
      comentario = excluded.comentario,
      foto = excluded.foto,
      data_pedido = CURRENT_TIMESTAMP
  `,
  ).run(req.user.id, req.params.id, avaliacao, comentario, `/uploads/${req.file.filename}`);

  return res.status(201).json({ mensagem: "Feedback registrado." });
});

router.patch("/:id/confirmar-entrega", requireAuth, (req, res) => {
  const order = db.prepare(`
    SELECT p.id_ped, p.data_entrega_confirmada, s.descricao_status
    FROM Pedido p JOIN Status s ON s.id_status = p.id_status
    WHERE p.id_ped = ? AND p.id_cli = ?
  `).get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ erro: "Pedido nao encontrado." });
  if (order.data_entrega_confirmada) {
    return res.json(db.prepare(`${orderQuery} WHERE p.id_ped = ?`).get(req.params.id));
  }
  if (order.descricao_status !== "Enviado") {
    return res.status(409).json({ erro: "O pedido precisa estar enviado para confirmar o recebimento." });
  }

  const deliveredStatus = db
    .prepare("SELECT id_status FROM Status WHERE descricao_status = ?")
    .get("Entregue");
  db.prepare(`
    UPDATE Pedido
    SET id_status = ?, data_entrega_confirmada = CURRENT_TIMESTAMP
    WHERE id_ped = ? AND id_cli = ?
  `).run(deliveredStatus.id_status, req.params.id, req.user.id);

  return res.json(db.prepare(`${orderQuery} WHERE p.id_ped = ?`).get(req.params.id));
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
