import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { tentativasLogin } from "../db/schema.ts";
import { criarBancoDeTeste } from "../testes/bancoDeTeste.ts";
import { criarRepositorioTentativasLogin } from "./tentativasLogin.ts";

const INICIO = new Date("2026-11-02T12:00:00.000Z");
const JANELA = 15 * 60_000;

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let repositorio: ReturnType<typeof criarRepositorioTentativasLogin>;

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  repositorio = criarRepositorioTentativasLogin(banco.db);
});

afterAll(async () => {
  await banco.destruir();
});

beforeEach(async () => {
  await banco.db.delete(tentativasLogin);
});

async function chavesGravadas() {
  const linhas = await banco.db.select({ chave: tentativasLogin.chave }).from(tentativasLogin);
  return linhas.map(({ chave }) => chave).sort();
}

it("apaga só as tentativas com a janela vencida", async () => {
  await repositorio.registrar("ip:vencida", INICIO, JANELA);
  await repositorio.registrar("ip:vigente", new Date(INICIO.getTime() + 1000), JANELA);

  await repositorio.apagarExpiradas(new Date(INICIO.getTime() + JANELA));

  expect(await chavesGravadas()).toEqual(["ip:vigente"]);
});

it("limpa só as chaves do login que deu certo", async () => {
  await repositorio.registrar("ip:loja", INICIO, JANELA);
  await repositorio.registrar("email:vendedor@teste.com", INICIO, JANELA);
  await repositorio.registrar("email:outro@teste.com", INICIO, JANELA);

  await repositorio.limpar(["ip:loja", "email:vendedor@teste.com"]);

  expect(await chavesGravadas()).toEqual(["email:outro@teste.com"]);
});
