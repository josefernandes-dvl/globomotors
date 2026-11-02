import express from "express";
import { afterAll, beforeAll, expect, it } from "vitest";
import { iniciarServidorDeTeste } from "../testes/servidorDeTeste.ts";
import { tratarErros } from "./erros.ts";
import { exigirMesmaOrigem } from "./origem.ts";

let servidor: Awaited<ReturnType<typeof iniciarServidorDeTeste>>;

beforeAll(async () => {
  const app = express();
  app.use(exigirMesmaOrigem);
  app.use((_req, res) => {
    res.status(204).end();
  });
  app.use(tratarErros);
  servidor = await iniciarServidorDeTeste(app);
});

afterAll(async () => {
  await servidor.fechar();
});

function enviar(metodo: string, origem?: string) {
  return fetch(`${servidor.url}/api/auth/logout`, {
    method: metodo,
    headers: origem ? { "sec-fetch-site": origem } : {},
  });
}

it.each([
  ["POST", "cross-site"],
  ["PUT", "cross-site"],
  ["PATCH", "cross-site"],
  ["DELETE", "cross-site"],
  ["POST", "same-site"],
])("recusa %s com Sec-Fetch-Site %s", async (metodo, origem) => {
  const resposta = await enviar(metodo, origem);

  expect(resposta.status).toBe(403);
  expect(await resposta.json()).toEqual({
    erro: { codigo: "origem_recusada", mensagem: "Requisição vinda de outro site recusada." },
  });
});

it.each([
  ["POST", "same-origin"],
  ["POST", "none"],
  ["GET", "cross-site"],
  ["HEAD", "cross-site"],
  ["OPTIONS", "cross-site"],
])("aceita %s com Sec-Fetch-Site %s", async (metodo, origem) => {
  expect((await enviar(metodo, origem)).status).toBe(204);
});

it("aceita escrita sem Sec-Fetch-Site, como a dos scripts e de navegadores antigos", async () => {
  expect((await enviar("POST")).status).toBe(204);
});
