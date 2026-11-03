import { z } from "zod";
import {
  corpoInvalido,
  esquemaCentavos,
  esquemaTelefone,
  opcional,
  textoObrigatorio,
  textoOpcional,
} from "./campos.ts";
import { hojeEmSaoPaulo } from "./datas.ts";

export const STATUS_CARRO = ["rascunho", "disponivel", "reservado", "vendido"] as const;
export type StatusCarro = (typeof STATUS_CARRO)[number];

export const ROTULOS_STATUS_CARRO: Record<StatusCarro, string> = {
  rascunho: "Rascunho",
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
};

export type StatusPublico = Exclude<StatusCarro, "rascunho">;

export const CAMBIOS = ["Manual", "Automático", "CVT", "Automatizado"] as const;
export type Cambio = (typeof CAMBIOS)[number];

export const COMBUSTIVEIS = [
  "Flex",
  "Gasolina",
  "Etanol",
  "Diesel",
  "Híbrido",
  "Elétrico",
  "GNV",
] as const;
export type Combustivel = (typeof COMBUSTIVEIS)[number];

export const CARROCERIAS = [
  "Hatch",
  "Sedã",
  "SUV",
  "Picape",
  "Minivan",
  "Cupê",
  "Conversível",
  "Utilitário",
  "Moto",
] as const;
export type Carroceria = (typeof CARROCERIAS)[number];

export const MAX_FOTOS_POR_CARRO = 20;
export const TAMANHO_MAXIMO_FOTO = 4 * 1024 * 1024;
export const TIPOS_DE_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoDeFoto = (typeof TIPOS_DE_FOTO)[number];

const ANO_MINIMO = 1900;

const esquemaAno = z
  .int({ error: "Informe um ano válido." })
  .min(ANO_MINIMO, { error: `Informe um ano a partir de ${ANO_MINIMO}.`, abort: true })
  .refine((ano) => ano <= new Date().getFullYear() + 1, {
    error: () => `Informe um ano até ${new Date().getFullYear() + 1}.`,
    abort: true,
  });

const esquemaPlaca = z
  .string({ error: "Placa inválida." })
  .transform((placa) => placa.toUpperCase().replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^[A-Z]{3}\d[A-Z\d]\d{2}$/, "Placa inválida: use ABC1D23 ou ABC-1234."));

const esquemaChassi = z
  .string({ error: "Chassi inválido." })
  .transform((chassi) => chassi.toUpperCase().replace(/\s/g, ""))
  .pipe(
    z
      .string()
      .regex(/^[A-HJ-NPR-Z\d]{17}$/, "Chassi inválido: são 17 letras e números, sem I, O e Q."),
  );

export function calcularDigitoRenavam(base: string) {
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = [...base].reduce((total, digito, i) => total + Number(digito) * (pesos[i] ?? 0), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

function renavamValido(renavam: string) {
  if (!/^\d{9,11}$/.test(renavam)) return false;
  const completo = renavam.padStart(11, "0");
  return calcularDigitoRenavam(completo.slice(0, 10)) === Number(completo[10]);
}

const esquemaRenavam = z
  .string({ error: "Renavam inválido." })
  .transform((renavam) => renavam.replace(/\D/g, ""))
  .refine(renavamValido, "Renavam inválido: confira os dígitos.")
  .transform((renavam) => renavam.padStart(11, "0"));

export const esquemaOpcionais = z
  .array(
    z
      .string({ error: "Adicional inválido." })
      .trim()
      .min(1, "Adicional vazio.")
      .max(60, "Cada adicional pode ter no máximo 60 caracteres."),
    { error: "Lista de adicionais inválida." },
  )
  .max(40, "Informe no máximo 40 adicionais.")
  .transform((lista) =>
    lista.filter(
      (item, indice) =>
        lista.findIndex((outro) => outro.toLowerCase() === item.toLowerCase()) === indice,
    ),
  );

const esquemaDataEntrada = z.preprocess(
  (valor) => (valor === "" || valor === null ? undefined : valor),
  z.iso
    .date({ error: "Data inválida." })
    .refine((data) => data <= hojeEmSaoPaulo(), "A data de entrada não pode estar no futuro.")
    .optional(),
);

export const esquemaCarro = z
  .object(
    {
      marca: textoObrigatorio("a marca", 60),
      modelo: textoObrigatorio("o modelo", 60),
      versao: textoOpcional(80),
      anoFabricacao: opcional(esquemaAno),
      anoModelo: opcional(esquemaAno),
      km: opcional(
        z
          .int({ error: "Informe a quilometragem em número inteiro." })
          .min(0, "A quilometragem não pode ser negativa.")
          .max(2_000_000, "Quilometragem alta demais."),
      ),
      cambio: opcional(z.enum(CAMBIOS, { error: "Câmbio inválido." })),
      combustivel: opcional(z.enum(COMBUSTIVEIS, { error: "Combustível inválido." })),
      carroceria: opcional(z.enum(CARROCERIAS, { error: "Carroceria inválida." })),
      cor: textoOpcional(30),
      motor: textoOpcional(30),
      portas: opcional(
        z
          .int({ error: "Informe o número de portas." })
          .min(1, "Informe de 1 a 6 portas.")
          .max(6, "Informe de 1 a 6 portas."),
      ),
      opcionais: esquemaOpcionais.default([]),
      descricao: textoOpcional(2000),
      precoVenda: opcional(esquemaCentavos),
      destaque: z.boolean({ error: "Valor inválido." }).default(false),
      status: z.enum(STATUS_CARRO, { error: "Status inválido." }).default("rascunho"),
      precoCompra: opcional(esquemaCentavos),
      custoPreparacao: opcional(esquemaCentavos),
      custoDocumentacao: opcional(esquemaCentavos),
      custoComissao: opcional(esquemaCentavos),
      precoMinimo: opcional(esquemaCentavos),
      dataEntrada: esquemaDataEntrada,
      placa: opcional(esquemaPlaca),
      chassi: opcional(esquemaChassi),
      renavam: opcional(esquemaRenavam),
      origem: textoOpcional(120),
      vendedorNome: textoOpcional(100),
      vendedorTelefone: opcional(esquemaTelefone),
      observacoesInternas: textoOpcional(2000),
    },
    corpoInvalido,
  )
  .superRefine((carro, ctx) => {
    if (
      carro.anoFabricacao !== null &&
      carro.anoModelo !== null &&
      (carro.anoModelo < carro.anoFabricacao || carro.anoModelo > carro.anoFabricacao + 1)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["anoModelo"],
        message: "O ano modelo deve ser o de fabricação ou o seguinte.",
      });
    }
    if (
      carro.precoMinimo !== null &&
      carro.precoVenda !== null &&
      carro.precoMinimo > carro.precoVenda
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["precoMinimo"],
        message: "O preço mínimo não pode passar do preço anunciado.",
      });
    }
  });

export type DadosCarro = z.input<typeof esquemaCarro>;
export type CarroValidado = z.output<typeof esquemaCarro>;

export const esquemaStatusCarro = z.object(
  { status: z.enum(STATUS_CARRO, { error: "Status inválido." }) },
  corpoInvalido,
);

export const esquemaOrdemFotos = z.object(
  {
    ordem: z
      .array(z.uuid({ error: "Foto inválida." }), { error: "Informe a ordem das fotos." })
      .max(MAX_FOTOS_POR_CARRO, `No máximo ${MAX_FOTOS_POR_CARRO} fotos.`)
      .refine((ids) => new Set(ids).size === ids.length, "A mesma foto aparece duas vezes."),
  },
  corpoInvalido,
);

export interface FotoCarro {
  id: string;
  url: string;
}

interface CamposPublicosCarro {
  slug: string;
  marca: string;
  modelo: string;
  versao: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
  km: number | null;
  cambio: Cambio | null;
  combustivel: Combustivel | null;
  carroceria: Carroceria | null;
  cor: string | null;
  motor: string | null;
  portas: number | null;
  opcionais: string[];
  descricao: string | null;
  destaque: boolean;
  fotos: FotoCarro[];
}

export interface CarroPublico extends CamposPublicosCarro {
  preco: number | null;
  status: StatusPublico;
}

export interface CarroPainel extends CamposPublicosCarro {
  id: string;
  status: StatusCarro;
  precoVenda: number | null;
  precoCompra: number | null;
  custoPreparacao: number | null;
  custoDocumentacao: number | null;
  custoComissao: number | null;
  precoMinimo: number | null;
  margem: number | null;
  dataEntrada: string;
  diasEmEstoque: number;
  placa: string | null;
  chassi: string | null;
  renavam: string | null;
  origem: string | null;
  vendedorNome: string | null;
  vendedorTelefone: string | null;
  observacoesInternas: string | null;
  interessados: number;
  vendidoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

interface CustosDoCarro {
  precoVenda: number | null;
  precoCompra: number | null;
  custoPreparacao: number | null;
  custoDocumentacao: number | null;
  custoComissao: number | null;
}

export function calcularMargem(carro: CustosDoCarro) {
  if (carro.precoVenda === null || carro.precoCompra === null) return null;
  return (
    carro.precoVenda -
    carro.precoCompra -
    (carro.custoPreparacao ?? 0) -
    (carro.custoDocumentacao ?? 0) -
    (carro.custoComissao ?? 0)
  );
}
