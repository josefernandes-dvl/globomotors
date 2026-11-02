import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "./app.ts";
import { criarBanco } from "./db/banco.ts";
import { criarLogger } from "./logger.ts";
import { criarRepositorios } from "./repositorios/index.ts";
import { criarBancoDeTeste } from "./testes/bancoDeTeste.ts";
import { iniciarServidorDeTeste } from "./testes/servidorDeTeste.ts";

const logger = criarLogger({ NODE_ENV: "test" });
const URL_BANCO_FORA_DO_AR = "postgres://globomotors:x@127.0.0.1:1/nada";

describe("API", () => {
  let banco: Awaited<ReturnType<typeof criarBancoDeTeste>> | undefined;
  let servidor: Awaited<ReturnType<typeof iniciarServidorDeTeste>> | undefined;
  const url = (caminho: string) => `${servidor?.url}${caminho}`;

  beforeAll(async () => {
    banco = await criarBancoDeTeste();
    servidor = await iniciarServidorDeTeste(
      criarApp({ repositorios: criarRepositorios(banco.db), logger }),
    );
  });

  afterAll(async () => {
    await servidor?.fechar();
    await banco?.destruir();
  });

  it("GET /api/health responde ok com o banco de pé e com os headers de segurança", async () => {
    const resposta = await fetch(url("/api/health"));

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ status: "ok", banco: "ok" });
    expect(resposta.headers.get("x-content-type-options")).toBe("nosniff");
    expect(resposta.headers.get("content-security-policy")).toContain(
      "img-src 'self' data: blob:;",
    );
  });

  it("recusa escrita vinda de outro site", async () => {
    const resposta = await fetch(url("/api/auth/logout"), {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    });

    expect(resposta.status).toBe(403);
    expect(await resposta.json()).toMatchObject({ erro: { codigo: "origem_recusada" } });
  });

  it("rota de API inexistente responde 404 no envelope de erro", async () => {
    const resposta = await fetch(url("/api/nao-existe"));

    expect(resposta.status).toBe(404);
    expect(await resposta.json()).toEqual({
      erro: { codigo: "nao_encontrado", mensagem: "Rota não encontrada." },
    });
  });

  it("JSON malformado responde 400 no envelope de erro", async () => {
    const resposta = await fetch(url("/api/health"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({
      erro: { codigo: "requisicao_invalida", mensagem: "Requisição inválida." },
    });
  });
});

describe("API com o banco fora do ar", () => {
  it("GET /api/health responde 503 degradado", async () => {
    const { db, pool } = criarBanco(URL_BANCO_FORA_DO_AR);
    const servidor = await iniciarServidorDeTeste(
      criarApp({ repositorios: criarRepositorios(db), logger }),
    );

    try {
      const resposta = await fetch(`${servidor.url}/api/health`);

      expect(resposta.status).toBe(503);
      expect(await resposta.json()).toEqual({ status: "degradado", banco: "indisponivel" });
    } finally {
      await servidor.fechar();
      await pool.end();
    }
  });
});

describe("em produção, servindo o front buildado", () => {
  const { db, pool } = criarBanco(URL_BANCO_FORA_DO_AR);
  let pastaWeb: string | undefined;
  let servidor: Awaited<ReturnType<typeof iniciarServidorDeTeste>> | undefined;
  const url = (caminho: string) => `${servidor?.url}${caminho}`;

  beforeAll(async () => {
    pastaWeb = await mkdtemp(path.join(tmpdir(), "globomotors-web-"));
    await mkdir(path.join(pastaWeb, "assets"));
    await writeFile(path.join(pastaWeb, "index.html"), "<!doctype html><title>GloboMotors</title>");
    await writeFile(path.join(pastaWeb, "assets", "app.js"), "export {};");
    servidor = await iniciarServidorDeTeste(
      criarApp({ repositorios: criarRepositorios(db), logger, pastaWeb }),
    );
  });

  afterAll(async () => {
    await servidor?.fechar();
    await pool.end();
    if (pastaWeb) await rm(pastaWeb, { recursive: true, force: true });
  });

  it("entrega o index.html em qualquer rota do front (SPA), inclusive com ponto no caminho", async () => {
    const resposta = await fetch(url("/catalogo/onix-1.0-turbo"));

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toContain("text/html");
    expect(await resposta.text()).toContain("<title>GloboMotors</title>");
  });

  it("entrega os arquivos estáticos do build", async () => {
    const resposta = await fetch(url("/assets/app.js"));

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toContain("javascript");
  });

  it.each(["/api/nao-existe", "/assets/de-um-build-antigo.js"])(
    "responde 404 em JSON, e não o index.html, para %s",
    async (caminho) => {
      const resposta = await fetch(url(caminho));

      expect(resposta.status).toBe(404);
      expect(await resposta.json()).toMatchObject({ erro: { codigo: "nao_encontrado" } });
    },
  );
});

describe("em desenvolvimento, sem o front buildado", () => {
  it("responde 404 em JSON fora da API em vez da página padrão do Express", async () => {
    const { db, pool } = criarBanco(URL_BANCO_FORA_DO_AR);
    const servidor = await iniciarServidorDeTeste(
      criarApp({ repositorios: criarRepositorios(db), logger }),
    );

    try {
      const resposta = await fetch(`${servidor.url}/`);

      expect(resposta.status).toBe(404);
      expect(await resposta.json()).toMatchObject({ erro: { codigo: "nao_encontrado" } });
    } finally {
      await servidor.fechar();
      await pool.end();
    }
  });
});
