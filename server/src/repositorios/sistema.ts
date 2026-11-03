import { sql } from "drizzle-orm";
import type { Banco } from "../db/banco.ts";
import { carros, clientes, tentativasLogin, usuarios } from "../db/schema.ts";
import { primeiro } from "./utilitarios.ts";

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

    zerar(vendedor: { nome: string; email: string; senhaHash: string }) {
      return db.transaction(async (tx) => {
        await tx.delete(carros);
        await tx.delete(clientes);
        await tx.delete(usuarios);
        await tx.delete(tentativasLogin);
        return primeiro(
          await tx
            .insert(usuarios)
            .values(vendedor)
            .returning({ nome: usuarios.nome, email: usuarios.email }),
        );
      });
    },
  };
}
