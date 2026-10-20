const express = require("express");
const db = require("../db");
const { requireAdmin } = require("../middleware/admin");
const {
  createAdminToken,
  isAdminConfigured,
  verifyAdminCredentials,
} = require("../utilidade/admin");

const router = express.Router();

router.post("/login", (req, res) => {
  if (!isAdminConfigured()) {
    return res.status(503).json({ erro: "Acesso administrativo nao configurado." });
  }

  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.senha || "");
  if (!verifyAdminCredentials(email, password)) {
    return res.status(401).json({ erro: "E-mail ou senha invalidos." });
  }

  return res.json({ token: createAdminToken(), email });
});

router.get("/pedidos", requireAdmin, (_req, res) => {
  const orders = db.prepare(`
    SELECT p.id_ped, p.data_pedido, p.data_envio, p.previsao_entrega,
      p.codigo_rastreamento, p.data_entrega_confirmada,
      q.titulo, q.tamanho, q.preco_u, s.descricao_status,
      c.nome AS cliente_nome, c.email AS cliente_email
    FROM Pedido p
    JOIN Quadro q ON q.id_quadro = p.id_qua
    JOIN Status s ON s.id_status = p.id_status
    JOIN Clientes c ON c.Id_Cli = p.id_cli
    ORDER BY p.data_pedido DESC, p.id_ped DESC
  `).all();
  return res.json(orders);
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
