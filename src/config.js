const path = require("node:path");
const fs = require("node:fs");
const { randomBytes } = require("node:crypto");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data");

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  fs.mkdirSync(dataDir, { recursive: true });
  const secretPath = path.join(dataDir, "jwt-secret");
  try {
    return fs.readFileSync(secretPath, "utf8").trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const generatedSecret = randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(secretPath, generatedSecret, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  return fs.readFileSync(secretPath, "utf8").trim();
}

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: getJwtSecret(),
  adminToken: process.env.ADMIN_TOKEN,
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase(),
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  paymentMode: process.env.PAYMENT_MODE === "demo" && process.env.NODE_ENV !== "production"
    ? "demo"
    : "stripe",
  appUrl: process.env.APP_URL,
  rootDir,
  publicDir: path.join(rootDir, "public"),
  uploadsDir: path.join(rootDir, "data", "uploads"),
};
