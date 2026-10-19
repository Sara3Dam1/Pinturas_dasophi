const { timingSafeEqual } = require("node:crypto");
const jwt = require("jsonwebtoken");
const { jwtSecret, adminEmail, adminPasswordHash, adminToken } = require("../config");

function requireAdmin(req, res, next) {
  if (!adminToken && !(adminEmail && adminPasswordHash)) {
    return res.status(503).json({ erro: "Acesso administrativo nao configurado." });
  }

  const authorization = req.get("authorization") || "";
  if (authorization.startsWith("Bearer ")) {
    let payload;
    try {
      payload = jwt.verify(authorization.slice(7), jwtSecret);
    } catch {
      // An invalid admin session is rejected below.
    }
    if (payload?.role === "admin" && payload.email === adminEmail) {
      return next();
    }
  }

  const suppliedToken = Buffer.from(req.get("x-admin-token") || "");
  const expectedToken = Buffer.from(adminToken || "");
  if (
    !adminToken ||
    suppliedToken.length !== expectedToken.length ||
    !timingSafeEqual(suppliedToken, expectedToken)
  ) {
    return res.status(401).json({ erro: "Acesso administrativo nao autorizado." });
  }

  return next();
}

module.exports = { requireAdmin };