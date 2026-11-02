import { describe, expect, it } from "vitest";
import { ErroApi } from "./api.ts";
import { errosDaApi, errosPorCampo, mensagemDeErro } from "./formularios.ts";

describe("errosPorCampo", () => {
  it("agrupa pelo primeiro trecho do caminho e mantém a primeira mensagem de cada campo", () => {
    expect(
      errosPorCampo([
        { campo: "placa", mensagem: "Placa inválida." },
        { campo: "opcionais.3", mensagem: "Opcional muito longo." },
        { campo: "placa", mensagem: "Outra mensagem." },
      ]),
    ).toEqual({ placa: "Placa inválida.", opcionais: "Opcional muito longo." });
  });

  it("devolve objeto vazio sem erros", () => {
    expect(errosPorCampo([])).toEqual({});
  });
});

describe("errosDaApi", () => {
  it("lê os erros por campo de um ErroApi", () => {
    const erro = new ErroApi(400, "Dados inválidos.", "validacao", [
      { campo: "nome", mensagem: "Informe o nome." },
    ]);

    expect(errosDaApi(erro)).toEqual({ nome: "Informe o nome." });
  });

  it("ignora o que não veio da API", () => {
    expect(errosDaApi(new Error("falhou"))).toEqual({});
    expect(errosDaApi("texto")).toEqual({});
  });
});

describe("mensagemDeErro", () => {
  it("usa a mensagem do erro", () => {
    expect(mensagemDeErro(new ErroApi(409, "Placa já cadastrada.", "conflito"))).toBe(
      "Placa já cadastrada.",
    );
  });

  it("usa mensagem genérica para o que não é Error", () => {
    expect(mensagemDeErro(undefined)).toBe("Algo deu errado. Tente novamente.");
  });
});
