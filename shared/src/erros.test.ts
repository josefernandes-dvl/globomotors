import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CODIGOS_ERRO, errosDeCampo, esquemaRespostaErro } from "./erros.ts";

describe("esquemaRespostaErro", () => {
  it("aceita o envelope de erro da API, com e sem campos", () => {
    const comCampos = {
      erro: {
        codigo: CODIGOS_ERRO.VALIDACAO,
        mensagem: "Dados inválidos.",
        campos: [{ campo: "preco", mensagem: "Obrigatório" }],
      },
    };
    const semCampos = { erro: { codigo: CODIGOS_ERRO.NAO_ENCONTRADO, mensagem: "Não achei." } };

    expect(esquemaRespostaErro.parse(comCampos)).toEqual(comCampos);
    expect(esquemaRespostaErro.parse(semCampos)).toEqual(semCampos);
  });

  it("recusa código desconhecido e corpo que não é envelope", () => {
    expect(esquemaRespostaErro.safeParse({ erro: { codigo: "x", mensagem: "m" } }).success).toBe(
      false,
    );
    expect(esquemaRespostaErro.safeParse({ erro: { codigo: "validacao" } }).success).toBe(false);
    expect(esquemaRespostaErro.safeParse("<html>Bad Gateway</html>").success).toBe(false);
  });
});

describe("errosDeCampo", () => {
  const esquema = z.object(
    {
      nome: z.string({ error: "Informe o nome." }),
      opcionais: z.array(z.string({ error: "Opcional inválido." })),
    },
    { error: "Dados inválidos." },
  );

  it("lista cada problema com o caminho do campo separado por ponto", () => {
    const resultado = esquema.safeParse({ opcionais: ["Ar", 3] });

    expect(resultado.success).toBe(false);
    expect(errosDeCampo(resultado.error ?? new z.ZodError([]))).toEqual([
      { campo: "nome", mensagem: "Informe o nome." },
      { campo: "opcionais.1", mensagem: "Opcional inválido." },
    ]);
  });

  it("usa campo vazio quando o problema é no corpo inteiro", () => {
    const resultado = esquema.safeParse("texto");

    expect(errosDeCampo(resultado.error ?? new z.ZodError([]))).toEqual([
      { campo: "", mensagem: "Dados inválidos." },
    ]);
  });
});
