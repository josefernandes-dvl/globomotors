import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { criarApp } from "../app.ts";
import { gerarToken, hashDoToken } from "../middlewares/autenticacao.ts";
import { prepararApiDeTeste, type ApiDeTeste } from "../testes/apiDeTeste.ts";
import { iniciarServidorDeTeste } from "../testes/servidorDeTeste.ts";

let api: ApiDeTeste;

beforeAll(async () => {
  api = await prepararApiDeTeste();
});

afterAll(async () => {
  await api.encerrar();
});

function cookieDe(headers: Headers) {
  return headers.getSetCookie()[0]?.split(";")[0];
}

describe("POST /api/auth/login", () => {
  it("entra com e-mail e senha e devolve o vendedor sem o hash da senha", async () => {
    const vendedor = await api.criarVendedor();
    const resposta = await api.requisitar("POST", "/auth/login", {
      corpo: { email: vendedor.email, senha: "teste123" },
    });

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual({
      usuario: { id: vendedor.id, nome: "Vendedor de Teste", email: vendedor.email },
    });
    expect(resposta.texto).not.toMatch(/senha|scrypt/i);
    expect(resposta.headers.get("cache-control")).toBe("no-store");
  });

  it("grava a sessão em cookie httpOnly, SameSite=Lax, de 30 dias e sem Secure fora da produção", async () => {
    const vendedor = await api.criarVendedor();
    const resposta = await api.requisitar("POST", "/auth/login", {
      corpo: { email: vendedor.email, senha: "teste123" },
    });
    const [cookie] = resposta.headers.getSetCookie();

    expect(cookie).toMatch(/^globomotors_sessao=[A-Za-z0-9_-]{43};/);
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });

  it("marca o cookie como Secure quando a app roda com cookieSeguro", async () => {
    const vendedor = await api.criarVendedor();
    const servidor = await iniciarServidorDeTeste(
      criarApp({ repositorios: api.repositorios, logger: api.logger, cookieSeguro: true }),
    );
    try {
      const resposta = await fetch(`${servidor.url}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: vendedor.email, senha: "teste123" }),
      });
      expect(resposta.headers.getSetCookie()[0]).toContain("Secure");
    } finally {
      await servidor.fechar();
    }
  });

  it("aceita o e-mail com maiúsculas e espaços", async () => {
    const vendedor = await api.criarVendedor();
    const resposta = await api.requisitar("POST", "/auth/login", {
      corpo: { email: `  ${vendedor.email.toUpperCase()} `, senha: "teste123" },
    });
    expect(resposta.status).toBe(200);
  });

  it.each([
    ["senha errada", true],
    ["e-mail que não existe", false],
  ])("responde 401 com a mesma mensagem para %s, sem cookie", async (_caso, existe) => {
    const vendedor = await api.criarVendedor();
    const resposta = await api.requisitar("POST", "/auth/login", {
      corpo: existe
        ? { email: vendedor.email, senha: "errada123" }
        : { email: "ninguem@teste.com", senha: "teste123" },
    });

    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "credenciais_invalidas", mensagem: "E-mail ou senha incorretos." },
    });
    expect(resposta.headers.getSetCookie()).toEqual([]);
  });

  it("valida o corpo e devolve os erros por campo", async () => {
    const resposta = await api.requisitar("POST", "/auth/login", {
      corpo: { email: "nao-e-email", senha: "" },
    });

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({
      erro: {
        codigo: "validacao",
        mensagem: "Dados inválidos.",
        campos: [
          { campo: "email", mensagem: "E-mail inválido." },
          { campo: "senha", mensagem: "Informe a senha." },
        ],
      },
    });
  });

  it("recusa corpo que não é objeto", async () => {
    const resposta = await api.requisitar("POST", "/auth/login", { corpo: ["x"] });
    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toMatchObject({
      erro: { campos: [{ campo: "", mensagem: "Dados inválidos." }] },
    });
  });
});

describe("limite de tentativas de login", () => {
  const INICIO = new Date("2026-11-02T12:00:00.000Z").getTime();
  const MINUTO = 60_000;
  let isolada: ApiDeTeste;
  let atrasDoProxy: Awaited<ReturnType<typeof iniciarServidorDeTeste>>;
  let ultimoIp = 0;

  beforeAll(async () => {
    isolada = await prepararApiDeTeste();
    atrasDoProxy = await iniciarServidorDeTeste(
      criarApp({ repositorios: isolada.repositorios, logger: isolada.logger, confiarEmProxy: 1 }),
    );
  });

  afterAll(async () => {
    await atrasDoProxy.fechar();
    await isolada.encerrar();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(INICIO);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function ipNovo() {
    ultimoIp += 1;
    return `10.0.${Math.floor(ultimoIp / 256)}.${ultimoIp % 256}`;
  }

  function emailNovo() {
    return `ninguem-${randomUUID().slice(0, 6)}@teste.com`;
  }

  async function entrarDe(ip: string, email: string, senha = "errada123", url = atrasDoProxy.url) {
    const resposta = await fetch(`${url}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ email, senha }),
    });
    return { status: resposta.status, headers: resposta.headers, corpo: await resposta.json() };
  }

  async function errar(vezes: number, email: () => string, ip: () => string) {
    const status: number[] = [];
    for (let vez = 0; vez < vezes; vez++) status.push((await entrarDe(ip(), email())).status);
    return status;
  }

  it.each([
    ["que existe", true],
    ["que não existe", false],
  ])(
    "bloqueia o e-mail %s na 11ª tentativa em 15 minutos, mesmo com a senha certa",
    async (_caso, existe) => {
      const email = existe ? (await isolada.criarVendedor()).email : emailNovo();

      const erros = await errar(10, () => email, ipNovo);
      const bloqueado = await entrarDe(ipNovo(), email, "teste123");

      expect(erros).toEqual(Array<number>(10).fill(401));
      expect(bloqueado.status).toBe(429);
      expect(bloqueado.headers.get("retry-after")).toBe("900");
      expect(bloqueado.headers.getSetCookie()).toEqual([]);
      expect(bloqueado.corpo).toEqual({
        erro: {
          codigo: "muitas_tentativas",
          mensagem: "Muitas tentativas de login. Tente de novo em 15 min.",
        },
      });
    },
  );

  it("conta a janela a partir da primeira tentativa, sem estendê-la com as bloqueadas", async () => {
    const { email } = await isolada.criarVendedor();
    await errar(10, () => email, ipNovo);

    vi.setSystemTime(INICIO + 10 * MINUTO);
    const aos10 = await entrarDe(ipNovo(), email, "teste123");
    vi.setSystemTime(INICIO + 15 * MINUTO - 1000);
    const noUltimoSegundo = await entrarDe(ipNovo(), email, "teste123");
    vi.setSystemTime(INICIO + 15 * MINUTO);
    const aos15 = await entrarDe(ipNovo(), email, "teste123");

    expect([aos10.status, aos10.headers.get("retry-after")]).toEqual([429, "300"]);
    expect(aos10.corpo).toMatchObject({
      erro: { mensagem: "Muitas tentativas de login. Tente de novo em 5 min." },
    });
    expect([noUltimoSegundo.status, noUltimoSegundo.headers.get("retry-after")]).toEqual([
      429,
      "1",
    ]);
    expect(noUltimoSegundo.corpo).toMatchObject({
      erro: { mensagem: "Muitas tentativas de login. Tente de novo em 1 min." },
    });
    expect(aos15.status).toBe(200);
  });

  it("bloqueia o IP na 11ª tentativa, mesmo trocando de e-mail, sem afetar outros IPs", async () => {
    const ip = ipNovo();
    const { email } = await isolada.criarVendedor();

    const erros = await errar(10, emailNovo, () => ip);
    const mesmoIp = await entrarDe(ip, email, "teste123");
    const outroIp = await entrarDe(ipNovo(), email, "teste123");

    expect(erros).toEqual(Array<number>(10).fill(401));
    expect(mesmoIp.status).toBe(429);
    expect(outroIp.status).toBe(200);
  });

  it("zera a contagem do IP e do e-mail quando o login dá certo", async () => {
    const ip = ipNovo();
    const { email } = await isolada.criarVendedor();

    const antes = await errar(
      9,
      () => email,
      () => ip,
    );
    const certo = await entrarDe(ip, email, "teste123");
    const depois = await errar(
      10,
      () => email,
      () => ip,
    );

    expect(antes).toEqual(Array<number>(9).fill(401));
    expect(certo.status).toBe(200);
    expect(depois).toEqual(Array<number>(10).fill(401));
  });

  it("conta as tentativas simultâneas sem deixar passar mais de 10", async () => {
    const email = emailNovo();

    const respostas = await Promise.all(
      Array.from({ length: 15 }, () => entrarDe(ipNovo(), email)),
    );

    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([
      ...Array<number>(10).fill(401),
      ...Array<number>(5).fill(429),
    ]);
  });

  it("sem TRUST_PROXY, ignora o X-Forwarded-For e conta pelo IP da conexão", async () => {
    const status: number[] = [];
    for (let vez = 0; vez < 11; vez++) {
      status.push((await entrarDe(ipNovo(), emailNovo(), "errada123", isolada.url)).status);
    }

    expect(status).toEqual([...Array<number>(10).fill(401), 429]);
  });
});

describe("GET /api/auth/me", () => {
  it("devolve o vendedor da sessão", async () => {
    const vendedor = await api.criarVendedor();
    const login = await api.requisitar("POST", "/auth/login", {
      corpo: { email: vendedor.email, senha: "teste123" },
    });
    const resposta = await api.requisitar("GET", "/auth/me", { cookie: cookieDe(login.headers) });

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual({
      usuario: { id: vendedor.id, nome: vendedor.nome, email: vendedor.email },
    });
    expect(resposta.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    ["sem cookie", undefined],
    ["com token inventado", `globomotors_sessao=${"a".repeat(43)}`],
    ["com cookie vazio", "globomotors_sessao="],
  ])("responde 401 %s", async (_caso, cookie) => {
    const resposta = await api.requisitar("GET", "/auth/me", { cookie });

    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "nao_autenticado", mensagem: "Faça login para continuar." },
    });
  });

  it("recusa sessão expirada", async () => {
    const vendedor = await api.criarVendedor();
    const token = gerarToken();
    await api.repositorios.sessoes.criar({
      usuarioId: vendedor.id,
      tokenHash: hashDoToken(token),
      expiraEm: new Date(Date.now() - 1000),
    });

    const resposta = await api.requisitar("GET", "/auth/me", {
      cookie: `globomotors_sessao=${token}`,
    });
    expect(resposta.status).toBe(401);
  });

  it("não aceita o hash guardado no banco como token", async () => {
    const vendedor = await api.criarVendedor();
    const token = gerarToken();
    await api.repositorios.sessoes.criar({
      usuarioId: vendedor.id,
      tokenHash: hashDoToken(token),
      expiraEm: new Date(Date.now() + 60_000),
    });

    const comHash = await api.requisitar("GET", "/auth/me", {
      cookie: `globomotors_sessao=${hashDoToken(token)}`,
    });
    const comToken = await api.requisitar("GET", "/auth/me", {
      cookie: `globomotors_sessao=${token}`,
    });
    expect(comHash.status).toBe(401);
    expect(comToken.status).toBe(200);
  });
});

describe("POST /api/auth/logout", () => {
  it("apaga a sessão e limpa o cookie", async () => {
    const cookie = await api.entrar();
    const resposta = await api.requisitar("POST", "/auth/logout", { cookie });

    expect(resposta.status).toBe(204);
    const [limpeza] = resposta.headers.getSetCookie();
    expect(limpeza).toMatch(/^globomotors_sessao=;/);
    expect(limpeza).toContain("Expires=Thu, 01 Jan 1970");
    expect((await api.requisitar("GET", "/auth/me", { cookie })).status).toBe(401);
  });

  it("encerra só a sessão do cookie enviado", async () => {
    const vendedor = await api.criarVendedor();
    const corpo = { email: vendedor.email, senha: "teste123" };
    const celular = cookieDe((await api.requisitar("POST", "/auth/login", { corpo })).headers);
    const computador = cookieDe((await api.requisitar("POST", "/auth/login", { corpo })).headers);

    await api.requisitar("POST", "/auth/logout", { cookie: celular });

    expect((await api.requisitar("GET", "/auth/me", { cookie: celular })).status).toBe(401);
    expect((await api.requisitar("GET", "/auth/me", { cookie: computador })).status).toBe(200);
  });

  it("responde 204 mesmo sem sessão", async () => {
    expect((await api.requisitar("POST", "/auth/logout")).status).toBe(204);
  });
});
