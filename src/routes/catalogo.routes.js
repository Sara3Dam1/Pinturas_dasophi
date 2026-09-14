const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (_req, res) => {
  const catalog = db
    .prepare(
      `
    SELECT
      q.*,
      c.descricao,
      m.des_material,
      a.nome AS artista
    FROM Quadro q
    LEFT JOIN Classificacao c ON c.id_cla = q.id_cla
    LEFT JOIN Material m ON m.Id_mat = q.id_mat
    LEFT JOIN Artista a ON a.id_artista = q.id_artista
    ORDER BY q.data_criacao DESC
  `,
    )
    .all();

  res.json(catalog);
});

module.exports = router;
