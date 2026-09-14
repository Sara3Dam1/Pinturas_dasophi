const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const orderQuery = `
  SELECT
    p.*,
    q.titulo,
    q.tamanho,
    s.descricao_status
  FROM Pedido p
  JOIN Quadro q ON q.id_quadro = p.id_qua
  JOIN Status_Pedido s ON s.id_status = p.id_status
`;

router.post("/", requireAuth, (req, res) => {
  const quadro = db
    .prepare("SELECT id_quadro FROM Quadro WHERE id_quadro = ?")
    .get(req.body.id_qua);

  if (!quadro) {
    return res.status(404).json({ erro: "Quadro nao encontrado." });
  }

  const codigo = `PS-${Date.now().toString(36).toUpperCase()}`;
  const previsao = new Date(Date.now() + 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const result = db
    .prepare(
      `
    INSERT INTO Pedido
      (id_qua, id_status, id_cli, codigo_rastreamento, previsao_entrega)
    VALUES (?, 1, ?, ?, ?)
  `,
    )
    .run(req.body.id_qua, req.user.id, codigo, previsao);

  const order = db
    .prepare(`${orderQuery} WHERE p.id_ped = ?`)
    .get(result.lastInsertRowid);
  return res.status(201).json(order);
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
    INSERT INTO Feedback_Pedido (id_cli, id_ped, avaliacao, comentario)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id_cli, id_ped) DO UPDATE SET
      avaliacao = excluded.avaliacao,
      comentario = excluded.comentario,
      data_avaliacao = CURRENT_TIMESTAMP
  `,
  ).run(req.user.id, req.params.id, avaliacao, comentario || null);

  return res.status(201).json({ mensagem: "Feedback registrado." });
});

module.exports = router;
