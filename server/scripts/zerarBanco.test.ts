import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  carros,
  carrosDescartados,
  clientes,
  desejos,
  fotosCarro,
  interesses,
  sessoes,
  tentativasLogin,
  usuarios,
} from "../src/db/schema.ts";
import { verificarSenha } from "../src/senhas.ts";
import {
  type ApiDeTeste,
  carroDeTeste,
  clienteDeTeste,
  fotoDeTeste,
  prepararApiDeTeste,
} from "../src/testes/apiDeTeste.ts";

const pastaServer = fileURLToPath(new URL("..", import.meta.url));

const LOJA = {
  nome: "Loja de Teste",
  cidade: "Goiânia - GO",
  slogan: "Seminovos com garantia",
  whatsapp: "62999990000",
  instagram: "loja.teste",
  mostrarPreco: false,
  mostrarVendidos: true,
};

const ALAN = ["--nome", "Alan", "--email", "alan@loja.test"];

let api: ApiDeTeste;

beforeAll(async () => {
  api = await prepararApiDeTeste();
});

afterAll(async () => {
  await api.encerrar();
});

async function zerarBanco(argumentos: string[], entrada = "", url = api.banco.url) {
  const processo = spawn(process.execPath, ["scripts/zerarBanco.ts", ...argumentos], {
    cwd: pastaServer,
    env: { ...process.env, DATABASE_URL: url },
  });
  let saida = "";
  let erros = "";
  processo.stdout.on("data", (pedaco) => (saida += String(pedaco)));
  processo.stderr.on("data", (pedaco) => (erros += String(pedaco)));
  processo.stdin.end(entrada);
  const [codigo] = (await once(processo, "close")) as [number | null];
  return { codigo, saida, erros };
}

async function povoar() {
  const cookie = await api.entrar();
  const { corpo: novoCarro } = await api.requisitar<{ carro: { id: string } }>(
    "POST",
    "/dashboard/cars",
    { corpo: carroDeTeste(), cookie },
  );
  await api.requisitar("POST", `/dashboard/cars/${novoCarro.carro.id}/photos`, {
    corpo: fotoDeTeste("jpeg"),
    tipo: "image/jpeg",
    cookie,
  });
  const { corpo: novoCliente } = await api.requisitar<{ cliente: { id: string } }>(
    "POST",
    "/dashboard/customers",
    { corpo: clienteDeTeste(), cookie },
  );
  const { corpo: novoDesejo } = await api.requisitar<{ desejo: { id: string } }>(
    "POST",
    "/dashboard/wishes",
    { corpo: { clienteId: novoCliente.cliente.id, nome: "Onix automático" }, cookie },
  );
  await api.requisitar("POST", `/dashboard/wishes/${novoDesejo.desejo.id}/dismiss`, {
    corpo: { carroId: novoCarro.carro.id },
    cookie,
  });
  await api.requisitar("POST", "/dashboard/interests", {
    corpo: { clienteId: novoCliente.cliente.id, carroId: novoCarro.carro.id },
    cookie,
  });
  await api.requisitar("PUT", "/dashboard/store", { corpo: LOJA, cookie });
  await api.requisitar("POST", "/auth/login", {
    corpo: { email: "ninguem@teste.com", senha: "errada123" },
  });
  return cookie;
}

async function contar() {
  const { db } = api.banco;
  return {
    usuarios: await db.$count(usuarios),
    sessoes: await db.$count(sessoes),
    carros: await db.$count(carros),
    fotos: await db.$count(fotosCarro),
    clientes: await db.$count(clientes),
    desejos: await db.$count(desejos),
    descartados: await db.$count(carrosDescartados),
    interesses: await db.$count(interesses),
    tentativas: await db.$count(tentativasLogin),
  };
}

it("deixa só o vendedor informado, sem carros, fotos, clientes, interesses nem sessões, e mantém a loja", async () => {
  const cookie = await povoar();
  expect(await contar()).toEqual({
    usuarios: 1,
    sessoes: 1,
    carros: 1,
    fotos: 1,
    clientes: 1,
    desejos: 1,
    descartados: 1,
    interesses: 1,
    tentativas: 2,
  });

  const resultado = await zerarBanco(ALAN, "teste123\nteste123\n");

  expect(resultado).toEqual({
    codigo: 0,
    saida:
      "Senha: \nRepita a senha: \nBanco zerado: ficou só o vendedor Alan <alan@loja.test>, e a configuração da loja foi mantida.\n",
    erros: "",
  });
  expect(await contar()).toEqual({
    usuarios: 1,
    sessoes: 0,
    carros: 0,
    fotos: 0,
    clientes: 0,
    desejos: 0,
    descartados: 0,
    interesses: 0,
    tentativas: 0,
  });
  const alan = await api.repositorios.usuarios.buscarPorEmail("alan@loja.test");
  expect(await verificarSenha("teste123", alan?.senhaHash ?? "")).toBe(true);
  expect(await api.repositorios.loja.obter()).toEqual(LOJA);
  expect((await api.requisitar("GET", "/auth/me", { cookie })).status).toBe(401);
});

it.each([
  ["a confirmação não confere", "teste123\nteste321\n", "As senhas não conferem.\n"],
  [
    "a senha é curta",
    "curta\ncurta\n",
    "✖ A senha precisa de pelo menos 8 caracteres.\n  → at senha\n",
  ],
])("não apaga nada quando %s", async (_, entrada, erro) => {
  await povoar();
  const antes = await contar();

  const resultado = await zerarBanco(ALAN, entrada);

  expect(resultado.codigo).toBe(1);
  expect(resultado.erros).toBe(erro);
  expect(await contar()).toEqual(antes);
});

it("recusa um banco que não é o local, antes de pedir a senha", async () => {
  const resultado = await zerarBanco(
    ALAN,
    "teste123\nteste123\n",
    "postgres://globomotors:x@ep-exemplo.sa-east-1.aws.neon.tech/neondb",
  );

  expect(resultado).toEqual({
    codigo: 1,
    saida: "",
    erros:
      "Este script apaga todos os dados e só roda no banco local, mas o DATABASE_URL aponta para ep-exemplo.sa-east-1.aws.neon.tech.\n",
  });
});

it("confere nome e e-mail antes de pedir a senha", async () => {
  const resultado = await zerarBanco(["--email", "invalido"]);

  expect(resultado).toEqual({
    codigo: 1,
    saida: "",
    erros: "✖ Informe o nome (--nome).\n  → at nome\n✖ E-mail inválido.\n  → at email\n",
  });
});
