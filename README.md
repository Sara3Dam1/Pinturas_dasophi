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
npm start
```

Cadastre `/api/pagamentos/webhook` como URL de notificações de pagamentos no painel do Mercado Pago. Sem essas variáveis, o checkout e as operações administrativas ficam desabilitados; não há cobrança simulada.

O checkout pede a confirmação de rua, número, bairro e CEP antes de abrir o Mercado Pago e salva uma cópia do endereço em cada pedido. Depois de marcar o pedido como enviado, o cliente confirma o recebimento; só então pode publicar nota, opinião e foto na galeria pública. As fotos aceitas são JPEG, PNG, WebP, GIF ou AVIF, até 5 MB.

Se `JWT_SECRET` não estiver definido, o servidor gera um segredo aleatório e o mantém em `data/jwt-secret` (diretório ignorado pelo Git). Tokens de sessões existentes antes da primeira inicialização com essa proteção precisarão ser renovados com novo login.

Para cadastrar uma obra pela API, faça login em `POST /api/auth/login` usando o e-mail administrativo e envie o token retornado como `Authorization: Bearer <token>` em `POST /api/catalogo`. `POST /api/admin/login` continua disponível para integrações existentes. `preco_u` é em reais; `materiais` aceita IDs da tabela `Material`. O cadastro também aceita uma foto no campo multipart `foto`.

Configure `ADMIN_EMAIL` e `ADMIN_PASSWORD_HASH` no ambiente do servidor. A senha deve ser armazenada como hash bcrypt, nunca no código ou no navegador. Para gerar o hash de uma senha, execute `node -e 'console.log(require("bcryptjs").hashSync(process.argv[1], 12))' 'sua-senha'` em um terminal seguro. Em desenvolvimento, o projeto carrega essas variáveis de um arquivo `.env` local, ignorado pelo Git. A administradora entra pelo mesmo botão **Entrar** dos clientes, usando esse e-mail e senha. A sessão administrativa mostra a gestão de quadros em **Quadros originais**, as mensagens recebidas em **Chat de encomendas** e os pedidos separados em andamento e concluídos em **Carrinho**. O token administrativo dura oito horas. Use HTTPS em produção.

Na gestão de quadros, é possível cadastrar título, tamanho, preço e uma foto opcional, ou retirar uma obra da venda sem apagar o histórico de pedidos. As conversas incluem as mensagens recebidas pelo chat do cliente; as respostas da artista aparecem na mesma conversa.

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

Depois de postar o pedido, registre o código real dos Correios com `PATCH /api/pedidos/:id/envio`, usando o mesmo token administrativo e o corpo `{"codigo_rastreamento":"BR123456789BR"}`. A data estimada é atualizada para até sete dias corridos após a postagem.

## API REST

- `POST /api/auth/register`, `POST /api/auth/login` e `POST /api/auth/recuperar`
- `GET/PATCH /api/perfil` e `POST /api/perfil/foto`
- `GET /api/catalogo`
- `GET /api/pedidos`, `GET /api/pedidos/rastrear/:codigo` e `GET /api/pedidos/feedbacks`
- `PATCH /api/pedidos/:id/confirmar-entrega` e `POST /api/pedidos/:id/feedback` (multipart: `avaliacao`, `comentario`, `foto`); a avaliação requer entrega confirmada
- A criação direta por `POST /api/pedidos` foi desativada em favor do checkout pago
- `POST /api/pagamentos/checkout` e `POST /api/pagamentos/webhook`
- `POST /api/admin/login`, `GET /api/admin/pedidos`, `GET /api/admin/conversas` e `GET/POST /api/admin/conversas/:id/mensagens` exigem login administrativo (exceto o login)
- `PATCH /api/pedidos/:id/envio` e `POST /api/catalogo` exigem autenticação administrativa
- `DELETE /api/catalogo/:id` retira um quadro da venda sem remover pedidos antigos e exige autenticação administrativa
- `POST /api/pedidos/:id/feedback`
- `GET/POST /api/chat`
- `GET /api/health`

Rotas protegidas usam `Authorization: Bearer <token>`. O banco é criado automaticamente em `data/pinturas.db`.

## Modelo

O SQLite contém `Clientes` (incluindo CEP), `Quadro` (incluindo `preco_u`), `Classificacao`, `Material`, `Material_Quadro`, `Artista`, `Pedido` (com endereço de entrega e confirmação), `Status`, `Feedback` (incluindo foto), `Mensagem` e tabelas de pagamento. Senhas, foto, comentário, status de cobrança, rastreio e datas de envio são campos auxiliares. A inicialização migra bancos existentes e mantém as tabelas legadas necessárias para preservar pedidos e avaliações já salvos.
