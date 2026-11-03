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
      AI_MODEL: "gemini-3.5-flash-lite",
      AI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
    });
    expect(
      lerConfig({ DATABASE_URL: URL_BANCO, PORT: "4000", NODE_ENV: "production" }),
    ).toMatchObject({ PORT: 4000, NODE_ENV: "production" });
    expect(lerConfig({ DATABASE_URL: URL_BANCO, TRUST_PROXY: "1" })).toMatchObject({
      TRUST_PROXY: 1,
    });
  });

  it("lê a chave da IA sem espaços e trata a chave vazia do .env.example como ausente", () => {
    expect(
      lerConfig({
        DATABASE_URL: URL_BANCO,
        AI_API_KEY: "  chave-da-ia  ",
        AI_MODEL: "outro-modelo",
        AI_BASE_URL: "http://127.0.0.1:3999/v1",
      }),
    ).toMatchObject({
      AI_API_KEY: "chave-da-ia",
      AI_MODEL: "outro-modelo",
      AI_BASE_URL: "http://127.0.0.1:3999/v1",
    });
    expect(lerConfig({ DATABASE_URL: URL_BANCO, AI_API_KEY: "" }).AI_API_KEY).toBeUndefined();
    expect(lerConfig({ DATABASE_URL: URL_BANCO, AI_API_KEY: "   " }).AI_API_KEY).toBeUndefined();
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
    expect(() => lerConfig({ DATABASE_URL: URL_BANCO, AI_BASE_URL: "ftp://ia.com/v1" })).toThrow(
      /AI_BASE_URL/,
    );
    expect(() => lerConfig({ DATABASE_URL: URL_BANCO, AI_MODEL: " " })).toThrow(/AI_MODEL/);
  });
});
