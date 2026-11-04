import { randomUUID } from "node:crypto";
import type {
  CarroPainel,
  Cliente,
  ClienteComDesejos,
  Desejo,
  EtapaFunil,
  Interesse,
} from "@globomotors/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  carroDeTeste,
  clienteDeTeste,
  prepararApiDeTeste,
  type ApiDeTeste,
} from "../../testes/apiDeTeste.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ID_INEXISTENTE = "3f0c8a4e-7b1d-4c2e-9a6f-5d8b2e1c0a9f";
const INTERESSE_NAO_ENCONTRADO = {
  erro: { codigo: "nao_encontrado", mensagem: "Interesse não encontrado." },
};

let api: ApiDeTeste;
let cookie: string;

beforeAll(async () => {
  api = await prepararApiDeTeste();
  cookie = await api.entrar();
});

afterAll(async () => {
  await api.encerrar();
});

function modeloNovo() {
  return `Modelo${randomUUID().slice(0, 6)}`;
}

async function criarCliente(...desejos: string[]) {
  const resposta = await api.requisitar<{ cliente: Cliente }>("POST", "/dashboard/customers", {
    corpo: clienteDeTeste({ desejos }),
    cookie,
  });
  expect(resposta.status).toBe(201);
  return resposta.corpo.cliente;
}

async function criarCarro(extra: Record<string, unknown> = {}) {
  const resposta = await api.requisitar<{ carro: CarroPainel }>("POST", "/dashboard/cars", {
    corpo: carroDeTeste(extra),
    cookie,
  });
  expect(resposta.status).toBe(201);
  return resposta.corpo.carro;
}

async function colocarNoFunil(clienteId: string, carroId: string) {
  const resposta = await api.requisitar<{ interesse: Interesse }>("POST", "/dashboard/interests", {
    corpo: { clienteId, carroId },
    cookie,
  });
  expect(resposta.status).toBe(201);
  return resposta.corpo.interesse;
}

function criar(corpo: unknown) {
  return api.requisitar<{ desejo: Desejo }>("POST", "/dashboard/wishes", { corpo, cookie });
}

async function listar(...clienteIds: string[]) {
  const resposta = await api.requisitar<{ clientes: ClienteComDesejos[] }>(
    "GET",
    "/dashboard/wishes",
    { cookie },
  );
  expect(resposta.status).toBe(200);
  return resposta.corpo.clientes.filter(({ cliente }) => clienteIds.includes(cliente.id));
}

async function desejosDe(clienteId: string) {
  return (await listar(clienteId)).flatMap(({ desejos }) => desejos);
}

async function idDoDesejo(clienteId: string, nome: string) {
  const desejo = (await desejosDe(clienteId)).find((item) => item.nome === nome);
  if (!desejo) throw new Error(`O cliente não tem o interesse ${nome}.`);
  return desejo.id;
}

function atender(id: string, carroId: unknown) {
  return api.requisitar<{ interesse: Interesse }>("POST", `/dashboard/wishes/${id}/attend`, {
    corpo: { carroId },
    cookie,
  });
}

function possivel(carro: CarroPainel) {
  return {
    id: carro.id,
    marca: carro.marca,
    modelo: carro.modelo,
    versao: carro.versao,
    anoFabricacao: carro.anoFabricacao,
    anoModelo: carro.anoModelo,
    precoVenda: carro.precoVenda,
  };
}

describe("GET /api/dashboard/wishes", () => {
  it("devolve lista vazia quando nenhum cliente tem interesse", async () => {
    await criarCliente();

    const resposta = await api.requisitar("GET", "/dashboard/wishes", { cookie });

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual({ clientes: [] });
  });

  it("agrupa por cliente e põe primeiro quem tem veículo compatível chegado por último", async () => {
    const primeiroModelo = modeloNovo();
    const segundoModelo = modeloNovo();
    const semVeiculo = await criarCliente(modeloNovo());
    const antigo = await criarCliente(primeiroModelo);
    const primeiroCarro = await criarCarro({ modelo: primeiroModelo });
    const recente = await criarCliente(modeloNovo());
    const novo = await criarCliente(`${segundoModelo} manual`, `${segundoModelo} automático`);
    const segundoCarro = await criarCarro({ modelo: segundoModelo });

    const grupos = await listar(semVeiculo.id, antigo.id, recente.id, novo.id);

    expect(grupos.map(({ cliente }) => cliente.id)).toEqual([
      novo.id,
      antigo.id,
      recente.id,
      semVeiculo.id,
    ]);
    expect(grupos[0]).toEqual({
      cliente: { id: novo.id, nome: novo.nome, telefone: novo.telefone },
      possivelDesde: segundoCarro.publicadoEm,
      desejos: [
        {
          id: expect.stringMatching(UUID) as unknown,
          nome: `${segundoModelo} manual`,
          anoMinimo: null,
          precoMaximo: null,
          observacoes: null,
          criadoEm: expect.any(String) as unknown,
          possiveis: [],
        },
        expect.objectContaining({
          nome: `${segundoModelo} automático`,
          possiveis: [possivel(segundoCarro)],
        }),
      ],
    });
    expect(grupos[1]?.possivelDesde).toBe(primeiroCarro.publicadoEm);
    expect(grupos.slice(2).map(({ possivelDesde }) => possivelDesde)).toEqual([null, null]);
  });

  it("não sugere veículo fora do catálogo nem o que o cliente já tem no funil", async () => {
    const modelo = modeloNovo();
    const cliente = await criarCliente(modelo);
    await criarCarro({ modelo, status: "rascunho" });
    await criarCarro({ modelo, status: "reservado" });
    await criarCarro({ modelo, status: "vendido" });
    await colocarNoFunil(cliente.id, (await criarCarro({ modelo })).id);

    const [grupo] = await listar(cliente.id);

    expect(grupo).toMatchObject({
      possivelDesde: null,
      desejos: [{ nome: modelo, possiveis: [] }],
    });
  });
});

describe("POST /api/dashboard/wishes", () => {
  it("cadastra o interesse com os veículos do catálogo que já combinam", async () => {
    const modelo = modeloNovo();
    const cliente = await criarCliente();
    const carro = await criarCarro({ modelo });

    const resposta = await criar({
      clienteId: cliente.id,
      nome: ` ${modelo} prata `,
      anoMinimo: 2023,
      precoMaximo: 8_990_000,
      observacoes: "Quer pagar à vista.",
    });

    expect(resposta.status).toBe(201);
    expect(resposta.corpo.desejo).toEqual({
      id: expect.stringMatching(UUID) as unknown,
      nome: `${modelo} prata`,
      anoMinimo: 2023,
      precoMaximo: 8_990_000,
      observacoes: "Quer pagar à vista.",
      criadoEm: expect.any(String) as unknown,
      possiveis: [possivel(carro)],
    });
    expect(new Date(resposta.corpo.desejo.criadoEm).toISOString()).toBe(
      resposta.corpo.desejo.criadoEm,
    );
    expect(await desejosDe(cliente.id)).toEqual([resposta.corpo.desejo]);
    const ficha = await api.requisitar<{ cliente: Cliente }>(
      "GET",
      `/dashboard/customers/${cliente.id}`,
      { cookie },
    );
    expect(ficha.corpo.cliente.desejos).toEqual([`${modelo} prata`]);
  });

  it("não sugere veículo acima do preço máximo ou abaixo do ano mínimo", async () => {
    const modelo = modeloNovo();
    const cliente = await criarCliente();
    await criarCarro({ modelo });

    const caro = await criar({ clienteId: cliente.id, nome: modelo, precoMaximo: 8_989_999 });
    const velho = await criar({ clienteId: cliente.id, nome: `${modelo} flex`, anoMinimo: 2024 });

    expect([caro.status, velho.status]).toEqual([201, 201]);
    expect([caro.corpo.desejo.possiveis, velho.corpo.desejo.possiveis]).toEqual([[], []]);
  });

  it("recusa o mesmo interesse duas vezes no cliente, sem diferenciar maiúsculas", async () => {
    const cliente = await criarCliente("Onix Turbo");

    const repetido = await criar({ clienteId: cliente.id, nome: "ONIX turbo" });
    const deOutroCliente = await criar({
      clienteId: (await criarCliente()).id,
      nome: "Onix Turbo",
    });

    expect(repetido.status).toBe(409);
    expect(repetido.corpo).toEqual({
      erro: {
        codigo: "conflito",
        mensagem: "Este cliente já tem este interesse.",
        campos: [{ campo: "nome", mensagem: "Este cliente já tem este interesse." }],
      },
    });
    expect(deOutroCliente.status).toBe(201);
    expect((await desejosDe(cliente.id)).map(({ nome }) => nome)).toEqual(["Onix Turbo"]);
  });

  it("valida os campos", async () => {
    const resposta = await criar({ clienteId: "abc", nome: " ", precoMaximo: -1 });

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({
      erro: {
        codigo: "validacao",
        mensagem: "Dados inválidos.",
        campos: [
          { campo: "clienteId", mensagem: "Escolha um cliente." },
          { campo: "nome", mensagem: "Informe o veículo procurado." },
          { campo: "precoMaximo", mensagem: "O valor não pode ser negativo." },
        ],
      },
    });
  });

  it("responde 404 para cliente inexistente", async () => {
    const resposta = await criar({ clienteId: ID_INEXISTENTE, nome: "Onix" });

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "nao_encontrado", mensagem: "Cliente não encontrado." },
    });
  });
});

describe("DELETE /api/dashboard/wishes/:id", () => {
  it("apaga o interesse e mantém o cliente com os outros", async () => {
    const cliente = await criarCliente("Onix", "HB20");
    const id = await idDoDesejo(cliente.id, "Onix");

    const resposta = await api.requisitar("DELETE", `/dashboard/wishes/${id}`, { cookie });
    const denovo = await api.requisitar("DELETE", `/dashboard/wishes/${id}`, { cookie });

    expect(resposta.status).toBe(204);
    expect(resposta.texto).toBe("");
    expect(denovo.status).toBe(404);
    expect(denovo.corpo).toEqual(INTERESSE_NAO_ENCONTRADO);
    expect((await desejosDe(cliente.id)).map(({ nome }) => nome)).toEqual(["HB20"]);
  });

  it("responde 404 para id malformado", async () => {
    const resposta = await api.requisitar("DELETE", "/dashboard/wishes/abc", { cookie });

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual(INTERESSE_NAO_ENCONTRADO);
  });
});

describe("POST /api/dashboard/wishes/:id/attend", () => {
  it("põe o cliente em contato com o veículo escolhido e tira o interesse da lista", async () => {
    const modelo = modeloNovo();
    const cliente = await criarCliente(modelo, "Outro interesse");
    const carro = await criarCarro({ modelo });

    const resposta = await atender(await idDoDesejo(cliente.id, modelo), carro.id);

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.interesse).toMatchObject({
      etapa: "em_contato",
      motivoPerda: null,
      cliente: { id: cliente.id, nome: cliente.nome },
      carro: { id: carro.id, modelo },
    });
    expect((await desejosDe(cliente.id)).map(({ nome }) => nome)).toEqual(["Outro interesse"]);
    const funil = await api.requisitar<{ interesses: Interesse[] }>(
      "GET",
      `/dashboard/interests?customerId=${cliente.id}`,
      { cookie },
    );
    expect(funil.corpo.interesses).toEqual([resposta.corpo.interesse]);
  });

  it.each<[EtapaFunil, EtapaFunil, string | null]>([
    ["novo", "em_contato", null],
    ["perdido", "em_contato", "Comprou em outra loja."],
    ["proposta", "proposta", null],
  ])("quem já estava em %s no funil do veículo fica em %s", async (antes, depois, motivo) => {
    const modelo = modeloNovo();
    const cliente = await criarCliente(modelo);
    const carro = await criarCarro({ modelo });
    const noFunil = await colocarNoFunil(cliente.id, carro.id);
    if (antes !== "novo") {
      const movido = await api.requisitar("PATCH", `/dashboard/interests/${noFunil.id}`, {
        corpo: { etapa: antes, motivoPerda: motivo },
        cookie,
      });
      expect(movido.status).toBe(200);
    }

    const resposta = await atender(await idDoDesejo(cliente.id, modelo), carro.id);

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.interesse).toMatchObject({
      id: noFunil.id,
      etapa: depois,
      motivoPerda: null,
    });
    expect(await listar(cliente.id)).toEqual([]);
  });

  it("veículo inexistente responde 404 e mantém o interesse", async () => {
    const cliente = await criarCliente("Onix");

    const resposta = await atender(await idDoDesejo(cliente.id, "Onix"), ID_INEXISTENTE);

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "nao_encontrado", mensagem: "Veículo não encontrado." },
    });
    expect((await desejosDe(cliente.id)).map(({ nome }) => nome)).toEqual(["Onix"]);
  });

  it.each([ID_INEXISTENTE, "abc"])("interesse %s responde 404", async (id) => {
    const resposta = await atender(id, (await criarCarro()).id);

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual(INTERESSE_NAO_ENCONTRADO);
  });

  it("exige o veículo escolhido", async () => {
    const cliente = await criarCliente("Onix");

    const resposta = await atender(await idDoDesejo(cliente.id, "Onix"), "abc");

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({
      erro: {
        codigo: "validacao",
        mensagem: "Dados inválidos.",
        campos: [{ campo: "carroId", mensagem: "Escolha um veículo." }],
      },
    });
    expect(await desejosDe(cliente.id)).toHaveLength(1);
  });
});
