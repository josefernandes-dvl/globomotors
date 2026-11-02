import { describe, expect, it } from "vitest";
import { lerConfig } from "./config.ts";

const URL_BANCO = "postgres://usuario:senha@localhost:5435/banco";

describe("lerConfig", () => {
  it("aplica os padrões e converte a porta para número", () => {
    expect(lerConfig({ DATABASE_URL: URL_BANCO })).toEqual({
      NODE_ENV: "development",
      PORT: 3001,
      DATABASE_URL: URL_BANCO,
      TRUST_PROXY: 0,
    });
    expect(
      lerConfig({ DATABASE_URL: URL_BANCO, PORT: "4000", NODE_ENV: "production" }),
    ).toMatchObject({ PORT: 4000, NODE_ENV: "production" });
    expect(lerConfig({ DATABASE_URL: URL_BANCO, TRUST_PROXY: "1" })).toMatchObject({
      TRUST_PROXY: 1,
    });
  });

  it("recusa configuração inválida dizendo qual variável corrigir", () => {
    expect(() => lerConfig({})).toThrow(/DATABASE_URL/);
    expect(() => lerConfig({ DATABASE_URL: "http://localhost/banco" })).toThrow(/DATABASE_URL/);
    expect(() => lerConfig({ DATABASE_URL: URL_BANCO, PORT: "abc" })).toThrow(/PORT/);
    expect(() => lerConfig({ DATABASE_URL: URL_BANCO, LOG_LEVEL: "barulho" })).toThrow(/LOG_LEVEL/);
    expect(() => lerConfig({ DATABASE_URL: URL_BANCO, TRUST_PROXY: "true" })).toThrow(
      /TRUST_PROXY/,
    );
    expect(() => lerConfig({ DATABASE_URL: URL_BANCO, TRUST_PROXY: "-1" })).toThrow(/TRUST_PROXY/);
  });
});
