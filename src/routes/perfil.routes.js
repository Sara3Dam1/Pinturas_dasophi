const express = require("express");
const db = require("../db");
const upload = require("../middleware/upload");
const { requireAuth } = require("../middleware/auth");
const { publicClient } = require("../utilidade/client");

const router = express.Router();
const profileFields = [
  "nome",
  "telefone",
  "CPF",
  "numero_casa",
  "rua",
  "bairro",
];

router.get("/", requireAuth, (req, res) => {
  const client = db
    .prepare("SELECT * FROM Clientes WHERE Id_Cli = ?")
    .get(req.user.id);

  res.json(publicClient(client));
});

router.patch("/", requireAuth, (req, res) => {
  const fields = profileFields.filter((field) => req.body[field] !== undefined);

  if (fields.length > 0) {
    const assignments = fields.map((field) => `${field} = ?`).join(", ");
    const values = fields.map((field) => req.body[field]);

    db.prepare(`UPDATE Clientes SET ${assignments} WHERE Id_Cli = ?`).run(
      ...values,
      req.user.id,
    );
  }

  const client = db
    .prepare("SELECT * FROM Clientes WHERE Id_Cli = ?")
    .get(req.user.id);
  res.json(publicClient(client));
});

router.post("/foto", requireAuth, upload.single("foto"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ erro: "Envie um arquivo de foto." });
  }

  const foto = `/uploads/${req.file.filename}`;
  db.prepare("UPDATE Clientes SET foto = ? WHERE Id_Cli = ?").run(
    foto,
    req.user.id,
  );

  return res.json({ foto });
});

module.exports = router;
