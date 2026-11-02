import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer, type AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { expect, it } from "vitest";
import { PASTA_MIGRATIONS } from "./db/migrar.ts";
import { criarBancoDeTeste } from "./testes/bancoDeTeste.ts";

const pastaServer = fileURLToPath(new URL("..", import.meta.url));

async function portaLivre(): Promise<number> {
  const servidor = createServer().listen(0);
  await once(servidor, "listening");
  const { port } = servidor.address() as AddressInfo;
  servidor.close();
  return port;
}

async function aguardarResposta(url: string, processo: ChildProcess, saida: () => string) {
  const limite = Date.now() + 15_000;
  while (Date.now() < limite) {
    if (processo.exitCode !== null) {
      throw new Error(`O servidor encerrou antes de responder:\n${saida()}`);
    }
    try {
      return await fetch(url);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`O servidor não respondeu em 15s:\n${saida()}`);
}

it("sobe com `node src/index.ts`, aplica as migrations, responde e encerra limpo no SIGTERM", async () => {
  const banco = await criarBancoDeTeste({ migrar: false });
  const porta = await portaLivre();
  let saida = "";
  const processo = spawn(process.execPath, ["src/index.ts"], {
    cwd: pastaServer,
    env: { ...process.env, NODE_ENV: "test", DATABASE_URL: banco.url, PORT: String(porta) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  processo.stdout.on("data", (pedaco) => (saida += String(pedaco)));
  processo.stderr.on("data", (pedaco) => (saida += String(pedaco)));

  try {
    const resposta = await aguardarResposta(
      `http://127.0.0.1:${porta}/api/health`,
      processo,
      () => saida,
    );
    expect(resposta.status).toBe(200);

    const { rows } = await banco.pool.query<{ total: number }>(
      "select count(*)::int as total from drizzle.__drizzle_migrations",
    );
    expect(rows[0]?.total).toBe(readMigrationFiles({ migrationsFolder: PASTA_MIGRATIONS }).length);

    processo.kill("SIGTERM");
    const [codigo] = (await once(processo, "exit")) as [number | null];
    expect(codigo, saida).toBe(0);
  } finally {
    processo.kill("SIGKILL");
    await banco.destruir();
  }
});
