const express = require("express");
const db = require("../db");
const { requireAdmin } = require("../middleware/admin");

const router = express.Router();

router.get("/", (_req, res) => {
  const catalog = db
    .prepare(
      `
    SELECT
      q.*,
      c.descricao,
      GROUP_CONCAT(DISTINCT COALESCE(m.des_material, legacy_material.des_material)) AS des_material,
      a.nome AS artista
    FROM Quadro q
    LEFT JOIN Classificacao c ON c.id_cla = q.id_cla
    LEFT JOIN Material_Quadro mq ON mq.id_qua = q.id_quadro
    LEFT JOIN Material m ON m.Id_mat = mq.id_mat
    LEFT JOIN Material legacy_material ON legacy_material.Id_mat = q.id_mat
    LEFT JOIN Artista a ON a.id_artista = q.id_artista
    GROUP BY q.id_quadro
    ORDER BY q.data_criacao DESC
  `,
    )
    .all();

  res.json(catalog);
});

router.post("/", requireAdmin, (req, res) => {
  const { titulo, tamanho, id_cla, id_artista, materiais = [] } = req.body;
  const preco = Number(req.body.preco_u);
  if (!String(titulo || "").trim() || !Number.isFinite(preco) || preco < 0) {
    return res.status(400).json({ erro: "Informe titulo e preco valido para o quadro." });
  }
  if (!Array.isArray(materiais) || materiais.some((id) => !Number.isInteger(Number(id)))) {
    return res.status(400).json({ erro: "A lista de materiais e invalida." });
  }

  const insert = db.prepare(`
    INSERT INTO Quadro (titulo, tamanho, id_cla, id_artista, preco_u)
    VALUES (?, ?, ?, ?, ?)
  `);
  const addMaterial = db.prepare(
    "INSERT INTO Material_Quadro (id_qua, id_mat) VALUES (?, ?)",
  );

  try {
    db.exec("BEGIN");
    const result = insert.run(
      String(titulo).trim(),
      tamanho || null,
      id_cla || null,
      id_artista || null,
      preco,
    );
    for (const materialId of materiais) {
      addMaterial.run(result.lastInsertRowid, Number(materialId));
    }
    db.exec("COMMIT");
    return res.status(201).json({ id_quadro: result.lastInsertRowid, mensagem: "Quadro cadastrado." });
  } catch (error) {
    db.exec("ROLLBACK");
    if (error.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
      return res.status(400).json({ erro: "Classificacao, artista ou material nao encontrado." });
    }
    return res.status(500).json({ erro: "Nao foi possivel cadastrar o quadro." });
  }
});

module.exports = router;
