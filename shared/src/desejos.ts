import { z } from "zod";
import {
  corpoInvalido,
  esquemaCentavos,
  listaDeTextos,
  opcional,
  textoObrigatorio,
  textoOpcional,
} from "./campos.ts";
import { esquemaAno } from "./carros.ts";

export const TAMANHO_MAXIMO_DESEJO = 80;

export const esquemaDesejosDoCliente = listaDeTextos(
  "Interesse",
  "interesses",
  TAMANHO_MAXIMO_DESEJO,
  20,
);

export const esquemaDesejo = z.object(
  {
    clienteId: z.uuid({ error: "Escolha um cliente." }),
    nome: textoObrigatorio("o veículo procurado", TAMANHO_MAXIMO_DESEJO),
    anoMinimo: opcional(esquemaAno),
    precoMaximo: opcional(esquemaCentavos),
    observacoes: textoOpcional(500),
  },
  corpoInvalido,
);

export type DadosDesejo = z.input<typeof esquemaDesejo>;
export type DesejoValidado = z.output<typeof esquemaDesejo>;

export const esquemaAtenderDesejo = z.object(
  { carroId: z.uuid({ error: "Escolha um veículo." }) },
  corpoInvalido,
);

export function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const PALAVRAS_IGNORADAS = new Set(["a", "o", "e", "de", "da", "do", "com"]);

function palavras(texto: string) {
  return normalizarTexto(texto).match(/[\p{L}\p{N}]+/gu) ?? [];
}

export interface VeiculoParaDesejo {
  marca: string;
  modelo: string;
  versao: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
  cor: string | null;
  cambio: string | null;
  combustivel: string | null;
  carroceria: string | null;
  motor: string | null;
  opcionais: string[];
  precoVenda: number | null;
}

export interface CriterioDeDesejo {
  nome: string;
  anoMinimo: number | null;
  precoMaximo: number | null;
}

export function veiculoCombinaComDesejo(veiculo: VeiculoParaDesejo, desejo: CriterioDeDesejo) {
  const ano = veiculo.anoModelo ?? veiculo.anoFabricacao;
  if (desejo.anoMinimo !== null && ano !== null && ano < desejo.anoMinimo) return false;
  if (
    desejo.precoMaximo !== null &&
    veiculo.precoVenda !== null &&
    veiculo.precoVenda > desejo.precoMaximo
  ) {
    return false;
  }
  const doVeiculo = palavras(
    [
      veiculo.marca,
      veiculo.modelo,
      veiculo.versao,
      veiculo.anoFabricacao,
      veiculo.anoModelo,
      veiculo.cor,
      veiculo.cambio,
      veiculo.combustivel,
      veiculo.carroceria,
      veiculo.motor,
      ...veiculo.opcionais,
    ]
      .filter((valor) => valor !== null)
      .join(" "),
  );
  const procuradas = palavras(desejo.nome).filter((palavra) => !PALAVRAS_IGNORADAS.has(palavra));
  return (
    procuradas.length > 0 &&
    procuradas.every((procurada) => doVeiculo.some((palavra) => palavra.startsWith(procurada)))
  );
}

export interface VeiculoPossivel {
  id: string;
  marca: string;
  modelo: string;
  versao: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
  precoVenda: number | null;
}

export interface Desejo {
  id: string;
  nome: string;
  anoMinimo: number | null;
  precoMaximo: number | null;
  observacoes: string | null;
  criadoEm: string;
  possiveis: VeiculoPossivel[];
}

export interface ClienteComDesejos {
  cliente: { id: string; nome: string; telefone: string };
  possivelDesde: string | null;
  desejos: Desejo[];
}
