import { describe, expect, it } from "vitest";
import { ErroApi } from "./api.ts";
import { deveTentarDeNovo } from "./consultas.ts";

describe("deveTentarDeNovo", () => {
  it("não repete requisição que a API recusou (4xx)", () => {
    expect(deveTentarDeNovo(0, new ErroApi(401, "Faça login."))).toBe(false);
    expect(deveTentarDeNovo(0, new ErroApi(404, "Rota não encontrada."))).toBe(false);
  });

  it("repete até 2 vezes falha de servidor ou de conexão", () => {
    expect(deveTentarDeNovo(0, new ErroApi(503, "Indisponível."))).toBe(true);
    expect(deveTentarDeNovo(1, new ErroApi(0, "Sem conexão."))).toBe(true);
    expect(deveTentarDeNovo(2, new ErroApi(503, "Indisponível."))).toBe(false);
  });
});
