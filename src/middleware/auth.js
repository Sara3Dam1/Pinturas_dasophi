const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: "Token nao informado." });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ erro: "Sessao expirada ou invalida." });
  }
}

module.exports = { requireAuth };
