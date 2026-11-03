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

Para voltar o banco local a um vendedor só, sem carros, fotos, clientes nem interesses, rode a partir de `server/`. A configuração da loja é mantida, e o script pede a senha do vendedor duas vezes. Ele só aceita banco em `localhost`.

```bash
cd server && node --env-file-if-exists=.env scripts/zerarBanco.ts --nome "Seu Nome" --email voce@loja.com
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

## Deploy na Vercel

O front vai para o CDN da Vercel e a API vira uma função Node 24 em São Paulo (`gru1`), no mesmo domínio. O banco é um Postgres do Neon, ligado ao projeto pela aba Storage da Vercel, que cria o `DATABASE_URL`.

O deploy sai só do CI. O job `implantar` do `.github/workflows/ci.yml` roda depois do `validar`, a cada push na `main`, quando o repositório tem estas configurações em Settings, Secrets and variables, Actions, nos quadros do repositório (Repository variables e Repository secrets). O job não usa environment do GitHub, então o que for criado em Environments não chega a ele:

- variáveis `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` (estão no `.vercel/project.json` depois de um `npx vercel@65.9.0 link`);
- secret `VERCEL_TOKEN` (criado em Account Settings, Tokens, na Vercel).

Sem elas o job fica pulado. As migrations rodam no fim do build de produção.

Não rode `vercel deploy` nem `vercel` puro na sua máquina: a CLI não respeita o `.gitignore` e enviaria o `server/.env` e outros arquivos locais.

Para conferir a saída da Vercel sem publicar nada (grava em `.vercel/output`):

```bash
npm run build:vercel
```

O vendedor de produção é criado com o mesmo script, apontando para o banco do Neon. A partir de `server/`, cole a URL do Neon quando o terminal pedir (ela não aparece na tela nem fica no histórico):

```bash
read -rsp "URL do banco do Neon: " DATABASE_URL && export DATABASE_URL && echo
```

```bash
node scripts/criarVendedor.ts --nome "Seu Nome" --email voce@loja.com
```

```bash
unset DATABASE_URL
```
