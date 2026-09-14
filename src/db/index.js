const path = require("node:path");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

const dataDir = path.join(__dirname, "..", "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "pinturas.db"));
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS Clientes (
    Id_Cli INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    telefone TEXT,
    CPF TEXT,
    numero_casa TEXT,
    rua TEXT,
    bairro TEXT,
    foto TEXT
  );

  CREATE TABLE IF NOT EXISTS Classificacao (
    id_cla INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS Material (
    Id_mat INTEGER PRIMARY KEY AUTOINCREMENT,
    des_material TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS Artista (
    id_artista INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    CPF TEXT
  );

  CREATE TABLE IF NOT EXISTS Quadro (
    id_quadro INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tamanho TEXT,
    id_cla INTEGER REFERENCES Classificacao(id_cla),
    id_mat INTEGER REFERENCES Material(Id_mat),
    id_artista INTEGER REFERENCES Artista(id_artista)
  );

  CREATE TABLE IF NOT EXISTS Status_Pedido (
    id_status INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao_status TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS Pedido (
    id_ped INTEGER PRIMARY KEY AUTOINCREMENT,
    id_qua INTEGER NOT NULL REFERENCES Quadro(id_quadro),
    id_status INTEGER NOT NULL REFERENCES Status_Pedido(id_status),
    id_cli INTEGER NOT NULL REFERENCES Clientes(Id_Cli),
    codigo_rastreamento TEXT UNIQUE,
    data_pedido TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    previsao_entrega TEXT
  );

  CREATE TABLE IF NOT EXISTS Feedback_Pedido (
    id_cli INTEGER NOT NULL REFERENCES Clientes(Id_Cli),
    id_ped INTEGER NOT NULL REFERENCES Pedido(id_ped),
    avaliacao INTEGER NOT NULL CHECK (avaliacao BETWEEN 1 AND 5),
    comentario TEXT,
    data_avaliacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_cli, id_ped)
  );

  CREATE TABLE IF NOT EXISTS Mensagem (
    id_mensagem INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cli INTEGER NOT NULL REFERENCES Clientes(Id_Cli),
    remetente TEXT NOT NULL CHECK (remetente IN ('cliente', 'contratante')),
    texto TEXT NOT NULL,
    data_envio TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function seed() {
  if (
    db.prepare("SELECT COUNT(*) AS total FROM Status_Pedido").get().total === 0
  ) {
    const addStatus = db.prepare(
      "INSERT INTO Status_Pedido (descricao_status) VALUES (?)",
    );

    ["Pedido recebido", "Em producao", "Enviado", "Entregue"].forEach(
      (status) => addStatus.run(status),
    );
  }

  if (
    db.prepare("SELECT COUNT(*) AS total FROM Classificacao").get().total === 0
  ) {
    db.prepare("INSERT INTO Classificacao (descricao) VALUES (?)").run(
      "Pintura personalizada",
    );
  }

  if (db.prepare("SELECT COUNT(*) AS total FROM Material").get().total === 0) {
    db.prepare("INSERT INTO Material (des_material) VALUES (?)").run(
      "Tela de algodao",
    );
  }

  if (db.prepare("SELECT COUNT(*) AS total FROM Artista").get().total === 0) {
    db.prepare("INSERT INTO Artista (nome, email) VALUES (?, ?)").run(
      "Sophi",
      "contato@pinturasdasophi.com",
    );
  }

  if (db.prepare("SELECT COUNT(*) AS total FROM Quadro").get().total === 0) {
    db.prepare(
      `
      INSERT INTO Quadro (titulo, tamanho, id_cla, id_mat, id_artista)
      VALUES (?, ?, 1, 1, 1)
    `,
    ).run("Aurora floral", "40 x 50 cm");
  }
}

seed();

module.exports = db;
