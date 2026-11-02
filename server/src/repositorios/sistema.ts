import { sql } from "drizzle-orm";
import type { Banco } from "../db/banco.ts";

export function criarRepositorioSistema(db: Banco) {
  return {
    async bancoDisponivel(): Promise<boolean> {
      try {
        await db.execute(sql`select 1`);
        return true;
      } catch {
        return false;
      }
    },
  };
}
