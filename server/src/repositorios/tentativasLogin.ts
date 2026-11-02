import { inArray, lte, sql } from "drizzle-orm";
import type { Banco } from "../db/banco.ts";
import { tentativasLogin } from "../db/schema.ts";
import { primeiro } from "./utilitarios.ts";

export function criarRepositorioTentativasLogin(db: Banco) {
  return {
    async registrar(chave: string, agora: Date, janelaMs: number) {
      const vigente = sql`${tentativasLogin.expiraEm} > ${agora}`;
      const linhas = await db
        .insert(tentativasLogin)
        .values({ chave, tentativas: 1, expiraEm: new Date(agora.getTime() + janelaMs) })
        .onConflictDoUpdate({
          target: tentativasLogin.chave,
          set: {
            tentativas: sql`case when ${vigente} then ${tentativasLogin.tentativas} + 1 else 1 end`,
            expiraEm: sql`case when ${vigente} then ${tentativasLogin.expiraEm} else excluded.expira_em end`,
          },
        })
        .returning({ tentativas: tentativasLogin.tentativas, expiraEm: tentativasLogin.expiraEm });
      return primeiro(linhas);
    },

    async limpar(chaves: string[]) {
      await db.delete(tentativasLogin).where(inArray(tentativasLogin.chave, chaves));
    },

    async apagarExpiradas(agora: Date) {
      await db.delete(tentativasLogin).where(lte(tentativasLogin.expiraEm, agora));
    },
  };
}
