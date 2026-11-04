import {
  veiculoCombinaComDesejo,
  type CriterioDeDesejo,
  type DesejoValidado,
} from "@globomotors/shared";
import { asc, desc, eq, getTableColumns, sql } from "drizzle-orm";
import type { Banco } from "../db/banco.ts";
import { carros, clientes, desejos, interesses } from "../db/schema.ts";
import { primeiro, traduzirRestricoes } from "./utilitarios.ts";

const colunasDoVeiculo = {
  id: carros.id,
  marca: carros.marca,
  modelo: carros.modelo,
  versao: carros.versao,
  anoFabricacao: carros.anoFabricacao,
  anoModelo: carros.anoModelo,
  cor: carros.cor,
  cambio: carros.cambio,
  combustivel: carros.combustivel,
  carroceria: carros.carroceria,
  motor: carros.motor,
  opcionais: carros.opcionais,
  precoVenda: carros.precoVenda,
  publicadoEm: carros.publicadoEm,
  criadoEm: carros.criadoEm,
};

const traduzir = traduzirRestricoes({
  desejos_cliente_id_nome_unique: {
    campo: "nome",
    mensagem: "Este cliente já tem este interesse.",
  },
  desejos_cliente_id_clientes_id_fk: { mensagem: "Cliente não encontrado." },
});

type Veiculo = Parameters<typeof veiculoCombinaComDesejo>[0] & { id: string };
type DesejoDoCliente = CriterioDeDesejo & { clienteId: string };

function combina(desejo: DesejoDoCliente, veiculo: Veiculo, funil: Set<string>) {
  return (
    !funil.has(`${desejo.clienteId}:${veiculo.id}`) && veiculoCombinaComDesejo(veiculo, desejo)
  );
}

export function criarRepositorioDesejos(db: Banco) {
  function listarDisponiveis() {
    return db
      .select(colunasDoVeiculo)
      .from(carros)
      .where(eq(carros.status, "disponivel"))
      .orderBy(desc(sql`coalesce(${carros.publicadoEm}, ${carros.criadoEm})`));
  }

  async function paresNoFunil() {
    const pares = await db
      .select({ clienteId: interesses.clienteId, carroId: interesses.carroId })
      .from(interesses);
    return new Set(pares.map(({ clienteId, carroId }) => `${clienteId}:${carroId}`));
  }

  return {
    async listarPorCliente() {
      const [linhas, veiculos, funil] = await Promise.all([
        db
          .select({
            ...getTableColumns(desejos),
            cliente: { id: clientes.id, nome: clientes.nome, telefone: clientes.telefone },
          })
          .from(desejos)
          .innerJoin(clientes, eq(clientes.id, desejos.clienteId))
          .orderBy(asc(desejos.ordem)),
        listarDisponiveis(),
        paresNoFunil(),
      ]);
      const grupos = Map.groupBy(
        linhas.map(({ cliente, ...desejo }) => ({
          cliente,
          desejo: {
            ...desejo,
            possiveis: veiculos.filter((veiculo) => combina(desejo, veiculo, funil)),
          },
        })),
        ({ cliente }) => cliente.id,
      );
      return [...grupos.values()]
        .map((itens) => {
          const desejosDoCliente = itens.map(({ desejo }) => desejo);
          const datas = desejosDoCliente.flatMap(({ possiveis }) =>
            possiveis.map(({ publicadoEm, criadoEm }) => (publicadoEm ?? criadoEm).getTime()),
          );
          return {
            cliente: primeiro(itens).cliente,
            possivelDesde: datas.length > 0 ? new Date(Math.max(...datas)) : null,
            recente: Math.max(...desejosDoCliente.map(({ ordem }) => ordem)),
            desejos: desejosDoCliente,
          };
        })
        .sort(
          (a, b) =>
            (b.possivelDesde?.getTime() ?? 0) - (a.possivelDesde?.getTime() ?? 0) ||
            b.recente - a.recente,
        );
    },

    async criar(dados: DesejoValidado) {
      const linhas = await db.insert(desejos).values(dados).returning().catch(traduzir);
      const desejo = primeiro(linhas);
      const [veiculos, funil] = await Promise.all([listarDisponiveis(), paresNoFunil()]);
      return {
        ...desejo,
        possiveis: veiculos.filter((veiculo) => combina(desejo, veiculo, funil)),
      };
    },

    async apagar(id: string) {
      const [desejo] = await db
        .delete(desejos)
        .where(eq(desejos.id, id))
        .returning({ id: desejos.id });
      return desejo ?? null;
    },

    async contarInteressados(veiculo: Veiculo) {
      const [linhas, funil] = await Promise.all([
        db
          .select({
            clienteId: desejos.clienteId,
            nome: desejos.nome,
            anoMinimo: desejos.anoMinimo,
            precoMaximo: desejos.precoMaximo,
          })
          .from(desejos),
        paresNoFunil(),
      ]);
      return new Set(
        linhas
          .filter((desejo) => combina(desejo, veiculo, funil))
          .map(({ clienteId }) => clienteId),
      ).size;
    },
  };
}

type RepositorioDesejos = ReturnType<typeof criarRepositorioDesejos>;
export type LinhaClienteComDesejos = Awaited<
  ReturnType<RepositorioDesejos["listarPorCliente"]>
>[number];
export type LinhaDesejo = Awaited<ReturnType<RepositorioDesejos["criar"]>>;
