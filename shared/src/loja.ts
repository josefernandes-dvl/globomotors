import { z } from "zod";
import {
  corpoInvalido,
  esquemaTelefone,
  opcional,
  textoObrigatorio,
  textoOpcional,
} from "./campos.ts";

export const esquemaLoja = z.object(
  {
    nome: textoObrigatorio("o nome da loja", 60),
    cidade: textoOpcional(60),
    slogan: textoOpcional(140),
    whatsapp: opcional(esquemaTelefone),
    instagram: opcional(
      z
        .string({ error: "Instagram inválido." })
        .transform((perfil) =>
          perfil
            .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
            .replace(/^@/, "")
            .replace(/\/$/, ""),
        )
        .pipe(
          z.string().regex(/^[A-Za-z0-9._]{1,30}$/, "Instagram inválido: informe o @ do perfil."),
        ),
    ),
    mostrarPreco: z.boolean({ error: "Valor inválido." }),
    mostrarVendidos: z.boolean({ error: "Valor inválido." }),
  },
  corpoInvalido,
);

export type DadosLoja = z.input<typeof esquemaLoja>;
export type Loja = z.output<typeof esquemaLoja>;
export type LojaPublica = Omit<Loja, "mostrarVendidos">;

export const LOJA_PADRAO: Loja = {
  nome: "Globo Motors",
  cidade: null,
  slogan: null,
  whatsapp: null,
  instagram: null,
  mostrarPreco: true,
  mostrarVendidos: false,
};
