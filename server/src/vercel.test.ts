import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { criarRepositorios } from "./repositorios/index.ts";
import { gerarHashSenha } from "./senhas.ts";
import { criarBancoDeTeste } from "./testes/bancoDeTeste.ts";
import { iniciarServidorDeTeste } from "./testes/servidorDeTeste.ts";

const poolsEntregues = vi.hoisted(() => [] as unknown[]);

vi.mock("@vercel/functions/db-connections", () => ({
  attachDatabasePool: (pool: unknown) => poolsEntregues.push(pool),
}));

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let servidor: Awaited<ReturnType<typeof iniciarServidorDeTeste>>;

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  vi.stubEnv("DATABASE_URL", banco.url);
  vi.stubEnv("LOG_LEVEL", "silent");
  const { default: app } = await import("./vercel.ts");
  servidor = await iniciarServidorDeTeste(app);
});

afterAll(async () => {
  await servidor.fechar();
  await banco.destruir();
});

function emailNovo() {
  return `ninguem-${randomUUID().slice(0, 6)}@teste.com`;
}

function entrar(email: string, senha: string, ip: string) {
  return fetch(`${servidor.url}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, senha }),
  });
}

describe("função da Vercel", () => {
  it("responde a API com o banco do DATABASE_URL e entrega o pool à Vercel", async () => {
    const resposta = await fetch(`${servidor.url}/api/health`);

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ status: "ok", banco: "ok" });
    expect(poolsEntregues).toEqual([expect.any(Pool)]);
  });

  it("marca o cookie da sessão como Secure", async () => {
    const email = emailNovo();
    await criarRepositorios(banco.db).usuarios.criar({
      nome: "Vendedor de Teste",
      email,
      senhaHash: await gerarHashSenha("teste123"),
    });

    const resposta = await entrar(email, "teste123", "203.0.113.50");

    expect(resposta.status).toBe(200);
    expect(resposta.headers.getSetCookie()[0]).toContain("Secure");
  });

  it("conta o limite de login pelo IP que a Vercel grava no fim do X-Forwarded-For", async () => {
    const erros: number[] = [];
    for (let vez = 0; vez < 10; vez++) {
      erros.push((await entrar(emailNovo(), "errada123", "203.0.113.1")).status);
    }

    const mesmoIp = await entrar(emailNovo(), "errada123", "203.0.113.1");
    const ipInventadoNaFrente = await entrar(emailNovo(), "errada123", "198.51.100.7, 203.0.113.1");
    const outroIp = await entrar(emailNovo(), "errada123", "203.0.113.2");

    expect(erros).toEqual(Array<number>(10).fill(401));
    expect(mesmoIp.status).toBe(429);
    expect(ipInventadoNaFrente.status).toBe(429);
    expect(outroIp.status).toBe(401);
  });
});
