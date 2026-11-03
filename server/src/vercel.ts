import { attachDatabasePool } from "@vercel/functions/db-connections";
import { criarApp } from "./app.ts";
import { lerConfig } from "./config.ts";
import { criarBanco } from "./db/banco.ts";
import { criarIa } from "./ia.ts";
import { criarLogger } from "./logger.ts";
import { criarRepositorios } from "./repositorios/index.ts";

const config = lerConfig(process.env);
const logger = criarLogger({ NODE_ENV: "production", LOG_LEVEL: config.LOG_LEVEL });
const { db, pool } = criarBanco(config.DATABASE_URL);
pool.on("error", (erro) => logger.error({ err: erro }, "Erro no pool do Postgres"));
attachDatabasePool(pool);

export default criarApp({
  repositorios: criarRepositorios(db),
  logger,
  cookieSeguro: true,
  confiarEmProxy: 1,
  ia: criarIa(config),
});
