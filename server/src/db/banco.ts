import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

export function criarBanco(url: string) {
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5_000 });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  return { db, pool };
}

export type Banco = ReturnType<typeof criarBanco>["db"];
