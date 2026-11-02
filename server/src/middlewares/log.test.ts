import express from "express";
import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { iniciarServidorDeTeste } from "../testes/servidorDeTeste.ts";
import { logDeRequisicoes } from "./log.ts";

async function logarRequisicao(status: number, headers?: Record<string, string>) {
  const linhas: Record<string, unknown>[] = [];
  const logger = pino(
    { level: "info" },
    { write: (linha: string) => linhas.push(JSON.parse(linha) as Record<string, unknown>) },
  );
  const app = express();
  app.use(logDeRequisicoes(logger));
  app.get("/api/teste", (_req, res) => {
    res.sendStatus(status);
  });

  const servidor = await iniciarServidorDeTeste(app);
  try {
    await (await fetch(`${servidor.url}/api/teste?search=Maria%20Souza`, { headers })).text();
  } finally {
    await servidor.fechar();
  }
  return linhas;
}

describe("logDeRequisicoes", () => {
  it("registra uma linha por requisição, sem headers, cookies nem a query string", async () => {
    const linhas = await logarRequisicao(200, {
      cookie: "sessao=segredo-do-cookie",
      authorization: "Bearer segredo-do-token",
    });

    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      level: 30,
      msg: expect.stringMatching(/^GET \/api\/teste 200 \d+ms$/) as unknown,
      req: { method: "GET", url: "/api/teste" },
      res: { statusCode: 200 },
    });
    expect(JSON.stringify(linhas)).not.toMatch(/segredo|search|Maria/);
  });

  it("registra 5xx como erro, sem stack trace inventado pelo pino-http", async () => {
    const linhas = await logarRequisicao(503);

    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ level: 50, msg: "GET /api/teste 503" });
    expect(linhas[0]).not.toHaveProperty("err");
  });
});
