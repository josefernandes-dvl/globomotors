import {
  normalizarTexto,
  type Carroceria,
  type CarroPublico,
  type StatusCarro,
} from "@globomotors/shared";
import { formatarAnos } from "./formatacao.ts";

export const ROTULOS_ORDEM = {
  recentes: "Mais recentes",
  destaque: "Destaques",
  precoAsc: "Menor preço",
  precoDesc: "Maior preço",
  ano: "Mais novos",
  km: "Menor km",
} as const;

export type Ordem = keyof typeof ROTULOS_ORDEM;

export const ORDENS_VITRINE: Ordem[] = ["destaque", "precoAsc", "precoDesc", "ano", "km"];
export const ORDENS_PAINEL: Ordem[] = ["recentes", "precoAsc", "precoDesc", "ano", "km"];

const ABAS_ESPECIAIS = [
  { valor: "Scooter", rotulo: "Scooters" },
  { valor: "Moto elétrica", rotulo: "Motos elétricas" },
  { valor: "Patinete", rotulo: "Patinetes" },
] as const satisfies readonly { valor: Carroceria; rotulo: string }[];

const ABAS_DE_TIPO = [
  { valor: "carros", rotulo: "Carros" },
  { valor: "Moto", rotulo: "Motos" },
  ...ABAS_ESPECIAIS,
] as const;

export type AbaDoCatalogo = (typeof ABAS_DE_TIPO)[number]["valor"] | null;

const ESPECIAIS = new Set<string | null>(ABAS_ESPECIAIS.map(({ valor }) => valor));

function abaDoVeiculo({ carroceria }: { carroceria: string | null }) {
  return ABAS_DE_TIPO.find(({ valor }) => valor === carroceria)?.valor ?? "carros";
}

export const LIMITES_DE_PRECO = [
  3_000_000, 5_000_000, 7_000_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000,
];
export const LIMITES_DE_KM = [10_000, 30_000, 50_000, 80_000, 100_000, 150_000];

export interface FiltrosVitrine {
  marca: string;
  carrocerias: string[];
  cambios: string[];
  combustiveis: string[];
  precoMaximo: number | null;
  anoMinimo: number | null;
  kmMaximo: number | null;
}

export const FILTROS_VAZIOS: FiltrosVitrine = {
  marca: "",
  carrocerias: [],
  cambios: [],
  combustiveis: [],
  precoMaximo: null,
  anoMinimo: null,
  kmMaximo: null,
};

interface CarroDoCatalogo {
  marca: string;
  modelo: string;
  versao: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
  km: number | null;
  cambio: string | null;
  combustivel: string | null;
  carroceria: string | null;
  cor: string | null;
  motor: string | null;
  opcionais: string[];
  destaque: boolean;
  status: StatusCarro;
}

export function combinaComBusca(
  carro: CarroDoCatalogo,
  busca: string,
  ...extras: (string | null)[]
) {
  const termos = normalizarTexto(busca).split(/\s+/).filter(Boolean);
  const texto = normalizarTexto(
    [
      carro.marca,
      carro.modelo,
      carro.versao,
      carro.cor,
      formatarAnos(carro),
      carro.cambio,
      carro.combustivel,
      carro.carroceria,
      carro.motor,
      ...carro.opcionais,
      ...extras,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return termos.every((termo) => texto.includes(termo));
}

function anoDe(carro: { anoModelo: number | null; anoFabricacao: number | null }) {
  return carro.anoModelo ?? carro.anoFabricacao;
}

function contem(selecionados: string[], valor: string | null) {
  return selecionados.length === 0 || (valor !== null && selecionados.includes(valor));
}

function ate(valor: number | null, limite: number | null) {
  return limite === null || (valor !== null && valor <= limite);
}

export function filtrarCarros(carros: CarroPublico[], filtros: FiltrosVitrine) {
  return carros.filter(
    (carro) =>
      (!filtros.marca || carro.marca === filtros.marca) &&
      contem(filtros.carrocerias, carro.carroceria) &&
      contem(filtros.cambios, carro.cambio) &&
      contem(filtros.combustiveis, carro.combustivel) &&
      ate(carro.preco, filtros.precoMaximo) &&
      ate(carro.km, filtros.kmMaximo) &&
      (filtros.anoMinimo === null || (anoDe(carro) ?? 0) >= filtros.anoMinimo),
  );
}

export function contarFiltros(filtros: FiltrosVitrine) {
  return (
    filtros.carrocerias.length +
    filtros.cambios.length +
    filtros.combustiveis.length +
    [filtros.precoMaximo, filtros.anoMinimo, filtros.kmMaximo].filter((valor) => valor !== null)
      .length
  );
}

export function opcoesPresentes<V extends string>(opcoes: readonly V[], valores: (V | null)[]) {
  const presentes = new Set(valores);
  return opcoes.filter((opcao) => presentes.has(opcao));
}

export function limitesUteis(limites: number[], valores: (number | null)[]) {
  const conhecidos = valores.filter((valor) => valor !== null);
  return limites.filter(
    (limite) =>
      conhecidos.some((valor) => valor <= limite) && conhecidos.some((valor) => valor > limite),
  );
}

export function anosUteis(carros: { anoModelo: number | null; anoFabricacao: number | null }[]) {
  const anos = new Set(carros.map(anoDe).filter((ano) => ano !== null));
  return [...anos].sort((a, b) => b - a).slice(0, -1);
}

export function marcasDe(carros: { marca: string }[]) {
  return [...new Set(carros.map((carro) => carro.marca))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

export function ordenarCarros<T extends CarroDoCatalogo>(
  carros: T[],
  ordem: Ordem,
  precoDe: (carro: T) => number | null,
) {
  const comparadores: Record<Ordem, (a: T, b: T) => number> = {
    recentes: () => 0,
    destaque: (a, b) =>
      Number(a.status === "vendido") - Number(b.status === "vendido") ||
      Number(b.destaque) - Number(a.destaque),
    precoAsc: (a, b) => (precoDe(a) ?? Infinity) - (precoDe(b) ?? Infinity),
    precoDesc: (a, b) => (precoDe(b) ?? -Infinity) - (precoDe(a) ?? -Infinity),
    ano: (a, b) => (anoDe(b) ?? 0) - (anoDe(a) ?? 0),
    km: (a, b) => (a.km ?? Infinity) - (b.km ?? Infinity),
  };
  const especial = (carro: T) => Number(ESPECIAIS.has(carro.carroceria));
  return carros.toSorted((a, b) => especial(a) - especial(b) || comparadores[ordem](a, b));
}

export function abasDoCatalogo<T extends { carroceria: string | null }>(
  carros: T[],
  escolhida: AbaDoCatalogo,
) {
  const presentes = new Set(carros.map(abaDoVeiculo));
  const tipos = ABAS_DE_TIPO.filter(({ valor }) => presentes.has(valor));
  const abas: { valor: AbaDoCatalogo; rotulo: string }[] = [
    { valor: null, rotulo: "Todos" },
    ...(tipos.length > 1 ? tipos : []),
  ];
  const aba = abas.some(({ valor }) => valor === escolhida) ? escolhida : null;
  return {
    abas,
    aba,
    carros: aba === null ? carros : carros.filter((carro) => abaDoVeiculo(carro) === aba),
  };
}
