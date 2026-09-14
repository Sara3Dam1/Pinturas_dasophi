const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  const messages = db
    .prepare(
      `
    SELECT * FROM Mensagem
    WHERE id_cli = ?
    ORDER BY data_envio ASC
  `,
    )
    .all(req.user.id);

  res.json(messages);
});

router.post("/", requireAuth, (req, res) => {
  const texto = req.body.texto?.trim();
  if (!texto) {
    return res.status(400).json({ erro: "A mensagem nao pode ficar vazia." });
  }

  const result = db
    .prepare(
      `
    INSERT INTO Mensagem (id_cli, remetente, texto)
    VALUES (?, 'cliente', ?)
  `,
    )
    .run(req.user.id, texto);
  const message = db
    .prepare("SELECT * FROM Mensagem WHERE id_mensagem = ?")
    .get(result.lastInsertRowid);

  return res.status(201).json(message);
});

module.exports = router;
