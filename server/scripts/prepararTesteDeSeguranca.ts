import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { lerConfig } from "../src/config.ts";
import { criarBanco } from "../src/db/banco.ts";
import { criarRepositorios } from "../src/repositorios/index.ts";
import { cadastrarVendedor, mensagemDoErro } from "./vendedor.ts";

const API = `http://localhost:${process.env.PORT ?? "3001"}/api`;
const WEB = "http://localhost:5173";
const SENHA = "teste123";
const sufixo = randomUUID().slice(0, 6);

interface OpcoesRequisicao {
  corpo?: unknown;
  cookie?: string;
  origem?: string;
}

async function requisitar(metodo: string, caminho: string, opcoes: OpcoesRequisicao = {}) {
  const { corpo, cookie = "", origem } = opcoes;
  return fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      cookie,
      ...(corpo !== undefined && { "content-type": "application/json" }),
      ...(origem && { "sec-fetch-site": origem }),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  }).catch((erro: unknown) => {
    throw new Error(`A API não respondeu em ${API}. Suba-a com npm run dev na raiz.`, {
      cause: erro,
    });
  });
}

function entrar(email: string, senha: string) {
  return requisitar("POST", "/auth/login", { corpo: { email, senha } });
}

function conferir(passou: boolean, descricao: string) {
  if (!passou) throw new Error(`Falhou: ${descricao}`);
  console.log(`✓ ${descricao}`);
}

async function liberarLogin() {
  const { db, pool } = criarBanco(lerConfig(process.env).DATABASE_URL);
  try {
    await criarRepositorios(db).tentativasLogin.apagarExpiradas(new Date("9999-12-31"));
  } finally {
    await pool.end();
  }
}

async function prepararTesteDeSeguranca() {
  const { values } = parseArgs({ options: { liberar: { type: "boolean" } } });
  await liberarLogin();
  if (values.liberar) {
    console.log("Login liberado: os contadores de tentativas foram zerados.");
    return;
  }

  const email = `seguranca.${sufixo}@globomotors.test`;
  await cadastrarVendedor({ nome: "Vendedor Segurança", email, senha: SENHA });

  const login = await entrar(email, SENHA);
  conferir(login.status === 200, "login com a senha certa");
  const cookie = login.headers.getSetCookie()[0]?.split(";")[0] ?? "";
  for (const caminho of ["/auth/me", "/dashboard/cars"]) {
    const resposta = await requisitar("GET", caminho, { cookie });
    conferir(
      resposta.status === 200 && resposta.headers.get("cache-control") === "no-store",
      `GET /api${caminho} responde sem cache`,
    );
  }

  const deOutroSite = await requisitar("POST", "/auth/logout", { cookie, origem: "cross-site" });
  conferir(deOutroSite.status === 403, "logout vindo de outro site recusado com 403");
  const sessao = await requisitar("GET", "/auth/me", { cookie });
  conferir(sessao.status === 200, "a sessão continua válida depois da tentativa de fora");

  const respostas: number[] = [];
  for (let tentativa = 1; tentativa <= 10; tentativa++) {
    respostas.push((await entrar(`intruso.${sufixo}@globomotors.test`, "errada123")).status);
  }
  conferir(
    respostas.every((status) => status === 401),
    "10 senhas erradas recusadas com 401",
  );
  const bloqueada = await entrar(email, SENHA);
  const { erro } = (await bloqueada.json()) as { erro?: { mensagem: string } };
  const segundos = Number(bloqueada.headers.get("retry-after"));
  conferir(
    bloqueada.status === 429 && segundos > 0 && segundos <= 900,
    `11ª tentativa do mesmo IP bloqueada mesmo com a senha certa (429, Retry-After ${segundos} s): "${erro?.mensagem ?? ""}"`,
  );

  await liberarLogin();
  conferir((await entrar(email, SENHA)).status === 200, "login liberado pelo script");

  console.log(`
Teste de segurança pronto (sufixo ${sufixo}).

Entrar              ${WEB}/login
  e-mail            ${email}
  senha             ${SENHA}
Carros do painel    ${WEB}/dashboard/cars

Para desbloquear o login depois do teste manual, sem esperar 15 min (a partir de server/):
node --env-file-if-exists=.env scripts/prepararTesteDeSeguranca.ts --liberar
`);
}

try {
  await prepararTesteDeSeguranca();
} catch (erro) {
  console.error(mensagemDoErro(erro));
  process.exitCode = 1;
}
