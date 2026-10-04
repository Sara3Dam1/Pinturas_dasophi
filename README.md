# Pinturas da Sophi

Projeto full-stack com API REST, SQLite e interface web para clientes, pedidos, rastreamento, feedback e chat.

## Executar

```bash
npm install
npm start
```

Acesse `http://localhost:3000`.

## Pagamentos e envios

O checkout usa o Mercado Pago para processar Pix ou cartão sem armazenar dados de cartão. Para habilitar cobranças reais, configure as credenciais da loja e uma URL pública acessível pelo Mercado Pago:

```sh
export MERCADO_PAGO_ACCESS_TOKEN=seu_access_token
export MERCADO_PAGO_WEBHOOK_SECRET=segredo_configurado_no_webhook
export APP_URL=https://seu-dominio-publico.com
export ADMIN_TOKEN=um_token_administrativo_forte
npm start
```

Cadastre `/api/pagamentos/webhook` como URL de notificações de pagamentos no painel do Mercado Pago. Sem essas variáveis, o checkout e as operações administrativas ficam desabilitados; não há cobrança simulada.

Para incluir uma obra no catálogo, use `POST /api/catalogo` com o cabeçalho `x-admin-token` e os dados da obra. `preco_u` é em reais; `materiais` aceita IDs da tabela `Material`.

```json
{
	"titulo": "Jardim ao entardecer",
	"tamanho": "40 x 50 cm",
	"preco_u": 480,
	"id_cla": 1,
	"id_artista": 1,
	"materiais": [1]
}
```

Depois de postar o pedido, registre o código real dos Correios com `PATCH /api/pedidos/:id/envio`, o mesmo cabeçalho administrativo e o corpo `{"codigo_rastreamento":"BR123456789BR"}`. A data estimada é atualizada para até sete dias corridos após a postagem.

## API REST

- `POST /api/auth/register`, `POST /api/auth/login` e `POST /api/auth/recuperar`
- `GET/PATCH /api/perfil` e `POST /api/perfil/foto`
- `GET /api/catalogo`
- `GET /api/pedidos` e `GET /api/pedidos/rastrear/:codigo`; a criação direta por `POST /api/pedidos` foi desativada em favor do checkout pago
- `POST /api/pagamentos/checkout` e `POST /api/pagamentos/webhook`
- `PATCH /api/pedidos/:id/envio` e `POST /api/catalogo` exigem `x-admin-token`
- `POST /api/pedidos/:id/feedback`
- `GET/POST /api/chat`
- `GET /api/health`

Rotas protegidas usam `Authorization: Bearer <token>`. O banco é criado automaticamente em `data/pinturas.db`.

## Modelo

O SQLite contém `Clientes`, `Quadro` (incluindo `preco_u`), `Classificacao`, `Material`, `Material_Quadro`, `Artista`, `Pedido`, `Status`, `Feedback`, `Mensagem` e tabelas de pagamento. Senhas, foto, comentário, status de cobrança, rastreio e datas de envio são campos auxiliares. A inicialização migra bancos existentes e mantém as tabelas legadas necessárias para preservar pedidos e avaliações já salvos.
