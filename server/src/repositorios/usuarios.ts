import { eq } from "drizzle-orm";
import type { Banco } from "../db/banco.ts";
import { usuarios } from "../db/schema.ts";
import { primeiro, traduzirRestricoes } from "./utilitarios.ts";

const traduzir = traduzirRestricoes({
  usuarios_email_unique: { campo: "email", mensagem: "Já existe um vendedor com este e-mail." },
});

export function criarRepositorioUsuarios(db: Banco) {
  return {
    async criar(dados: { nome: string; email: string; senhaHash: string }) {
      const linhas = await db
        .insert(usuarios)
        .values(dados)
        .returning({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email })
        .catch(traduzir);
      return primeiro(linhas);
    },

    async buscarPorEmail(email: string) {
      const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, email));
      return usuario ?? null;
    },
  };
}
