import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Banco } from "./banco.ts";

export const PASTA_MIGRATIONS = fileURLToPath(new URL("../../drizzle", import.meta.url));

export async function migrar(db: Banco): Promise<void> {
  await migrate(db, { migrationsFolder: PASTA_MIGRATIONS });
}
