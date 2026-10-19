const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { adminEmail, adminPasswordHash, jwtSecret } = require("../config");
const { requireAdmin } = require("../middleware/admin");

const router = express.Router();
const validBcryptHash = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

router.post("/login", (req, res) => {
  if (!adminEmail || !validBcryptHash.test(adminPasswordHash || "")) {
    return res.status(503).json({ erro: "Acesso administrativo nao configurado." });
  }

  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.senha || "");
  if (email !== adminEmail || !bcrypt.compareSync(password, adminPasswordHash)) {
    return res.status(401).json({ erro: "E-mail ou senha invalidos." });
  }

  const token = jwt.sign({ role: "admin", email: adminEmail }, jwtSecret, {
    expiresIn: "8h",
  });
  return res.json({ token, email: adminEmail });
});

router.get("/conversas", requireAdmin, (_req, res) => {
  const conversations = db.prepare(`
    WITH latest AS (
      SELECT id_cli, texto, remetente, data_envio,
        ROW_NUMBER() OVER (
          PARTITION BY id_cli ORDER BY data_envio DESC, id_mensagem DESC
        ) AS position
      FROM Mensagem
    )
    SELECT
      c.Id_Cli AS id_cli,
      c.nome,
      c.email,
      latest.texto AS ultima_mensagem,
      latest.remetente AS ultimo_remetente,
      latest.data_envio AS data_ultima_mensagem,
      COUNT(m.id_mensagem) AS total_mensagens
    FROM latest
    JOIN Clientes c ON c.Id_Cli = latest.id_cli
    JOIN Mensagem m ON m.id_cli = c.Id_Cli
    WHERE latest.position = 1
    GROUP BY c.Id_Cli
    ORDER BY latest.data_envio DESC
  `).all();

  return res.json(conversations);
});

router.get("/conversas/:id/mensagens", requireAdmin, (req, res) => {
  const clientId = Number(req.params.id);
  if (!Number.isSafeInteger(clientId) || clientId < 1) {
    return res.status(400).json({ erro: "Conversa invalida." });
  }
  if (!db.prepare("SELECT 1 FROM Clientes WHERE Id_Cli = ?").get(clientId)) {
    return res.status(404).json({ erro: "Conversa nao encontrada." });
  }

  const messages = db.prepare(`
    SELECT id_mensagem, id_cli, remetente, texto, data_envio
    FROM Mensagem
    WHERE id_cli = ?
    ORDER BY data_envio ASC, id_mensagem ASC
  `).all(clientId);
  return res.json(messages);
});

router.post("/conversas/:id/mensagens", requireAdmin, (req, res) => {
  const clientId = Number(req.params.id);
  if (!Number.isSafeInteger(clientId) || clientId < 1) {
    return res.status(400).json({ erro: "Conversa invalida." });
  }
  if (!db.prepare("SELECT 1 FROM Clientes WHERE Id_Cli = ?").get(clientId)) {
    return res.status(404).json({ erro: "Conversa nao encontrada." });
  }

  const texto = String(req.body.texto || "").trim();
  if (!texto || texto.length > 2000) {
    return res.status(400).json({ erro: "A mensagem deve ter entre 1 e 2000 caracteres." });
  }

  const result = db.prepare(`
    INSERT INTO Mensagem (id_cli, remetente, texto)
    VALUES (?, 'contratante', ?)
  `).run(clientId, texto);
  const message = db.prepare(`
    SELECT id_mensagem, id_cli, remetente, texto, data_envio
    FROM Mensagem WHERE id_mensagem = ?
  `).get(result.lastInsertRowid);
  return res.status(201).json(message);
});

module.exports = router;
