const path = require("node:path");

const rootDir = path.join(__dirname, "..");

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || "pinturas-dasophi-dev-secret",
  rootDir,
  publicDir: path.join(rootDir, "public"),
  uploadsDir: path.join(rootDir, "data", "uploads"),
};
