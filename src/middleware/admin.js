const { timingSafeEqual } = require("node:crypto");
const { adminToken } = require("../config");

function requireAdmin(req, res, next) {
  if (!adminToken) {
    return res.status(503).json({ erro: "Acesso administrativo nao configurado." });
  }

  const suppliedToken = Buffer.from(req.get("x-admin-token") || "");
  const expectedToken = Buffer.from(adminToken);
  if (
    suppliedToken.length !== expectedToken.length ||
    !timingSafeEqual(suppliedToken, expectedToken)
  ) {
    return res.status(401).json({ erro: "Acesso administrativo nao autorizado." });
  }

  return next();
}

module.exports = { requireAdmin };