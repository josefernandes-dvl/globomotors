import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, it } from "vitest";
import { criarRepositorios } from "../src/repositorios/index.ts";
import { verificarSenha } from "../src/senhas.ts";
import { criarBancoDeTeste } from "../src/testes/bancoDeTeste.ts";

const pastaServer = fileURLToPath(new URL("..", import.meta.url));

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;

beforeAll(async () => {
  banco = await criarBancoDeTeste();
});

afterAll(async () => {
  await banco.destruir();
});

async function criarVendedor(argumentos: string[], entrada = "") {
  const processo = spawn(process.execPath, ["scripts/criarVendedor.ts", ...argumentos], {
    cwd: pastaServer,
    env: { ...process.env, DATABASE_URL: banco.url },
  });
  let saida = "";
  let erros = "";
  processo.stdout.on("data", (pedaco) => (saida += String(pedaco)));
  processo.stderr.on("data", (pedaco) => (erros += String(pedaco)));
  processo.stdin.end(entrada);
  const [codigo] = (await once(processo, "close")) as [number | null];
  return { codigo, saida, erros };
}

function buscarVendedor(email: string) {
  return criarRepositorios(banco.db).usuarios.buscarPorEmail(email);
}

it("cria o vendedor com a senha lida da entrada, sem mostrá-la", async () => {
  const resultado = await criarVendedor(
    ["--nome", "Vendedor Teste", "--email", "Cli@GloboMotors.test"],
    "teste123\nteste123\n",
  );

  expect(resultado).toEqual({
    codigo: 0,
    saida: "Senha: \nRepita a senha: \nVendedor criado: Vendedor Teste <cli@globomotors.test>\n",
    erros: "",
  });
  const gravado = await buscarVendedor("cli@globomotors.test");
  expect(await verificarSenha("teste123", gravado?.senhaHash ?? "")).toBe(true);
});

it("recusa a senha passada como argumento, que ficaria no histórico e na lista de processos", async () => {
  const resultado = await criarVendedor(
    ["--nome", "Argumento", "--email", "argumento@globomotors.test", "--senha", "teste123"],
    "teste123\nteste123\n",
  );

  expect(resultado.codigo).toBe(1);
  expect(resultado.saida).toBe("");
  expect(resultado.erros).toContain("Unknown option '--senha'");
  expect(await buscarVendedor("argumento@globomotors.test")).toBeNull();
});

it("confere nome e e-mail antes de pedir a senha", async () => {
  const resultado = await criarVendedor(["--email", "invalido"]);

  expect(resultado).toEqual({
    codigo: 1,
    saida: "",
    erros: "✖ Informe o nome (--nome).\n  → at nome\n✖ E-mail inválido.\n  → at email\n",
  });
});

it("não cria o vendedor quando a confirmação não confere", async () => {
  const resultado = await criarVendedor(
    ["--nome", "Confirmacao", "--email", "confirmacao@globomotors.test"],
    "teste123\nteste321\n",
  );

  expect(resultado.codigo).toBe(1);
  expect(resultado.erros).toBe("As senhas não conferem.\n");
  expect(await buscarVendedor("confirmacao@globomotors.test")).toBeNull();
});
