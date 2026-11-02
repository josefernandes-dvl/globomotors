import { CODIGOS_ERRO } from "@globomotors/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ErroHttp } from "../erros.ts";
import { paraRespostaErro } from "./erros.ts";

describe("paraRespostaErro", () => {
  it("usa status, código, mensagem e campos do ErroHttp", () => {
    const campos = [{ campo: "placa", mensagem: "Já cadastrada" }];
    const erro = new ErroHttp(409, CODIGOS_ERRO.VALIDACAO, "Placa já cadastrada.", campos);

    expect(paraRespostaErro(erro)).toEqual({
      status: 409,
      corpo: { erro: { codigo: "validacao", mensagem: "Placa já cadastrada.", campos } },
    });
  });

  it("traduz ZodError em 400 de validação com o caminho de cada campo", () => {
    const resultado = z
      .object({ carro: z.object({ ano: z.number() }) })
      .safeParse({ carro: { ano: "2020" } });

    expect(paraRespostaErro(resultado.error)).toMatchObject({
      status: 400,
      corpo: { erro: { codigo: "validacao", campos: [{ campo: "carro.ano" }] } },
    });
  });

  it("mantém o status de erros 4xx do Express sem repassar a mensagem técnica", () => {
    const erro = Object.assign(new Error("request entity too large"), {
      status: 413,
      expose: true,
    });

    expect(paraRespostaErro(erro)).toEqual({
      status: 413,
      corpo: { erro: { codigo: "requisicao_invalida", mensagem: "Requisição inválida." } },
    });
  });

  it("esconde detalhes de erros inesperados atrás de um 500 genérico", () => {
    const { status, corpo } = paraRespostaErro(new Error("senha do banco: 123"));

    expect(status).toBe(500);
    expect(corpo.erro.codigo).toBe("erro_interno");
    expect(JSON.stringify(corpo)).not.toContain("senha");
  });
});
