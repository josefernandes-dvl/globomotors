import { z } from "zod";
import { corpoInvalido } from "./campos.ts";

export const esquemaEntrar = z.object(
  {
    email: z
      .string({ error: "Informe o e-mail." })
      .trim()
      .toLowerCase()
      .min(1, "Informe o e-mail.")
      .pipe(z.email("E-mail inválido.")),
    senha: z
      .string({ error: "Informe a senha." })
      .min(1, "Informe a senha.")
      .max(200, "Senha longa demais."),
  },
  corpoInvalido,
);

export interface Usuario {
  id: string;
  nome: string;
  email: string;
}

export interface RespostaSessao {
  usuario: Usuario;
}
