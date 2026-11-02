import { Client } from "pg";

const portaApi = process.env.PORT ?? "3001";

function verificarNode() {
  const [maior = 0] = process.versions.node.split(".").map(Number);
  if (maior < 24) throw new Error(`Node ${process.versions.node}; use o Node 24 (nvm use)`);
  return `Node ${process.versions.node}`;
}

async function verificarBanco() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida (crie server/.env)");
  const cliente = new Client({ connectionString: url, connectionTimeoutMillis: 3_000 });
  try {
    await cliente.connect();
    const { rows } = await cliente.query<{ server_version: string }>("show server_version");
    return `Postgres ${rows[0]?.server_version} em ${new URL(url).host}`;
  } catch (erro) {
    throw new Error(`Postgres inacessível (veja o README): ${String(erro)}`, { cause: erro });
  } finally {
    await cliente.end();
  }
}

async function verificarSaude(url: string) {
  const resposta = await fetch(url, { signal: AbortSignal.timeout(3_000) }).catch(() => {
    throw new Error(`${url} não respondeu (npm run dev)`);
  });
  if (!resposta.ok) throw new Error(`${url} respondeu ${resposta.status}`);
  return `${url} ok`;
}

const verificacoes = [
  ["Node", verificarNode],
  ["Banco", verificarBanco],
  ["API", () => verificarSaude(`http://localhost:${portaApi}/api/health`)],
  ["Web + proxy", () => verificarSaude("http://localhost:5173/api/health")],
] as const;

let falhas = 0;
for (const [nome, verificar] of verificacoes) {
  try {
    console.log(`✓ ${nome}: ${await verificar()}`);
  } catch (erro) {
    falhas++;
    console.log(`✗ ${nome}: ${erro instanceof Error ? erro.message : String(erro)}`);
  }
}
process.exitCode = falhas > 0 ? 1 : 0;
