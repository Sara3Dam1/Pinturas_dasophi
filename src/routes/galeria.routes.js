const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const db = require("../db");
const { uploadsDir } = require("../config");
const { requireAdmin } = require("../middleware/admin");
const upload = require("../middleware/upload");

const router = express.Router();

router.get("/", (_req, res) => {
  const obras = db.prepare(`
    SELECT id_obra, titulo, tamanho, descricao, foto, data_publicacao
    FROM Galeria
    ORDER BY data_publicacao DESC, id_obra DESC
  `).all();
  return res.json(obras);
});

router.post("/", requireAdmin, upload.single("foto"), (req, res) => {
  const titulo = String(req.body.titulo || "").trim();
  const tamanho = String(req.body.tamanho || "").trim();
  const descricao = String(req.body.descricao || "").trim();
  if (!titulo || titulo.length > 160 || tamanho.length > 100 || descricao.length > 1000 || !req.file) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({
      erro: "Informe um título, uma foto e dados dentro dos limites permitidos.",
    });
  }

  const result = db.prepare(`
    INSERT INTO Galeria (titulo, tamanho, descricao, foto)
    VALUES (?, ?, ?, ?)
  `).run(
    titulo,
    tamanho || null,
    descricao || null,
    `/uploads/${req.file.filename}`,
  );

  return res.status(201).json({
    id_obra: result.lastInsertRowid,
    mensagem: "Obra publicada na galeria.",
  });
});

router.delete("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ erro: "Obra inválida." });
  }

  const obra = db.prepare("SELECT foto FROM Galeria WHERE id_obra = ?").get(id);
  if (!obra) {
    return res.status(404).json({ erro: "Obra não encontrada na galeria." });
  }

  db.prepare("DELETE FROM Galeria WHERE id_obra = ?").run(id);

  if (obra.foto.startsWith("/uploads/")) {
    const photoPath = path.join(uploadsDir, path.basename(obra.foto));
    try {
      fs.unlinkSync(photoPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  return res.json({ mensagem: "Obra removida da galeria." });
});

module.exports = router;
