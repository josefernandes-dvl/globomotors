import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PASTA_MIGRATIONS } from "../src/db/migrar.ts";
import { criarBancoDeTeste } from "../src/testes/bancoDeTeste.ts";
import {
  cabecalhosDoHelmet,
  migrarNoDeploy,
  montarSaidaVercel,
  rotasDaVercel,
} from "./saidaVercel.ts";

type BancoDeTeste = Awaited<ReturnType<typeof criarBancoDeTeste>>;

const URL_BANCO_FORA_DO_AR = "postgres://globomotors:x@127.0.0.1:1/nada";

const SUBIR_FUNCAO = `
import { createServer } from "node:http";
const { default: app } = await import(process.argv[1]);
const servidor = createServer((req, res) => app(req, res));
servidor.listen(0, "127.0.0.1", () => console.log(servidor.address().port));
`;

describe("montarSaidaVercel", () => {
  let pasta: string;
  let saida: string;

  beforeAll(async () => {
    pasta = await mkdtemp(join(tmpdir(), "globomotors-vercel-"));
    saida = join(pasta, "saida");
    await mkdir(join(pasta, "web/assets"), { recursive: true });
    await writeFile(join(pasta, "web/index.html"), "<!doctype html><title>Globo Motors</title>");
    await writeFile(join(pasta, "web/assets/index-abc123.js"), "console.log(1);");
    await mkdir(join(saida, "static"), { recursive: true });
    await writeFile(join(saida, "static/de-um-build-antigo.js"), "");
    await montarSaidaVercel({ pastaWeb: join(pasta, "web"), pastaSaida: saida });
  });

  afterAll(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  it("copia o build do front para static e apaga a saída anterior", async () => {
    expect((await readdir(join(saida, "static"), { recursive: true })).sort()).toEqual([
      "assets",
      "assets/index-abc123.js",
      "index.html",
    ]);
    expect(await readFile(join(saida, "static/index.html"), "utf8")).toBe(
      "<!doctype html><title>Globo Motors</title>",
    );
  });

  it("configura a função da API em Node 24, na região de São Paulo e com até 60 s para a leitura da IA", async () => {
    const config: unknown = JSON.parse(
      await readFile(join(saida, "functions/api.func/.vc-config.json"), "utf8"),
    );

    expect(config).toEqual({
      runtime: "nodejs24.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      regions: ["gru1"],
      maxDuration: 60,
    });
  });

  it("grava as rotas: segurança no front, /api na função, fallback do SPA e cache longo só em asset que existe", async () => {
    const config: unknown = JSON.parse(await readFile(join(saida, "config.json"), "utf8"));

    expect(config).toEqual({
      version: 3,
      routes: [
        { src: "^/(?!api(?:/|$)).*$", headers: cabecalhosDoHelmet(), continue: true },
        { src: "^/api(?:/.*)?$", dest: "/api" },
        { handle: "filesystem" },
        { src: "^/assets/.*$", status: 404 },
        { src: "^/.*$", dest: "/index.html" },
        { handle: "hit" },
        {
          src: "^/assets/.*$",
          headers: { "cache-control": "public, max-age=31536000, immutable" },
          continue: true,
        },
      ],
    });
  });

  it("gera a função sem dependências de fora, com os mesmos cabeçalhos de segurança do front", async () => {
    const banco = await criarBancoDeTeste();
    const arquivo = pathToFileURL(join(saida, "functions/api.func/index.mjs")).href;
    const processo = spawn(process.execPath, ["--input-type=module", "-e", SUBIR_FUNCAO, arquivo], {
      cwd: pasta,
      env: { ...process.env, DATABASE_URL: banco.url, LOG_LEVEL: "silent" },
    });
    let erros = "";
    processo.stderr.on("data", (pedaco) => (erros += String(pedaco)));

    try {
      const porta = await new Promise<string>((resolve, reject) => {
        processo.stdout.once("data", (pedaco) => resolve(String(pedaco).trim()));
        processo.once("close", () => reject(new Error(erros)));
      });
      const resposta = await fetch(`http://127.0.0.1:${porta}/api/health`);
      const cabecalhos = cabecalhosDoHelmet();

      expect(resposta.status).toBe(200);
      expect(await resposta.json()).toEqual({ status: "ok", banco: "ok" });
      expect(
        Object.fromEntries(
          Object.keys(cabecalhos).map((nome) => [nome, resposta.headers.get(nome)]),
        ),
      ).toEqual(cabecalhos);
    } finally {
      processo.kill("SIGKILL");
      await banco.destruir();
    }
  });
});

describe("rotasDaVercel", () => {
  const CAMINHOS = [
    "/",
    "/catalogo/chevrolet-onix-1-0-turbo-2023-a1b2c3",
    "/login",
    "/apix",
    "/assets/index-abc123.js",
    "/api",
    "/api/health",
    "/api/showroom/photos/3f0c8a4e",
  ];
  const rotas = rotasDaVercel();
  const [rotaDoFront, rotaDaApi, , rotaDoAssetInexistente, , , rotaDoCacheLongo] = rotas;

  function casam(src = "") {
    return CAMINHOS.filter((caminho) => new RegExp(src).test(caminho));
  }

  it("ancora todo src com ^ e $, que a Vercel acrescenta quando faltam e mudaria o que casa", () => {
    expect(
      rotas.filter(({ src }) => src !== undefined && !(src.startsWith("^") && src.endsWith("$"))),
    ).toEqual([]);
  });

  it("dá 404 e cache longo só ao que fica abaixo de /assets", () => {
    expect(casam(rotaDoAssetInexistente?.src)).toEqual(["/assets/index-abc123.js"]);
    expect(casam(rotaDoCacheLongo?.src)).toEqual(["/assets/index-abc123.js"]);
  });

  it("manda para a função só /api e o que fica abaixo dele", () => {
    expect(casam(rotaDaApi?.src)).toEqual(["/api", "/api/health", "/api/showroom/photos/3f0c8a4e"]);
  });

  it("põe os cabeçalhos de segurança em tudo que não é da API, que já sai com os do Express", () => {
    expect(casam(rotaDoFront?.src)).toEqual([
      "/",
      "/catalogo/chevrolet-onix-1-0-turbo-2023-a1b2c3",
      "/login",
      "/apix",
      "/assets/index-abc123.js",
    ]);
  });
});

describe("migrarNoDeploy", () => {
  async function comBancoVazio(teste: (banco: BancoDeTeste) => Promise<void>) {
    const banco = await criarBancoDeTeste({ migrar: false });
    try {
      await teste(banco);
    } finally {
      await banco.destruir();
    }
  }

  async function migrationsAplicadas(banco: BancoDeTeste) {
    const { rows } = await banco.pool.query<{ tabela: string | null }>(
      "select to_regclass('drizzle.__drizzle_migrations')::text as tabela",
    );
    if (!rows[0]?.tabela) return 0;
    const { rows: aplicadas } = await banco.pool.query<{ total: number }>(
      "select count(*)::int as total from drizzle.__drizzle_migrations",
    );
    return aplicadas[0]?.total;
  }

  const TOTAL_DE_MIGRATIONS = readMigrationFiles({ migrationsFolder: PASTA_MIGRATIONS }).length;

  it("não mexe no banco fora do deploy de produção", async () => {
    await comBancoVazio(async (banco) => {
      for (const VERCEL_ENV of [undefined, "development", "preview"]) {
        expect(await migrarNoDeploy({ VERCEL_ENV, DATABASE_URL: banco.url })).toBe(false);
      }

      expect(await migrationsAplicadas(banco)).toBe(0);
    });
  });

  it("no deploy de produção, aplica as migrations pela conexão direta do Neon", async () => {
    await comBancoVazio(async (banco) => {
      const aplicou = await migrarNoDeploy({
        VERCEL_ENV: "production",
        DATABASE_URL: URL_BANCO_FORA_DO_AR,
        DATABASE_URL_UNPOOLED: banco.url,
      });

      expect(aplicou).toBe(true);
      expect(await migrationsAplicadas(banco)).toBe(TOTAL_DE_MIGRATIONS);
    });
  });

  it("sem a conexão direta, aplica pelo DATABASE_URL", async () => {
    await comBancoVazio(async (banco) => {
      expect(await migrarNoDeploy({ VERCEL_ENV: "production", DATABASE_URL: banco.url })).toBe(
        true,
      );
      expect(await migrationsAplicadas(banco)).toBe(TOTAL_DE_MIGRATIONS);
    });
  });

  it("falha o build de produção sem banco ou com o banco fora do ar", async () => {
    await expect(migrarNoDeploy({ VERCEL_ENV: "production" })).rejects.toThrow(
      "Sem DATABASE_URL no deploy de produção: conecte o banco Neon ao projeto na aba Storage da Vercel.",
    );
    await expect(
      migrarNoDeploy({ VERCEL_ENV: "production", DATABASE_URL_UNPOOLED: URL_BANCO_FORA_DO_AR }),
    ).rejects.toThrow();
  });
});
