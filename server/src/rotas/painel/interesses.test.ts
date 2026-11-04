import type { CarroPainel, Cliente, FotoCarro, Interesse } from "@globomotors/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  carroDeTeste,
  clienteDeTeste,
  fotoDeTeste,
  prepararApiDeTeste,
  type ApiDeTeste,
} from "../../testes/apiDeTeste.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ID_INEXISTENTE = "3f0c8a4e-7b1d-4c2e-9a6f-5d8b2e1c0a9f";

let api: ApiDeTeste;
let cookie: string;

beforeAll(async () => {
  api = await prepararApiDeTeste();
  cookie = await api.entrar();
});

afterAll(async () => {
  await api.encerrar();
});

interface RespostaInteresse {
  interesse: Interesse;
}

async function criarCarro(extra: Record<string, unknown> = {}) {
  const resposta = await api.requisitar<{ carro: CarroPainel }>("POST", "/dashboard/cars", {
    corpo: carroDeTeste(extra),
    cookie,
  });
  return resposta.corpo.carro;
}

async function buscarCarro(id: string) {
  const resposta = await api.requisitar<{ carro: CarroPainel }>("GET", `/dashboard/cars/${id}`, {
    cookie,
  });
  return resposta.corpo.carro;
}

async function criarCliente() {
  const resposta = await api.requisitar<{ cliente: Cliente }>("POST", "/dashboard/customers", {
    corpo: clienteDeTeste(),
    cookie,
  });
  return resposta.corpo.cliente;
}

function criar(corpo: unknown) {
  return api.requisitar<RespostaInteresse>("POST", "/dashboard/interests", { corpo, cookie });
}

async function criarInteresse(clienteId?: string, carroId?: string) {
  const resposta = await criar({
    clienteId: clienteId ?? (await criarCliente()).id,
    carroId: carroId ?? (await criarCarro()).id,
  });
  expect(resposta.status).toBe(201);
  return resposta.corpo.interesse;
}

function mover(id: string, corpo: unknown) {
  return api.requisitar<RespostaInteresse>("PATCH", `/dashboard/interests/${id}`, {
    corpo,
    cookie,
  });
}

async function listar(consulta = "") {
  const resposta = await api.requisitar<{ interesses: Interesse[] }>(
    "GET",
    `/dashboard/interests${consulta}`,
    { cookie },
  );
  expect(resposta.status).toBe(200);
  return resposta.corpo.interesses;
}

describe("GET /api/dashboard/interests", () => {
  it("devolve lista vazia quando não há interesses", async () => {
    expect(await listar()).toEqual([]);
  });

  it("filtra por carro, por cliente ou pelos dois", async () => {
    const [carroA, carroB, ana, bia] = await Promise.all([
      criarCarro(),
      criarCarro(),
      criarCliente(),
      criarCliente(),
    ]);
    const anaNoA = await criarInteresse(ana.id, carroA.id);
    const biaNoA = await criarInteresse(bia.id, carroA.id);
    const anaNoB = await criarInteresse(ana.id, carroB.id);
    const ids = (interesses: Interesse[]) => interesses.map((interesse) => interesse.id).sort();

    expect(ids(await listar(`?carId=${carroA.id}`))).toEqual([anaNoA.id, biaNoA.id].sort());
    expect(ids(await listar(`?customerId=${ana.id}`))).toEqual([anaNoA.id, anaNoB.id].sort());
    expect(ids(await listar(`?carId=${carroA.id}&customerId=${ana.id}`))).toEqual([anaNoA.id]);
    expect(await listar(`?carId=${ID_INEXISTENTE}`)).toEqual([]);
  });

  it("ordena pela última atualização", async () => {
    const carro = await criarCarro();
    const primeiro = await criarInteresse(undefined, carro.id);
    const segundo = await criarInteresse(undefined, carro.id);
    await mover(primeiro.id, { etapa: "em_contato" });

    const interesses = await listar(`?carId=${carro.id}`);

    expect(interesses.map((interesse) => interesse.id)).toEqual([primeiro.id, segundo.id]);
  });

  it.each([
    ["carId", "Veículo inválido."],
    ["customerId", "Cliente inválido."],
  ])("recusa %s inválido", async (campo, mensagem) => {
    const resposta = await api.requisitar("GET", `/dashboard/interests?${campo}=abc`, { cookie });

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "validacao", mensagem: "Dados inválidos.", campos: [{ campo, mensagem }] },
    });
  });
});

describe("POST /api/dashboard/interests", () => {
  it("vincula cliente e carro na etapa novo e devolve os resumos", async () => {
    const carro = await criarCarro();
    const cliente = await criarCliente();

    const resposta = await criar({ clienteId: cliente.id, carroId: carro.id });

    expect(resposta.status).toBe(201);
    const { id, criadoEm, atualizadoEm } = resposta.corpo.interesse;
    expect(resposta.corpo).toEqual({
      interesse: {
        id,
        etapa: "novo",
        motivoPerda: null,
        criadoEm,
        atualizadoEm,
        cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone },
        carro: {
          id: carro.id,
          marca: "Chevrolet",
          modelo: "Onix",
          versao: "1.0 Turbo LT",
          anoModelo: 2023,
          status: "disponivel",
          capa: null,
        },
      },
    });
    expect(id).toMatch(UUID);
    expect(new Date(criadoEm).toISOString()).toBe(criadoEm);
    expect((await buscarCarro(carro.id)).interessados).toBe(1);
  });

  it("usa a primeira foto do carro como capa", async () => {
    const carro = await criarCarro();
    const enviar = () =>
      api.requisitar<{ foto: FotoCarro }>("POST", `/dashboard/cars/${carro.id}/photos`, {
        corpo: fotoDeTeste("jpeg"),
        tipo: "image/jpeg",
        cookie,
      });
    const primeira = (await enviar()).corpo.foto;
    const segunda = (await enviar()).corpo.foto;
    await api.requisitar("PATCH", `/dashboard/cars/${carro.id}/photos`, {
      corpo: { ordem: [segunda.id, primeira.id] },
      cookie,
    });

    const interesse = await criarInteresse(undefined, carro.id);

    expect(interesse.carro.capa).toBe(segunda.url);
  });

  it("aceita interesse em carro fora da vitrine", async () => {
    const carro = await criarCarro({ status: "rascunho" });

    const interesse = await criarInteresse(undefined, carro.id);

    expect(interesse.carro.status).toBe("rascunho");
  });

  it("recusa o mesmo cliente duas vezes no mesmo carro", async () => {
    const { cliente, carro } = await criarInteresse();

    const resposta = await criar({ clienteId: cliente.id, carroId: carro.id });

    expect(resposta.status).toBe(409);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "conflito", mensagem: "Este cliente já está interessado neste veículo." },
    });
    expect(await listar(`?carId=${carro.id}`)).toHaveLength(1);
  });

  it.each([
    ["cliente", "Cliente não encontrado.", { clienteId: ID_INEXISTENTE }],
    ["carro", "Veículo não encontrado.", { carroId: ID_INEXISTENTE }],
  ])("responde 404 para %s que não existe", async (_caso, mensagem, inexistente) => {
    const corpo = { clienteId: (await criarCliente()).id, carroId: (await criarCarro()).id };

    const resposta = await criar({ ...corpo, ...inexistente });

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual({ erro: { codigo: "nao_encontrado", mensagem } });
  });

  it.each([
    ["ausentes", {}],
    ["inválidos", { clienteId: "abc", carroId: 42 }],
  ])("recusa ids %s", async (_caso, corpo) => {
    const resposta = await criar(corpo);

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({
      erro: {
        codigo: "validacao",
        mensagem: "Dados inválidos.",
        campos: [
          { campo: "clienteId", mensagem: "Escolha um cliente." },
          { campo: "carroId", mensagem: "Escolha um veículo." },
        ],
      },
    });
  });
});

describe("PATCH /api/dashboard/interests/:id", () => {
  it("move o interesse pelas etapas do funil", async () => {
    const interesse = await criarInteresse();

    for (const etapa of ["em_contato", "visita_agendada", "proposta", "negociacao", "vendido"]) {
      const resposta = await mover(interesse.id, { etapa });
      expect(resposta.status).toBe(200);
      expect(resposta.corpo.interesse).toMatchObject({
        id: interesse.id,
        etapa,
        motivoPerda: null,
      });
    }
    const [atual] = await listar(`?carId=${interesse.carro.id}`);
    expect(atual?.etapa).toBe("vendido");
    expect(atual && atual.atualizadoEm > interesse.atualizadoEm).toBe(true);
  });

  it("guarda o motivo da perda e o apaga quando o interesse volta ao funil", async () => {
    const interesse = await criarInteresse();

    const perdido = await mover(interesse.id, {
      etapa: "perdido",
      motivoPerda: "  Comprou em outra loja.  ",
    });
    const reaberto = await mover(interesse.id, { etapa: "em_contato", motivoPerda: "Ignorado" });

    expect(perdido.corpo.interesse).toMatchObject({
      etapa: "perdido",
      motivoPerda: "Comprou em outra loja.",
    });
    expect(reaberto.corpo.interesse).toMatchObject({ etapa: "em_contato", motivoPerda: null });
  });

  it.each([
    ["sem motivo", { etapa: "perdido" }],
    ["com motivo em branco", { etapa: "perdido", motivoPerda: "   " }],
  ])("exige o motivo ao marcar como perdido (%s)", async (_caso, corpo) => {
    const interesse = await criarInteresse();

    const resposta = await mover(interesse.id, corpo);

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({
      erro: {
        codigo: "validacao",
        mensagem: "Dados inválidos.",
        campos: [{ campo: "motivoPerda", mensagem: "Informe o motivo da perda." }],
      },
    });
    expect((await listar(`?carId=${interesse.carro.id}`))[0]?.etapa).toBe("novo");
  });

  it.each([
    ["inexistente", { etapa: "fechado" }],
    ["ausente", {}],
  ])("recusa etapa %s", async (_caso, corpo) => {
    const interesse = await criarInteresse();

    const resposta = await mover(interesse.id, corpo);

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toMatchObject({
      erro: { campos: [{ campo: "etapa", mensagem: "Etapa inválida." }] },
    });
  });

  it("não muda o status do carro quando o interesse chega a vendido", async () => {
    const interesse = await criarInteresse();

    await mover(interesse.id, { etapa: "vendido" });

    expect((await buscarCarro(interesse.carro.id)).status).toBe("disponivel");
  });

  it.each([
    ["que não existe", ID_INEXISTENTE],
    ["com id inválido", "abc"],
  ])("responde 404 para interesse %s", async (_caso, id) => {
    const resposta = await mover(id, { etapa: "em_contato" });

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "nao_encontrado", mensagem: "Interesse não encontrado." },
    });
  });
});

describe("DELETE /api/dashboard/interests/:id", () => {
  it("apaga só o interesse; cliente e carro continuam", async () => {
    const interesse = await criarInteresse();

    const resposta = await api.requisitar("DELETE", `/dashboard/interests/${interesse.id}`, {
      cookie,
    });

    expect(resposta.status).toBe(204);
    expect(await listar(`?carId=${interesse.carro.id}`)).toEqual([]);
    expect((await buscarCarro(interesse.carro.id)).interessados).toBe(0);
    const cliente = await api.requisitar<{ cliente: Cliente }>(
      "GET",
      `/dashboard/customers/${interesse.cliente.id}`,
      { cookie },
    );
    expect(cliente.corpo.cliente.interesses).toBe(0);
  });

  it.each([
    ["que não existe", ID_INEXISTENTE],
    ["com id inválido", "abc"],
  ])("responde 404 para interesse %s", async (_caso, id) => {
    const resposta = await api.requisitar("DELETE", `/dashboard/interests/${id}`, { cookie });

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toMatchObject({ erro: { mensagem: "Interesse não encontrado." } });
  });
});
