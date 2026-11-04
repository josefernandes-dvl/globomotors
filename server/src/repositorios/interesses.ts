import type { EtapaFunil } from "@globomotors/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Banco } from "../db/banco.ts";
import { carros, clientes, desejos, fotosCarro, interesses } from "../db/schema.ts";
import { primeiro, traduzirRestricoes } from "./utilitarios.ts";

const colunas = {
  id: interesses.id,
  etapa: interesses.etapa,
  motivoPerda: interesses.motivoPerda,
  criadoEm: interesses.criadoEm,
  atualizadoEm: interesses.atualizadoEm,
  cliente: { id: clientes.id, nome: clientes.nome, telefone: clientes.telefone },
  carro: {
    id: carros.id,
    marca: carros.marca,
    modelo: carros.modelo,
    versao: carros.versao,
    anoModelo: carros.anoModelo,
    status: carros.status,
    capa: sql<string | null>`(
      select ${fotosCarro.id}::text from ${fotosCarro}
      where ${eq(fotosCarro.carroId, carros.id)} order by ${fotosCarro.ordem} limit 1
    )`,
  },
};

const traduzir = traduzirRestricoes({
  interesses_cliente_id_carro_id_unique: {
    mensagem: "Este cliente já está interessado neste veículo.",
  },
  interesses_cliente_id_clientes_id_fk: { mensagem: "Cliente não encontrado." },
  interesses_carro_id_carros_id_fk: { mensagem: "Veículo não encontrado." },
});

export function criarRepositorioInteresses(db: Banco) {
  function consultar() {
    return db
      .select(colunas)
      .from(interesses)
      .innerJoin(clientes, eq(clientes.id, interesses.clienteId))
      .innerJoin(carros, eq(carros.id, interesses.carroId));
  }

  async function buscar(id: string) {
    const [interesse] = await consultar().where(eq(interesses.id, id));
    return interesse ?? null;
  }

  return {
    listar(filtro: { carroId?: string | undefined; clienteId?: string | undefined }) {
      return consultar()
        .where(
          and(
            filtro.carroId === undefined ? undefined : eq(interesses.carroId, filtro.carroId),
            filtro.clienteId === undefined ? undefined : eq(interesses.clienteId, filtro.clienteId),
          ),
        )
        .orderBy(desc(interesses.atualizadoEm));
    },

    async criar(dados: { clienteId: string; carroId: string }) {
      const linhas = await db
        .insert(interesses)
        .values(dados)
        .returning({ id: interesses.id })
        .catch(traduzir);
      return primeiro(await consultar().where(eq(interesses.id, primeiro(linhas).id)));
    },

    async atender(desejoId: string, carroId: string) {
      const clienteId = await db.transaction(async (tx) => {
        const [desejo] = await tx
          .delete(desejos)
          .where(eq(desejos.id, desejoId))
          .returning({ clienteId: desejos.clienteId });
        if (!desejo) return null;
        await tx
          .insert(interesses)
          .values({ clienteId: desejo.clienteId, carroId, etapa: "em_contato" })
          .onConflictDoUpdate({
            target: [interesses.clienteId, interesses.carroId],
            set: { etapa: "em_contato", motivoPerda: null },
            setWhere: inArray(interesses.etapa, ["novo", "perdido"]),
          })
          .catch(traduzir);
        return desejo.clienteId;
      });
      if (clienteId === null) return null;
      return primeiro(
        await consultar().where(
          and(eq(interesses.clienteId, clienteId), eq(interesses.carroId, carroId)),
        ),
      );
    },

    async atualizar(id: string, dados: { etapa: EtapaFunil; motivoPerda: string | null }) {
      const [interesse] = await db
        .update(interesses)
        .set(dados)
        .where(eq(interesses.id, id))
        .returning({ id: interesses.id });
      return interesse ? buscar(interesse.id) : null;
    },

    async apagar(id: string) {
      const [interesse] = await db
        .delete(interesses)
        .where(eq(interesses.id, id))
        .returning({ id: interesses.id });
      return interesse ?? null;
    },
  };
}

export type LinhaInteresse = NonNullable<
  Awaited<ReturnType<ReturnType<typeof criarRepositorioInteresses>["atualizar"]>>
>;
