import { describe, expect, it } from "vitest";
import { gerarHashSenha, verificarSenha } from "./senhas.ts";

describe("gerarHashSenha", () => {
  it("gera hash scrypt com parâmetros, sal e chave em base64", async () => {
    const hash = await gerarHashSenha("teste123");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]{24}\$[A-Za-z0-9+/=]{88}$/);
    expect(hash).not.toContain("teste123");
  });

  it("usa sal novo a cada hash", async () => {
    expect(await gerarHashSenha("teste123")).not.toBe(await gerarHashSenha("teste123"));
  });
});

describe("verificarSenha", () => {
  it("aceita a senha certa e recusa a errada", async () => {
    const hash = await gerarHashSenha("teste123");
    expect(await verificarSenha("teste123", hash)).toBe(true);
    expect(await verificarSenha("teste124", hash)).toBe(false);
    expect(await verificarSenha("", hash)).toBe(false);
  });

  it.each([
    ["vazio", ""],
    ["texto qualquer", "abc"],
    ["outro algoritmo", "bcrypt$16384$8$1$c2Fs$Y2hhdmU="],
    ["partes faltando", "scrypt$16384$8$1$c2Fs"],
    ["parâmetro inválido", "scrypt$3$8$1$c2Fs$Y2hhdmU="],
  ])("recusa hash malformado (%s) sem lançar erro", async (_caso, hash) => {
    expect(await verificarSenha("teste123", hash)).toBe(false);
  });
});
