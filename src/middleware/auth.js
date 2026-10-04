const jwt = require("jsonwebtoken");
const db = require("../db");
const { jwtSecret } = require("../config");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: "Token nao informado." });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const userId = Number(payload.id);
    if (
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      !db.prepare("SELECT 1 FROM Clientes WHERE Id_Cli = ?").get(userId)
    ) {
      return res.status(401).json({ erro: "Sessao invalida." });
    }
    req.user = { ...payload, id: userId };
    return next();
  } catch {
    return res.status(401).json({ erro: "Sessao expirada ou invalida." });
  }
}

module.exports = { requireAuth };
