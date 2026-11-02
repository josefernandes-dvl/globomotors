import {
  hojeEmSaoPaulo,
  type CarroValidado,
  type StatusCarro,
  type StatusPublico,
} from "@globomotors/shared";
import { and, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { Banco } from "../db/banco.ts";
import { carros, fotosCarro, interesses } from "../db/schema.ts";
import { gerarSlug } from "../slug.ts";
import { primeiro, traduzirRestricoes } from "./utilitarios.ts";

const idsDasFotos = sql<string[]>`coalesce((
  select array_agg(${fotosCarro.id}::text order by ${fotosCarro.ordem})
  from ${fotosCarro} where ${eq(fotosCarro.carroId, carros.id)}
), '{}')`;

const colunasDoPainel = {
  ...getTableColumns(carros),
  fotos: idsDasFotos,
  interessados: sql<number>`(
    select count(*)::int from ${interesses} where ${eq(interesses.carroId, carros.id)}
  )`,
};

const colunasDaVitrine = {
  slug: carros.slug,
  marca: carros.marca,
  modelo: carros.modelo,
  versao: carros.versao,
  anoFabricacao: carros.anoFabricacao,
  anoModelo: carros.anoModelo,
  km: carros.km,
  cambio: carros.cambio,
  combustivel: carros.combustivel,
  carroceria: carros.carroceria,
  cor: carros.cor,
  motor: carros.motor,
  portas: carros.portas,
  opcionais: carros.opcionais,
  descricao: carros.descricao,
  precoVenda: carros.precoVenda,
  status: sql<StatusPublico>`${carros.status}`,
  destaque: carros.destaque,
  fotos: idsDasFotos,
};

const traduzir = traduzirRestricoes({
  carros_placa_unique: { campo: "placa", mensagem: "Já existe um carro com esta placa." },
  carros_chassi_unique: { campo: "chassi", mensagem: "Já existe um carro com este chassi." },
  carros_renavam_unique: { campo: "renavam", mensagem: "Já existe um carro com este Renavam." },
});

function dataDaVenda(status: StatusCarro) {
  return status === "vendido"
    ? sql`coalesce(${carros.vendidoEm}, ${new Date().toISOString()}::timestamptz)`
    : null;
}

export function criarRepositorioCarros(db: Banco) {
  async function buscarPainel(id: string) {
    const [carro] = await db.select(colunasDoPainel).from(carros).where(eq(carros.id, id));
    return carro ?? null;
  }

  return {
    buscarPainel,

    listarPainel() {
      return db.select(colunasDoPainel).from(carros).orderBy(desc(carros.criadoEm));
    },

    async criar({ dataEntrada, ...dados }: CarroValidado) {
      const linhas = await db
        .insert(carros)
        .values({
          ...dados,
          slug: gerarSlug([dados.marca, dados.modelo, dados.versao, dados.anoModelo]),
          dataEntrada: dataEntrada ?? hojeEmSaoPaulo(),
          vendidoEm: dados.status === "vendido" ? new Date() : null,
        })
        .returning()
        .catch(traduzir);
      return { ...primeiro(linhas), fotos: [] as string[], interessados: 0 };
    },

    async atualizar(id: string, dados: CarroValidado) {
      const [carro] = await db
        .update(carros)
        .set({ ...dados, vendidoEm: dataDaVenda(dados.status) })
        .where(eq(carros.id, id))
        .returning({ id: carros.id })
        .catch(traduzir);
      return carro ? buscarPainel(carro.id) : null;
    },

    async alterarStatus(id: string, status: StatusCarro) {
      const [carro] = await db
        .update(carros)
        .set({ status, vendidoEm: dataDaVenda(status) })
        .where(eq(carros.id, id))
        .returning({ id: carros.id });
      return carro ? buscarPainel(carro.id) : null;
    },

    async apagar(id: string) {
      const [carro] = await db.delete(carros).where(eq(carros.id, id)).returning({ id: carros.id });
      return carro ?? null;
    },

    listarPublicos(status: StatusPublico[]) {
      return db
        .select(colunasDaVitrine)
        .from(carros)
        .where(inArray(carros.status, status))
        .orderBy(desc(carros.criadoEm));
    },

    async buscarPublico(slug: string, status: StatusPublico[]) {
      const [carro] = await db
        .select(colunasDaVitrine)
        .from(carros)
        .where(and(eq(carros.slug, slug), inArray(carros.status, status)));
      return carro ?? null;
    },
  };
}

type RepositorioCarros = ReturnType<typeof criarRepositorioCarros>;
export type LinhaCarroPainel = Awaited<ReturnType<RepositorioCarros["listarPainel"]>>[number];
export type LinhaCarroVitrine = Awaited<ReturnType<RepositorioCarros["listarPublicos"]>>[number];
