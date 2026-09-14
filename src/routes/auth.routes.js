const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { jwtSecret } = require("../config");
const { publicClient } = require("../utils/client");

const router = express.Router();

function createToken(client) {
  return jwt.sign(
    { id: client.Id_Cli, email: client.email, nome: client.nome },
    jwtSecret,
    { expiresIn: "7d" },
  );
}

router.post("/register", (req, res) => {
  const { nome, email, senha, telefone, CPF, numero_casa, rua, bairro } =
    req.body;

  if (!nome || !email || !senha || senha.length < 6) {
    return res.status(400).json({
      erro: "Nome, e-mail e senha com no minimo 6 caracteres sao obrigatorios.",
    });
  }

  try {
    const result = db
      .prepare(
        `
      INSERT INTO Clientes
        (nome, email, senha, telefone, CPF, numero_casa, rua, bairro)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        nome.trim(),
        email.trim().toLowerCase(),
        bcrypt.hashSync(senha, 10),
        telefone ?? null,
        CPF ?? null,
        numero_casa ?? null,
        rua ?? null,
        bairro ?? null,
      );
    const client = db
      .prepare("SELECT * FROM Clientes WHERE Id_Cli = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json({
      cliente: publicClient(client),
      token: createToken(client),
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ erro: "Este e-mail ja esta cadastrado." });
    }

    return res.status(500).json({ erro: "Nao foi possivel criar a conta." });
  }
});

router.post("/login", (req, res) => {
  const email = String(req.body.email || "").toLowerCase();
  const client = db
    .prepare("SELECT * FROM Clientes WHERE email = ?")
    .get(email);

  if (!client || !bcrypt.compareSync(req.body.senha || "", client.senha)) {
    return res.status(401).json({ erro: "E-mail ou senha invalidos." });
  }

  return res.json({
    cliente: publicClient(client),
    token: createToken(client),
  });
});

router.post("/recuperar", (req, res) => {
  const email = String(req.body.email || "").toLowerCase();
  db.prepare("SELECT Id_Cli FROM Clientes WHERE email = ?").get(email);

  res.json({
    mensagem:
      "Se o e-mail estiver cadastrado, enviaremos as instrucoes de recuperacao.",
  });
});

module.exports = router;
