import { digitosDoTelefone, type ClienteValidado } from "@globomotors/shared";
import { desc, eq, getTableColumns, ilike, like, or, sql } from "drizzle-orm";
import type { Banco } from "../db/banco.ts";
import { clientes, interesses } from "../db/schema.ts";
import { escaparLike, primeiro, traduzirRestricoes } from "./utilitarios.ts";

const colunas = {
  ...getTableColumns(clientes),
  interesses: sql<number>`(
    select count(*)::int from ${interesses} where ${eq(interesses.clienteId, clientes.id)}
  )`,
};

const traduzir = traduzirRestricoes({
  clientes_telefone_unique: {
    campo: "telefone",
    mensagem: "Já existe um cliente com este telefone.",
  },
});

export function criarRepositorioClientes(db: Banco) {
  async function buscar(id: string) {
    const [cliente] = await db.select(colunas).from(clientes).where(eq(clientes.id, id));
    return cliente ?? null;
  }

  return {
    buscar,

    listar(busca: string) {
      const termo = busca.trim();
      const telefone = /^[\d\s().+-]+$/.test(termo) ? digitosDoTelefone(termo) : "";
      const padrao = `%${escaparLike(termo)}%`;
      return db
        .select(colunas)
        .from(clientes)
        .where(
          termo === ""
            ? undefined
            : or(
                ilike(clientes.nome, padrao),
                ilike(clientes.email, padrao),
                telefone === "" ? undefined : like(clientes.telefone, `%${telefone}%`),
              ),
        )
        .orderBy(desc(clientes.criadoEm));
    },

    async criar(dados: ClienteValidado) {
      const linhas = await db.insert(clientes).values(dados).returning().catch(traduzir);
      return { ...primeiro(linhas), interesses: 0 };
    },

    async atualizar(id: string, dados: ClienteValidado) {
      const [cliente] = await db
        .update(clientes)
        .set(dados)
        .where(eq(clientes.id, id))
        .returning({ id: clientes.id })
        .catch(traduzir);
      return cliente ? buscar(cliente.id) : null;
    },

    async apagar(id: string) {
      const [cliente] = await db
        .delete(clientes)
        .where(eq(clientes.id, id))
        .returning({ id: clientes.id });
      return cliente ?? null;
    },
  };
}

export type LinhaCliente = NonNullable<
  Awaited<ReturnType<ReturnType<typeof criarRepositorioClientes>["buscar"]>>
>;
