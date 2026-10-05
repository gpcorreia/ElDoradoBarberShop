# Revisão pré-deploy — 5 de outubro de 2026

## Correções verificadas

- Multer atualizado para 2.4.x; auditoria de dependências de produção sem alertas conhecidos.
- Cookies inválidos devolvem acesso não autorizado; tokens têm de corresponder ao administrador configurado.
- Respostas administrativas, incluindo erros de autenticação, usam `Cache-Control: no-store`.
- Uploads exigem autenticação e origem válida; mantêm limite de 5 MB e conversão real da imagem por Sharp. Tipo não aceite devolve 400.
- Health check independente do limite de pedidos da API.
- Gmail API e SMTP têm limites de espera. Falhas de notificações não desfazem reservas guardadas.
- Reservas manuais retroativas não enviam email nem SMS; clientes não podem reservar no passado.
- Listas administrativas e faturação usam paginação para ultrapassar o limite de linhas por resposta do Supabase.
- Removido o helper de disponibilidade sem chamadas; corrigido o nome de SUPABASE_KEY na documentação e libertação de previews locais de imagens.
- Logout só navega após confirmação do servidor; uma falha aparece ao utilizador.
- GitHub passa a executar testes de segurança e auditoria de produção em DEV e PRs para PROD.

## Validação local

Build, TypeScript, verificação SEO e testes HTTP isolados. Cobertura: administração protegida, cookies malformados, pedidos de outra origem, JSON inválido, cabeçalhos de segurança, acesso a `.env`, horários passados/conflitos e paginação com mais de 1000 registos. Nenhuma reserva real criada ou mensagem enviada nesta revisão.

## Limites e verificações para publicação

- Confirmar `NODE_ENV=production` e `APP_ORIGIN` igual à origem HTTPS pública usada no navegador; servir frontend e API na mesma origem. Usar Node 22, como no CI.
- Confirmar que `backend/migration_production_ready.sql` já foi aplicada: RLS, restrições de acesso e exclusão de reservas sobrepostas dependem da base de dados real. A revisão do SQL local não verifica a configuração remota.
- Fazer uma reserva real controlada após o deploy para confirmar email com logótipo, SMS, login/logout e reserva manual retroativa. Estes envios não foram executados na revisão.
- Há seis alertas altos de auditoria nas dependências de desenvolvimento, através de `braces`/Tailwind/Nodemon. Não estão nas dependências de runtime; a resolução sugerida pelo npm inclui alterações incompatíveis. Evitar `npm audit fix --force`. Fazer build com dependências de desenvolvimento e, se o alojamento o permitir, `npm prune --omit=dev` antes de iniciar com `npm start`.
- A faturação atual é uma estimativa a partir das reservas confirmadas/concluídas e do preço atual do serviço. Inclui marcações futuras no mês e não guarda um preço histórico por reserva; não representa comprovativos de pagamento ou emissão fiscal.
- SMS já agendados no fornecedor não são cancelados automaticamente ao cancelar a reserva. A integração SMS não foi alterada nesta revisão.
- Rate limiting é em memória por processo. Se forem usadas várias instâncias, será necessário partilhar esse estado.

Não foram alteradas credenciais, executadas migrations remotas nem feito deploy.
