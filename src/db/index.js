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
    cep TEXT,
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
    id_artista INTEGER REFERENCES Artista(id_artista),
    preco_u REAL NOT NULL DEFAULT 0
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
    previsao_entrega TEXT,
    rua_entrega TEXT,
    numero_casa_entrega TEXT,
    bairro_entrega TEXT,
    cep_entrega TEXT,
    data_entrega_confirmada TEXT
  );

  CREATE TABLE IF NOT EXISTS Feedback_Pedido (
    id_cli INTEGER NOT NULL REFERENCES Clientes(Id_Cli),
    id_ped INTEGER NOT NULL REFERENCES Pedido(id_ped),
    avaliacao INTEGER NOT NULL CHECK (avaliacao BETWEEN 1 AND 5),
    comentario TEXT,
    data_avaliacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_cli, id_ped)
  );

  CREATE TABLE IF NOT EXISTS Status (
    id_status INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao_status TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS Material_Quadro (
    id_qua INTEGER NOT NULL REFERENCES Quadro(id_quadro) ON DELETE CASCADE,
    id_mat INTEGER NOT NULL REFERENCES Material(Id_mat),
    PRIMARY KEY (id_qua, id_mat)
  );

  CREATE TABLE IF NOT EXISTS Feedback (
    id_cli INTEGER NOT NULL REFERENCES Clientes(Id_Cli),
    id_ped INTEGER NOT NULL REFERENCES Pedido(id_ped),
    avaliacao INTEGER NOT NULL CHECK (avaliacao BETWEEN 1 AND 5),
    comentario TEXT,
    foto TEXT,
    data_pedido TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_cli, id_ped)
  );

  CREATE TABLE IF NOT EXISTS Pagamento (
    id_pagamento INTEGER PRIMARY KEY AUTOINCREMENT,
    referencia_externa TEXT NOT NULL UNIQUE,
    preference_id TEXT,
    status_pagamento TEXT NOT NULL DEFAULT 'pending',
    forma_pagamento TEXT NOT NULL,
    id_cli INTEGER NOT NULL REFERENCES Clientes(Id_Cli),
    data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Pagamento_Pedido (
    id_pagamento INTEGER NOT NULL REFERENCES Pagamento(id_pagamento),
    id_ped INTEGER NOT NULL UNIQUE REFERENCES Pedido(id_ped),
    PRIMARY KEY (id_pagamento, id_ped)
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

const quadroColumns = db.prepare("PRAGMA table_info(Quadro)").all();
if (!quadroColumns.some((column) => column.name === "preco_u")) {
  db.exec("ALTER TABLE Quadro ADD COLUMN preco_u REAL NOT NULL DEFAULT 0");
}

const pedidoColumns = db.prepare("PRAGMA table_info(Pedido)").all();
for (const [column, type] of [
  ["data_envio", "TEXT"],
  ["rua_entrega", "TEXT"],
  ["numero_casa_entrega", "TEXT"],
  ["bairro_entrega", "TEXT"],
  ["cep_entrega", "TEXT"],
  ["data_entrega_confirmada", "TEXT"],
]) {
  if (!pedidoColumns.some((existing) => existing.name === column)) {
    db.exec(`ALTER TABLE Pedido ADD COLUMN ${column} ${type}`);
  }
}

const clienteColumns = db.prepare("PRAGMA table_info(Clientes)").all();
if (!clienteColumns.some((column) => column.name === "cep")) {
  db.exec("ALTER TABLE Clientes ADD COLUMN cep TEXT");
}

const feedbackColumns = db.prepare("PRAGMA table_info(Feedback)").all();
if (!feedbackColumns.some((column) => column.name === "comentario")) {
  db.exec("ALTER TABLE Feedback ADD COLUMN comentario TEXT");
}
if (!feedbackColumns.some((column) => column.name === "foto")) {
  db.exec("ALTER TABLE Feedback ADD COLUMN foto TEXT");
}

db.exec(`
  INSERT OR IGNORE INTO Status (id_status, descricao_status)
  SELECT id_status, descricao_status FROM Status_Pedido;

  INSERT OR IGNORE INTO Status (descricao_status) VALUES
    ('Aguardando pagamento'),
    ('Pagamento aprovado'),
    ('Cancelado');

  DELETE FROM Status_Pedido
  WHERE id_status > (SELECT MAX(id_status) FROM Status)
    AND id_status NOT IN (SELECT id_status FROM Pedido);

  INSERT OR IGNORE INTO Status_Pedido (id_status, descricao_status)
  SELECT id_status, descricao_status FROM Status WHERE id_status > 4;

  UPDATE Status_Pedido
  SET descricao_status = (
    SELECT descricao_status FROM Status WHERE Status.id_status = Status_Pedido.id_status
  )
  WHERE id_status > 4 AND id_status IN (SELECT id_status FROM Status);

  UPDATE Pedido
  SET codigo_rastreamento = NULL
  WHERE data_envio IS NULL
    AND codigo_rastreamento LIKE 'PS-%'
    AND id_status <> (SELECT id_status FROM Status WHERE descricao_status = 'Enviado');

  INSERT OR IGNORE INTO Material_Quadro (id_qua, id_mat)
  SELECT id_quadro, id_mat FROM Quadro WHERE id_mat IS NOT NULL;

  INSERT OR IGNORE INTO Feedback (id_cli, id_ped, avaliacao, comentario, data_pedido)
  SELECT id_cli, id_ped, avaliacao, comentario, data_avaliacao FROM Feedback_Pedido;
`);

module.exports = db;
