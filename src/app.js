const path = require("node:path");
const express = require("express");
const cors = require("cors");
const { publicDir, uploadsDir } = require("./config");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/perfil.routes");
const catalogRoutes = require("./routes/catalogo.routes");
const orderRoutes = require("./routes/pedido.routes");
const paymentRoutes = require("./routes/pagamento.routes");
const chatRoutes = require("./routes/chat.routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.use("/uploads", express.static(uploadsDir));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/perfil", profileRoutes);
app.use("/api/catalogo", catalogRoutes);
app.use("/api/pedidos", orderRoutes);
app.use("/api/pagamentos", paymentRoutes);
app.use("/api/chat", chatRoutes);

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, _req, res, next) => {
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ erro: "A imagem deve ter no maximo 5 MB." });
  }
  if (error.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({ erro: error.message });
  }
  return next(error);
});

module.exports = app;
