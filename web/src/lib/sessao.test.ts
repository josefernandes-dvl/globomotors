import { describe, expect, it } from "vitest";
import { USUARIO } from "../testes/dados.ts";
import { respostaDeErro, simularApi } from "../testes/simularApi.ts";
import { buscarSessao } from "./sessao.ts";

describe("buscarSessao", () => {
  it("devolve o vendedor que entrou", async () => {
    simularApi({ "GET /api/auth/me": { usuario: USUARIO } });

    await expect(buscarSessao()).resolves.toEqual(USUARIO);
  });

  it("devolve null quando ninguém entrou", async () => {
    simularApi({
      "GET /api/auth/me": respostaDeErro(401, "nao_autenticado", "Entre para continuar."),
    });

    await expect(buscarSessao()).resolves.toBeNull();
  });

  it("repassa as outras falhas, para a tela mostrar o erro", async () => {
    simularApi({ "GET /api/auth/me": respostaDeErro(500, "erro_interno", "Erro interno.") });

    await expect(buscarSessao()).rejects.toMatchObject({ status: 500, message: "Erro interno." });
  });
});
