# GloboMotors

Site de uma garagem de carros: vitrine pública (sem login, só leitura) e painel do vendedor com cadastro de carros e CRM.

## Requisitos

- Node 24 (o `.nvmrc` aponta a versão; o npm recusa versões menores)
- PostgreSQL 16 ou mais novo instalado na máquina, em `localhost:5432` (o projeto não usa Docker)

## Primeira vez

Crie o usuário e o banco no Postgres local, uma vez só. O `CREATEDB` é para os testes criarem bancos temporários. Se você entra no Postgres de outro jeito, rode os dois comandos SQL com um superusuário.

```bash
sudo -u postgres psql -c "CREATE ROLE globomotors LOGIN PASSWORD 'globomotors' CREATEDB" -c "CREATE DATABASE globomotors OWNER globomotors"
```

Depois:

```bash
nvm use
npm ci
cp server/.env.example server/.env
npm run dev                           # API :3001 + web :5173
npm run verificar                     # em outro terminal: confere Node, banco, API e proxy
```

- Vitrine: página inicial em http://localhost:5173 e catálogo em http://localhost:5173/catalogo
- Painel do vendedor: http://localhost:5173/dashboard (pede login em http://localhost:5173/login)
- Saúde da API: http://localhost:3001/api/health

## Vendedor e dados de exemplo

Não existe cadastro de vendedor pela tela: crie pelo script, a partir de `server/`. Ele pede a senha duas vezes, sem mostrar o que você digita (mínimo de 8 caracteres; em produção, use uma frase longa).

```bash
cd server && node --env-file-if-exists=.env scripts/criarVendedor.ts --nome "Seu Nome" --email voce@loja.com
```

Para popular o banco com loja, carros com fotos, clientes e interesses, rode também a partir de `server/`, com a API no ar (`npm run dev`). O script cria um vendedor novo com a senha `teste123` e imprime o e-mail dele. Ele também sobrescreve os dados da loja com os de exemplo, por isso é só para desenvolvimento.

```bash
cd server && node --env-file-if-exists=.env scripts/prepararDados.ts
```

O login aceita 10 tentativas a cada 15 minutos por IP e por e-mail. No desenvolvimento todo acesso vem do mesmo IP, então 10 senhas erradas bloqueiam o login local. Para liberar sem esperar, a partir de `server/`:

```bash
cd server && node --env-file-if-exists=.env scripts/prepararTesteDeSeguranca.ts --liberar
```

## Antes de considerar uma mudança pronta

```bash
npm run lint
npm run build
npm run test
```

São os mesmos passos do job `validar` do CI.

## Produção local

```bash
npm run build
npm start                             # API servindo o front buildado em http://localhost:3001
```
