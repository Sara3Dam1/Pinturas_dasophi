const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { adminEmail, adminPasswordHash, jwtSecret } = require("../config");

const validBcryptHash = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function isAdminConfigured() {
  return Boolean(adminEmail && validBcryptHash.test(adminPasswordHash || ""));
}

function verifyAdminCredentials(email, password) {
  return isAdminConfigured() && email === adminEmail &&
    bcrypt.compareSync(password, adminPasswordHash);
}

function createAdminToken() {
  return jwt.sign({ role: "admin", email: adminEmail }, jwtSecret, {
    expiresIn: "8h",
  });
}

module.exports = { isAdminConfigured, verifyAdminCredentials, createAdminToken };