import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { gerarToken, hashDoToken, lerCookie, vendedorAutenticado } from "./autenticacao.ts";

describe("lerCookie", () => {
  it.each([
    ["globomotors_sessao=abc", "abc"],
    ["tema=escuro; globomotors_sessao=abc-123_x; outro=1", "abc-123_x"],
    ["  globomotors_sessao = abc  ", "abc"],
    ["globomotors_sessao=a=b", "a=b"],
  ])("lê o cookie em %j", (cabecalho, esperado) => {
    expect(lerCookie(cabecalho, "globomotors_sessao")).toBe(esperado);
  });

  it.each([
    ["sem cabeçalho", undefined],
    ["cabeçalho vazio", ""],
    ["outro cookie", "tema=escuro"],
    ["nome parecido", "x_globomotors_sessao=abc"],
    ["valor vazio", "globomotors_sessao="],
    ["sem valor", "globomotors_sessao"],
  ])("devolve undefined com %s", (_caso, cabecalho) => {
    expect(lerCookie(cabecalho, "globomotors_sessao")).toBeUndefined();
  });
});

describe("token da sessão", () => {
  it("gera tokens base64url de 32 bytes, diferentes a cada chamada", () => {
    const token = gerarToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(gerarToken()).not.toBe(token);
  });

  it("guarda só o sha256 do token", () => {
    expect(hashDoToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("vendedorAutenticado", () => {
  it("lança erro se a rota não passou por exigirAutenticacao", () => {
    expect(() => vendedorAutenticado({} as Request)).toThrow(/exigirAutenticacao/);
  });
});
