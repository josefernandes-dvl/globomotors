import { fileURLToPath } from "node:url";
import { criarApp } from "./app.ts";
import { lerConfig } from "./config.ts";
import { criarBanco } from "./db/banco.ts";
import { migrar } from "./db/migrar.ts";
import { criarLogger } from "./logger.ts";
import { criarRepositorios } from "./repositorios/index.ts";

const config = lerConfig(process.env);
const logger = criarLogger(config);
const { db, pool } = criarBanco(config.DATABASE_URL);
pool.on("error", (erro) => logger.error({ err: erro }, "Erro no pool do Postgres"));

try {
  await migrar(db);
} catch (erro) {
  await pool.end();
  throw new Error("Não foi possível preparar o banco. O Postgres local está pronto? (README)", {
    cause: erro,
  });
}

const app = criarApp({
  repositorios: criarRepositorios(db),
  logger,
  pastaWeb:
    config.NODE_ENV === "production"
      ? fileURLToPath(new URL("../../web/dist", import.meta.url))
      : undefined,
  cookieSeguro: config.NODE_ENV === "production",
  confiarEmProxy: config.TRUST_PROXY,
});

const servidor = app.listen(config.PORT, (erro) => {
  if (erro) throw erro;
  logger.info(`API ouvindo em http://localhost:${config.PORT}`);
});

function encerrar(sinal: NodeJS.Signals) {
  logger.info(`${sinal} recebido, encerrando`);
  servidor.close(() => {
    pool.end().catch((erro: unknown) => logger.error({ err: erro }, "Erro ao fechar o pool"));
  });
}

process.once("SIGTERM", encerrar);
process.once("SIGINT", encerrar);
