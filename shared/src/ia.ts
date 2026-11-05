import { z } from "zod";
import type { CarroValidado } from "./carros.ts";

export const MAX_IMAGENS_IA = 4;
export const TAMANHO_MAXIMO_TEXTO_IA = 6000;

export const CAMPOS_DA_IA = [
  "marca",
  "modelo",
  "versao",
  "anoFabricacao",
  "anoModelo",
  "km",
  "cambio",
  "combustivel",
  "carroceria",
  "cores",
  "motor",
  "portas",
  "opcionais",
  "descricao",
  "precoVenda",
  "precoCompra",
  "custoPreparacao",
  "custoDocumentacao",
  "custoComissao",
  "precoMinimo",
  "dataEntrada",
  "placa",
  "chassi",
  "renavam",
  "origem",
  "vendedorNome",
  "vendedorTelefone",
  "observacoesInternas",
] as const satisfies readonly (keyof CarroValidado)[];

export type CampoDaIa = (typeof CAMPOS_DA_IA)[number];

export type CarroExtraido = { [Campo in CampoDaIa]?: NonNullable<CarroValidado[Campo]> };

export const esquemaPedidoIa = z
  .object({
    texto: z
      .string({ error: "Texto inválido." })
      .trim()
      .max(TAMANHO_MAXIMO_TEXTO_IA, `Use no máximo ${TAMANHO_MAXIMO_TEXTO_IA} caracteres.`),
    imagens: z
      .int({ error: "Imagens inválidas." })
      .max(MAX_IMAGENS_IA, `Escolha no máximo ${MAX_IMAGENS_IA} imagens.`),
  })
  .refine((pedido) => pedido.texto !== "" || pedido.imagens > 0, {
    error: "Cole um texto ou escolha uma imagem.",
    path: ["texto"],
  });
