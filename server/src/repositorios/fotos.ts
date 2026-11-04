import {
  CODIGOS_ERRO,
  MAX_FOTOS_POR_CARRO,
  type StatusPublico,
  type TipoDeFoto,
} from "@globomotors/shared";
import { and, count, eq, inArray, max } from "drizzle-orm";
import type { Banco } from "../db/banco.ts";
import { carros, fotosCarro } from "../db/schema.ts";
import { ErroHttp } from "../erros.ts";
import { primeiro } from "./utilitarios.ts";

type Transacao = Parameters<Parameters<Banco["transaction"]>[0]>[0];

async function travarCarro(tx: Transacao, carroId: string) {
  const [carro] = await tx
    .select({ id: carros.id })
    .from(carros)
    .where(eq(carros.id, carroId))
    .for("update");
  return carro !== undefined;
}

export function criarRepositorioFotos(db: Banco) {
  return {
    adicionar(carroId: string, foto: { tipoMime: TipoDeFoto; dados: Buffer }) {
      return db.transaction(async (tx) => {
        if (!(await travarCarro(tx, carroId))) return null;
        const resumo = primeiro(
          await tx
            .select({ total: count(), ultima: max(fotosCarro.ordem) })
            .from(fotosCarro)
            .where(eq(fotosCarro.carroId, carroId)),
        );
        if (resumo.total >= MAX_FOTOS_POR_CARRO) {
          throw new ErroHttp(
            409,
            CODIGOS_ERRO.CONFLITO,
            `Cada veículo pode ter no máximo ${MAX_FOTOS_POR_CARRO} fotos.`,
          );
        }
        const linhas = await tx
          .insert(fotosCarro)
          .values({ carroId, ordem: (resumo.ultima ?? -1) + 1, ...foto })
          .returning({ id: fotosCarro.id });
        return primeiro(linhas);
      });
    },

    reordenar(carroId: string, ordem: string[]) {
      return db.transaction(async (tx) => {
        if (!(await travarCarro(tx, carroId))) return null;
        const atuais = await tx
          .select({ id: fotosCarro.id })
          .from(fotosCarro)
          .where(eq(fotosCarro.carroId, carroId));
        const ids = new Set(atuais.map((foto) => foto.id));
        if (ordem.length !== ids.size || !ordem.every((id) => ids.has(id))) {
          const mensagem = "Envie todas as fotos do veículo, cada uma uma vez.";
          throw new ErroHttp(400, CODIGOS_ERRO.VALIDACAO, "Dados inválidos.", [
            { campo: "ordem", mensagem },
          ]);
        }
        for (const [indice, id] of ordem.entries()) {
          await tx.update(fotosCarro).set({ ordem: indice }).where(eq(fotosCarro.id, id));
        }
        return ordem;
      });
    },

    async apagar(carroId: string, fotoId: string) {
      const [foto] = await db
        .delete(fotosCarro)
        .where(and(eq(fotosCarro.id, fotoId), eq(fotosCarro.carroId, carroId)))
        .returning({ id: fotosCarro.id });
      return foto ?? null;
    },

    async buscar(id: string) {
      const [foto] = await db
        .select({ tipoMime: fotosCarro.tipoMime, dados: fotosCarro.dados })
        .from(fotosCarro)
        .where(eq(fotosCarro.id, id));
      return foto ?? null;
    },

    async buscarPublica(id: string, status: StatusPublico[]) {
      const [foto] = await db
        .select({ tipoMime: fotosCarro.tipoMime, dados: fotosCarro.dados })
        .from(fotosCarro)
        .innerJoin(carros, eq(carros.id, fotosCarro.carroId))
        .where(and(eq(fotosCarro.id, id), inArray(carros.status, status)));
      return foto ?? null;
    },
  };
}
