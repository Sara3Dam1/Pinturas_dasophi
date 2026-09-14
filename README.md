# Pinturas da Sophi

Projeto full-stack com API REST, SQLite e interface web para clientes, pedidos, rastreamento, feedback e chat.

## Executar

```bash
npm install
npm start
```

Acesse `http://localhost:3000`.

## API REST

- `POST /api/auth/register`, `POST /api/auth/login` e `POST /api/auth/recuperar`
- `GET/PATCH /api/perfil` e `POST /api/perfil/foto`
- `GET /api/catalogo`
- `POST /api/pedidos`, `GET /api/pedidos` e `GET /api/pedidos/rastrear/:codigo`
- `POST /api/pedidos/:id/feedback`
- `GET/POST /api/chat`
- `GET /api/health`

Rotas protegidas usam `Authorization: Bearer <token>`. O banco é criado automaticamente em `data/pinturas.db`.

## Modelo

O SQLite contém `Clientes`, `Quadro`, `Classificacao`, `Material`, `Artista`, `Pedido`, `Status_Pedido`, `Feedback_Pedido` e `Mensagem`. Os campos adicionais de senha, rastreamento, previsão, comentário e mensagens sustentam os requisitos funcionais sem quebrar as entidades fornecidas.
