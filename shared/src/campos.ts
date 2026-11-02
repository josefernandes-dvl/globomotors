import { z } from "zod";

function normalizarVazio(valor: unknown) {
  if (typeof valor !== "string") return valor ?? null;
  const texto = valor.trim();
  return texto === "" ? null : texto;
}

export const corpoInvalido = { error: "Dados inválidos." };

export function opcional<T extends z.ZodType>(esquema: T) {
  return z.preprocess(normalizarVazio, esquema.nullable());
}

export function textoObrigatorio(rotulo: string, maximo: number) {
  return z
    .string({ error: `Informe ${rotulo}.` })
    .trim()
    .min(1, `Informe ${rotulo}.`)
    .max(maximo, `Use no máximo ${maximo} caracteres.`);
}

export function textoOpcional(maximo: number) {
  return opcional(
    z.string({ error: "Texto inválido." }).max(maximo, `Use no máximo ${maximo} caracteres.`),
  );
}

export const esquemaCentavos = z
  .int({ error: "Informe um valor válido." })
  .min(0, { error: "O valor não pode ser negativo.", abort: true })
  .max(2_000_000_000, { error: "Valor alto demais.", abort: true });

export function digitosDoTelefone(texto: string) {
  const digitos = texto.replace(/\D/g, "");
  return digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
}

export const esquemaTelefone = z.preprocess(
  (valor) => {
    if (typeof valor !== "string") return valor;
    const digitos = digitosDoTelefone(valor);
    return digitos === "" ? valor.trim() : digitos;
  },
  z
    .string({ error: "Informe o telefone." })
    .min(1, { error: "Informe o telefone.", abort: true })
    .regex(
      /^[1-9]{2}(9\d{8}|[2-8]\d{7})$/,
      "Telefone inválido: informe DDD e número, como (62) 99999-0000.",
    ),
);
