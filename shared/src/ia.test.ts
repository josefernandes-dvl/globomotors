import { describe, expect, it } from "vitest";
import { esquemaCarro } from "./carros.ts";
import { CAMPOS_DA_IA, MAX_IMAGENS_IA, TAMANHO_MAXIMO_TEXTO_IA, esquemaPedidoIa } from "./ia.ts";

describe("esquemaPedidoIa", () => {
  it("aceita texto, imagens ou os dois, com o texto sem espaços nas pontas", () => {
    expect(esquemaPedidoIa.parse({ texto: "  Onix 2021  ", imagens: 0 })).toEqual({
      texto: "Onix 2021",
      imagens: 0,
    });
    expect(esquemaPedidoIa.parse({ texto: "", imagens: MAX_IMAGENS_IA })).toEqual({
      texto: "",
      imagens: MAX_IMAGENS_IA,
    });
    expect(
      esquemaPedidoIa.safeParse({ texto: "a".repeat(TAMANHO_MAXIMO_TEXTO_IA), imagens: 1 }).success,
    ).toBe(true);
  });

  it.each([
    [{ texto: "   ", imagens: 0 }, "texto", "Cole um texto ou escolha uma imagem."],
    [
      { texto: "a".repeat(TAMANHO_MAXIMO_TEXTO_IA + 1), imagens: 0 },
      "texto",
      "Use no máximo 6000 caracteres.",
    ],
    [{ texto: "Onix", imagens: MAX_IMAGENS_IA + 1 }, "imagens", "Escolha no máximo 4 imagens."],
    [{ texto: 42, imagens: 0 }, "texto", "Texto inválido."],
    [{ texto: "Onix", imagens: 1.5 }, "imagens", "Imagens inválidas."],
  ])("recusa %o", (pedido, campo, mensagem) => {
    const resultado = esquemaPedidoIa.safeParse(pedido);

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.map(({ path, message }) => [path.join("."), message])).toEqual([
      [campo, mensagem],
    ]);
  });
});

describe("CAMPOS_DA_IA", () => {
  it("lista campos do cadastro do carro, sem status, destaque nem repetidos", () => {
    expect(new Set(CAMPOS_DA_IA).size).toBe(CAMPOS_DA_IA.length);
    expect(CAMPOS_DA_IA.every((campo) => campo in esquemaCarro.shape)).toBe(true);
    expect(CAMPOS_DA_IA).not.toContain("status");
    expect(CAMPOS_DA_IA).not.toContain("destaque");
  });
});
