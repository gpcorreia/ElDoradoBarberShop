# ElDorado Barbershop

Website público, sistema de marcações, catálogo de produtos e painel administrativo.

## Preparação local

```powershell
cd backend
copy .env.example .env
npm install
npm run build
npm start
```

O servidor fica disponível em `http://localhost:1000`.

## Configuração obrigatória

- `SUPABASE_URL`: URL do projeto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: chave secreta usada exclusivamente no backend.
- `JWT_SECRET_KEY`: segredo aleatório com pelo menos 32 caracteres.
- `ADMIN_EMAIL`: email de acesso administrativo.
- `ADMIN_PASSWORD_HASH`: hash bcrypt da palavra-passe administrativa.
- `NODE_ENV=production`: ativa cookies `Secure` e configuração de produção.
- `TRUST_PROXY=true`: utilizar quando a aplicação está atrás de um único reverse proxy.

Nunca colocar a service role key, o hash administrativo ou o JWT secret no frontend.

Para gerar credenciais fortes:

```powershell
npm run generate:admin-credentials
```

## Confirmações por email

Depois de uma marcação ser criada, o cliente recebe uma confirmação com o serviço, barbeiro, data e hora. Configurar no backend:

- `GMAIL_USER`: conta Gmail usada para enviar as confirmações;
- `GMAIL_API_CLIENT_ID`: Client ID OAuth criado no Google Cloud;
- `GMAIL_API_CLIENT_SECRET`: Client Secret OAuth;
- `GMAIL_API_REFRESH_TOKEN`: token offline com o scope `https://www.googleapis.com/auth/gmail.send`;
- `CONTACT_TO_EMAIL`: endereço da barbearia que recebe as respostas dos clientes.

No Render gratuito deve ser usada a Gmail API, porque as portas SMTP estão bloqueadas. Noutros alojamentos, `GMAIL_APP_PASSWORD` continua disponível como alternativa SMTP quando as três variáveis da Gmail API não estiverem configuradas.

## Base de dados

Executar uma vez no SQL Editor do Supabase:

```text
backend/migration_production_ready.sql
```

A migration normaliza timestamps, impede reservas sobrepostas, prepara produtos, remove o campo antigo `role` e bloqueia acesso público direto às tabelas com RLS.

## Verificação antes de publicar

```powershell
npm run build
npm run audit:prod
npm start
```

Noutro terminal:

```powershell
npm run smoke
```

Para incluir os pedidos reais ao Supabase:

```powershell
$env:SMOKE_DATABASE='true'
npm run smoke
```

## Checklist comercial

Antes da entrega ao cliente, substituir os dados provisórios no footer e no catálogo:

- morada;
- telefone;
- email;
- número de WhatsApp em `public/js/products.js`;
- ligações das redes sociais;
- preços e horários reais;
- identidade legal na Política de Privacidade.
