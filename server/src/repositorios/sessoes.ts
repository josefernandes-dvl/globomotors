import { and, eq, gt, lte, sql } from "drizzle-orm";
import type { Banco } from "../db/banco.ts";
import { sessoes, usuarios } from "../db/schema.ts";

export function criarRepositorioSessoes(db: Banco) {
  return {
    async criar(sessao: { usuarioId: string; tokenHash: string; expiraEm: Date }) {
      await db.insert(sessoes).values(sessao);
    },

    async buscarUsuario(tokenHash: string) {
      const [usuario] = await db
        .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email })
        .from(sessoes)
        .innerJoin(usuarios, eq(usuarios.id, sessoes.usuarioId))
        .where(and(eq(sessoes.tokenHash, tokenHash), gt(sessoes.expiraEm, sql`now()`)));
      return usuario ?? null;
    },

    async apagar(tokenHash: string) {
      await db.delete(sessoes).where(eq(sessoes.tokenHash, tokenHash));
    },

    async apagarExpiradas(usuarioId: string) {
      await db
        .delete(sessoes)
        .where(and(eq(sessoes.usuarioId, usuarioId), lte(sessoes.expiraEm, sql`now()`)));
    },
  };
}
