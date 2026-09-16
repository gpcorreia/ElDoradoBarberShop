# Gerador de projetos

Este script cria uma base reutilizável para projetos com:

- backend Node.js, Express e TypeScript;
- pastas para controllers, routes, services, repositories, middleware, config, types e testes;
- frontend HTML, CSS e JavaScript;
- pastas para componentes e imagens;
- configuração de ambiente, TypeScript e Git;
- rota inicial `GET /api/health`;
- tratamento de rotas inexistentes e erros internos.

## Utilização

Na pasta onde pretendes criar o projeto:

```powershell
node C:\Users\gonca\Documents\ElDoradoBarberShop\scripts\create-project.mjs MeuProjeto
```

Para escolher o destino e instalar as dependências:

```powershell
node C:\Users\gonca\Documents\ElDoradoBarberShop\scripts\create-project.mjs MeuProjeto --destination C:\Users\gonca\Documents\MeuProjeto --install --git
```

Para ver a estrutura sem criar ficheiros:

```powershell
node C:\Users\gonca\Documents\ElDoradoBarberShop\scripts\create-project.mjs MeuProjeto --dry-run
```

O script nunca escreve dentro de uma pasta que já tenha conteúdo.
