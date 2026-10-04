const path = require("node:path");

const rootDir = path.join(__dirname, "..");

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || "pinturas-dasophi-dev-secret",
  adminToken: process.env.ADMIN_TOKEN,
  mercadoPagoAccessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
  mercadoPagoWebhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
  appUrl: process.env.APP_URL,
  rootDir,
  publicDir: path.join(rootDir, "public"),
  uploadsDir: path.join(rootDir, "data", "uploads"),
};
