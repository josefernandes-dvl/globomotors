import { cp, rm, writeFile } from "node:fs/promises";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import helmet from "helmet";
import { opcoesHelmet } from "../src/app.ts";
import { criarBanco } from "../src/db/banco.ts";
import { migrar } from "../src/db/migrar.ts";

const ENTRADA_DA_FUNCAO = fileURLToPath(new URL("../src/vercel.ts", import.meta.url));

export function cabecalhosDoHelmet() {
  const resposta = new ServerResponse(new IncomingMessage(new Socket()));
  helmet(opcoesHelmet)(resposta.req, resposta, () => undefined);
  return Object.fromEntries(
    Object.entries(resposta.getHeaders()).map(([nome, valor]) => [nome, String(valor)]),
  );
}

export function rotasDaVercel() {
  return [
    { src: "^/(?!api(?:/|$)).*$", headers: cabecalhosDoHelmet(), continue: true },
    { src: "^/api(?:/.*)?$", dest: "/api" },
    { handle: "filesystem" },
    { src: "^/assets/.*$", status: 404 },
    { src: "^/.*$", dest: "/index.html" },
    { handle: "hit" },
    {
      src: "^/assets/.*$",
      headers: { "cache-control": "public, max-age=31536000, immutable" },
      continue: true,
    },
  ];
}

export async function montarSaidaVercel({
  pastaWeb,
  pastaSaida,
}: {
  pastaWeb: string;
  pastaSaida: string;
}) {
  const pastaFuncao = join(pastaSaida, "functions/api.func");
  await rm(pastaSaida, { recursive: true, force: true });
  await build({
    entryPoints: [ENTRADA_DA_FUNCAO],
    outfile: join(pastaFuncao, "index.mjs"),
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    external: ["pg-native"],
    banner: {
      js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
    },
  });
  await writeFile(
    join(pastaFuncao, ".vc-config.json"),
    JSON.stringify(
      {
        runtime: "nodejs24.x",
        handler: "index.mjs",
        launcherType: "Nodejs",
        regions: ["gru1"],
        maxDuration: 60,
      },
      null,
      2,
    ),
  );
  await cp(pastaWeb, join(pastaSaida, "static"), { recursive: true });
  await writeFile(
    join(pastaSaida, "config.json"),
    JSON.stringify({ version: 3, routes: rotasDaVercel() }, null, 2),
  );
}

export async function migrarNoDeploy(env: NodeJS.ProcessEnv) {
  if (env.VERCEL_ENV !== "production") return false;
  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Sem DATABASE_URL no deploy de produção: conecte o banco Neon ao projeto na aba Storage da Vercel.",
    );
  }
  const { db, pool } = criarBanco(url);
  try {
    await migrar(db);
  } finally {
    await pool.end();
  }
  return true;
}
