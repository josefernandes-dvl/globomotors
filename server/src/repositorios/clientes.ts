import { digitosDoTelefone, type ClienteValidado } from "@globomotors/shared";
import { desc, eq, getTableColumns, ilike, inArray, like, or, sql } from "drizzle-orm";
import type { Banco } from "../db/banco.ts";
import { clientes, desejos, interesses } from "../db/schema.ts";
import { escaparLike, primeiro, traduzirRestricoes } from "./utilitarios.ts";

type Transacao = Parameters<Parameters<Banco["transaction"]>[0]>[0];

const colunas = {
  ...getTableColumns(clientes),
  desejos: sql<string[]>`coalesce((
    select array_agg(${desejos.nome} order by ${desejos.ordem})
    from ${desejos} where ${eq(desejos.clienteId, clientes.id)}
  ), '{}')`,
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

async function sincronizarDesejos(tx: Transacao, clienteId: string, nomes: string[]) {
  const atuais = await tx
    .select({ id: desejos.id, nome: desejos.nome })
    .from(desejos)
    .where(eq(desejos.clienteId, clienteId));
  const mantidos = new Set(nomes.map((nome) => nome.toLowerCase()));
  const existentes = new Set(atuais.map(({ nome }) => nome.toLowerCase()));
  const saem = atuais.filter(({ nome }) => !mantidos.has(nome.toLowerCase())).map(({ id }) => id);
  const entram = nomes.filter((nome) => !existentes.has(nome.toLowerCase()));
  if (saem.length > 0) await tx.delete(desejos).where(inArray(desejos.id, saem));
  if (entram.length > 0) {
    await tx.insert(desejos).values(entram.map((nome) => ({ clienteId, nome })));
  }
}

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

    async criar({ desejos: nomes, ...dados }: ClienteValidado) {
      const cliente = await db.transaction(async (tx) => {
        const criado = primeiro(
          await tx.insert(clientes).values(dados).returning().catch(traduzir),
        );
        await sincronizarDesejos(tx, criado.id, nomes);
        return criado;
      });
      return { ...cliente, desejos: nomes, interesses: 0 };
    },

    async atualizar(id: string, { desejos: nomes, ...dados }: ClienteValidado) {
      const cliente = await db.transaction(async (tx) => {
        const [atualizado] = await tx
          .update(clientes)
          .set(dados)
          .where(eq(clientes.id, id))
          .returning({ id: clientes.id })
          .catch(traduzir);
        if (atualizado) await sincronizarDesejos(tx, atualizado.id, nomes);
        return atualizado;
      });
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
