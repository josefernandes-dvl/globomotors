import { randomUUID } from "node:crypto";
import type { CarroPainel, Cliente, ClienteComDesejos, Interesse } from "@globomotors/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  carroDeTeste,
  clienteDeTeste,
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

interface RespostaCliente {
  cliente: Cliente;
}

function criar(corpo: unknown) {
  return api.requisitar<RespostaCliente>("POST", "/dashboard/customers", { corpo, cookie });
}

async function criarCliente(extra: Record<string, unknown> = {}) {
  const resposta = await criar(clienteDeTeste(extra));
  expect(resposta.status).toBe(201);
  return resposta.corpo.cliente;
}

function buscar(id: string) {
  return api.requisitar<RespostaCliente>("GET", `/dashboard/customers/${id}`, { cookie });
}

function atualizar(id: string, corpo: unknown) {
  return api.requisitar<RespostaCliente>("PUT", `/dashboard/customers/${id}`, { corpo, cookie });
}

async function listar(busca?: string) {
  const consulta = busca === undefined ? "" : `?search=${encodeURIComponent(busca)}`;
  const resposta = await api.requisitar<{ clientes: Cliente[] }>(
    "GET",
    `/dashboard/customers${consulta}`,
    { cookie },
  );
  expect(resposta.status).toBe(200);
  return resposta.corpo.clientes.map((cliente) => cliente.id);
}

async function criarInteresse(clienteId: string) {
  const carro = await api.requisitar<{ carro: CarroPainel }>("POST", "/dashboard/cars", {
    corpo: carroDeTeste(),
    cookie,
  });
  const resposta = await api.requisitar<{ interesse: Interesse }>("POST", "/dashboard/interests", {
    corpo: { clienteId, carroId: carro.corpo.carro.id },
    cookie,
  });
  expect(resposta.status).toBe(201);
  return resposta.corpo.interesse;
}

function formatarTelefone(telefone: string) {
  return `+55 (${telefone.slice(0, 2)}) ${telefone.slice(2, 7)}-${telefone.slice(7)}`;
}

describe("GET /api/dashboard/customers", () => {
  it("devolve lista vazia quando não há clientes", async () => {
    const resposta = await api.requisitar("GET", "/dashboard/customers", { cookie });

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual({ clientes: [] });
  });

  it("lista do mais novo para o mais antigo", async () => {
    const antigo = await criarCliente();
    const novo = await criarCliente();

    expect(await listar()).toEqual([novo.id, antigo.id]);
  });

  it("busca por parte do nome, sem diferenciar maiúsculas", async () => {
    const sufixo = randomUUID().slice(0, 6);
    const joana = await criarCliente({ nome: `Joana Prado ${sufixo}` });
    await criarCliente({ nome: `Joaquim Prado ${sufixo}` });

    expect(await listar(`JOANA PRADO ${sufixo}`)).toEqual([joana.id]);
  });

  it("busca por parte do e-mail", async () => {
    const sufixo = randomUUID().slice(0, 6);
    const cliente = await criarCliente({ email: `contato.${sufixo}@empresa.com` });

    expect(await listar(`contato.${sufixo}`)).toEqual([cliente.id]);
  });

  it("busca pelo telefone em qualquer formato, inclusive com +55", async () => {
    const cliente = await criarCliente();

    expect(await listar(formatarTelefone(cliente.telefone))).toEqual([cliente.id]);
    expect(await listar(cliente.telefone.slice(3))).toEqual([cliente.id]);
  });

  it("não compara com o telefone quando a busca tem letras", async () => {
    const cliente = await criarCliente();
    const sufixo = randomUUID().slice(0, 6);

    expect(await listar(`nome${cliente.telefone}${sufixo}`)).toEqual([]);
  });

  it("trata % e _ da busca como texto", async () => {
    const sufixo = randomUUID().slice(0, 6);
    const porcentagem = await criarCliente({ nome: `Promo 100% ${sufixo}` });
    await criarCliente({ nome: `Promo 1000 ${sufixo}` });
    const sublinhado = await criarCliente({ nome: `Loja_Centro ${sufixo}` });
    await criarCliente({ nome: `LojaXCentro ${sufixo}` });

    expect(await listar(`100% ${sufixo}`)).toEqual([porcentagem.id]);
    expect(await listar(`Loja_Centro ${sufixo}`)).toEqual([sublinhado.id]);
  });

  it("devolve todos com a busca em branco", async () => {
    expect(await listar("   ")).toEqual(await listar());
  });

  it("devolve lista vazia quando nada combina", async () => {
    expect(await listar(`ninguem-${randomUUID()}`)).toEqual([]);
  });

  it.each([
    ["com mais de 100 caracteres", `?search=${"a".repeat(101)}`, "Use no máximo 100 caracteres."],
    ["repetida", "?search=ana&search=bia", "Busca inválida."],
  ])("recusa busca %s", async (_caso, consulta, mensagem) => {
    const resposta = await api.requisitar("GET", `/dashboard/customers${consulta}`, { cookie });

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({
      erro: {
        codigo: "validacao",
        mensagem: "Dados inválidos.",
        campos: [{ campo: "search", mensagem }],
      },
    });
  });
});

describe("POST /api/dashboard/customers", () => {
  it("cadastra o cliente normalizando telefone, e-mail e textos", async () => {
    const { telefone } = clienteDeTeste();
    const resposta = await criar({
      nome: "  Maria Souza  ",
      telefone: formatarTelefone(telefone),
      email: "  MARIA.Souza@Teste.com ",
      origem: "indicacao",
      observacoes: "  Quer trocar o carro atual.  ",
    });

    expect(resposta.status).toBe(201);
    const { id, criadoEm, atualizadoEm } = resposta.corpo.cliente;
    expect(resposta.corpo).toEqual({
      cliente: {
        id,
        nome: "Maria Souza",
        telefone,
        email: "maria.souza@teste.com",
        origem: "indicacao",
        observacoes: "Quer trocar o carro atual.",
        desejos: [],
        interesses: 0,
        criadoEm,
        atualizadoEm,
      },
    });
    expect(id).toMatch(UUID);
    expect(new Date(criadoEm).toISOString()).toBe(criadoEm);
    expect((await buscar(id)).corpo).toEqual(resposta.corpo);
  });

  it("aceita só nome e telefone e guarda o resto como vazio", async () => {
    const { telefone } = clienteDeTeste();
    const resposta = await criar({
      nome: "Pedro",
      telefone,
      email: "",
      origem: "",
      observacoes: " ",
    });

    expect(resposta.status).toBe(201);
    expect(resposta.corpo.cliente).toMatchObject({
      nome: "Pedro",
      telefone,
      email: null,
      origem: null,
      observacoes: null,
    });
  });

  it("cadastra os interesses do cliente sem repetidos", async () => {
    const resposta = await criar(
      clienteDeTeste({ desejos: [" Onix automático ", "ONIX automático", "SUV diesel"] }),
    );

    expect(resposta.status).toBe(201);
    expect(resposta.corpo.cliente.desejos).toEqual(["Onix automático", "SUV diesel"]);
    expect((await buscar(resposta.corpo.cliente.id)).corpo).toEqual(resposta.corpo);
  });

  it("recusa interesse vazio sem salvar o cliente", async () => {
    const antes = await listar();
    const resposta = await criar(clienteDeTeste({ desejos: ["Onix", " "] }));

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toMatchObject({
      erro: { campos: [{ campo: "desejos.1", mensagem: "Interesse vazio." }] },
    });
    expect(await listar()).toEqual(antes);
  });

  it("aceita telefone fixo", async () => {
    const resposta = await criar({ nome: "Oficina Central", telefone: "(62) 3222-1111" });

    expect(resposta.status).toBe(201);
    expect(resposta.corpo.cliente.telefone).toBe("6232221111");
  });

  it("exige nome e telefone", async () => {
    const resposta = await criar({});

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({
      erro: {
        codigo: "validacao",
        mensagem: "Dados inválidos.",
        campos: [
          { campo: "nome", mensagem: "Informe o nome." },
          { campo: "telefone", mensagem: "Informe o telefone." },
        ],
      },
    });
  });

  it("recusa valores inválidos campo a campo, sem salvar", async () => {
    const antes = await listar();
    const resposta = await criar({
      nome: "a".repeat(101),
      telefone: "123",
      email: "maria",
      origem: "tiktok",
      observacoes: "a".repeat(2001),
    });

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toMatchObject({
      erro: {
        campos: [
          { campo: "nome", mensagem: "Use no máximo 100 caracteres." },
          {
            campo: "telefone",
            mensagem: "Telefone inválido: informe DDD e número, como (62) 99999-0000.",
          },
          { campo: "email", mensagem: "E-mail inválido." },
          { campo: "origem", mensagem: "Origem inválida." },
          { campo: "observacoes", mensagem: "Use no máximo 2000 caracteres." },
        ],
      },
    });
    expect(await listar()).toEqual(antes);
  });

  it("recusa corpo que não é objeto", async () => {
    const resposta = await criar(["Maria"]);

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toMatchObject({
      erro: { campos: [{ campo: "", mensagem: "Dados inválidos." }] },
    });
  });

  it("recusa telefone já cadastrado, mesmo escrito de outro jeito", async () => {
    const existente = await criarCliente();

    const resposta = await criar(
      clienteDeTeste({ nome: "Outra Pessoa", telefone: formatarTelefone(existente.telefone) }),
    );

    expect(resposta.status).toBe(409);
    expect(resposta.corpo).toEqual({
      erro: {
        codigo: "conflito",
        mensagem: "Já existe um cliente com este telefone.",
        campos: [{ campo: "telefone", mensagem: "Já existe um cliente com este telefone." }],
      },
    });
  });
});

describe("GET /api/dashboard/customers/:id", () => {
  it("conta os interesses do cliente", async () => {
    const cliente = await criarCliente();
    await criarInteresse(cliente.id);
    await criarInteresse(cliente.id);

    const resposta = await buscar(cliente.id);

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.cliente.interesses).toBe(2);
    expect((await listar()).includes(cliente.id)).toBe(true);
  });

  it.each([
    ["que não existe", ID_INEXISTENTE],
    ["com id inválido", "abc"],
  ])("responde 404 para cliente %s", async (_caso, id) => {
    const resposta = await buscar(id);

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "nao_encontrado", mensagem: "Cliente não encontrado." },
    });
  });
});

describe("PUT /api/dashboard/customers/:id", () => {
  it("substitui todos os dados; campo omitido fica vazio", async () => {
    const cliente = await criarCliente();
    const { telefone } = clienteDeTeste();

    const resposta = await atualizar(cliente.id, { nome: "Maria S. Lima", telefone });

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.cliente).toEqual({
      ...cliente,
      nome: "Maria S. Lima",
      telefone,
      email: null,
      origem: null,
      observacoes: null,
      atualizadoEm: resposta.corpo.cliente.atualizadoEm,
    });
    expect(resposta.corpo.cliente.atualizadoEm > cliente.atualizadoEm).toBe(true);
    expect((await buscar(cliente.id)).corpo).toEqual(resposta.corpo);
  });

  it("mantém a contagem de interesses", async () => {
    const cliente = await criarCliente();
    await criarInteresse(cliente.id);

    const resposta = await atualizar(cliente.id, clienteDeTeste({ telefone: cliente.telefone }));

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.cliente.interesses).toBe(1);
  });

  it("troca os interesses pela lista nova e mantém os dados de quem ficou", async () => {
    const cliente = await criarCliente({ desejos: ["Onix", "Corolla"] });
    await api.requisitar("POST", "/dashboard/wishes", {
      corpo: { clienteId: cliente.id, nome: "HB20", anoMinimo: 2020 },
      cookie,
    });

    const resposta = await atualizar(
      cliente.id,
      clienteDeTeste({ telefone: cliente.telefone, desejos: ["Pulse", "hb20", "Corolla"] }),
    );

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.cliente.desejos).toEqual(["Corolla", "HB20", "Pulse"]);
    const lista = await api.requisitar<{ clientes: ClienteComDesejos[] }>(
      "GET",
      "/dashboard/wishes",
      { cookie },
    );
    const grupo = lista.corpo.clientes.find((item) => item.cliente.id === cliente.id);
    expect(grupo?.desejos.map(({ nome, anoMinimo }) => [nome, anoMinimo])).toEqual([
      ["Corolla", null],
      ["HB20", 2020],
      ["Pulse", null],
    ]);
  });

  it("recusa o telefone de outro cliente sem alterar nada", async () => {
    const outro = await criarCliente();
    const cliente = await criarCliente();

    const resposta = await atualizar(cliente.id, clienteDeTeste({ telefone: outro.telefone }));

    expect(resposta.status).toBe(409);
    expect(resposta.corpo).toMatchObject({
      erro: { codigo: "conflito", campos: [{ campo: "telefone" }] },
    });
    expect((await buscar(cliente.id)).corpo.cliente).toEqual(cliente);
  });

  it("recusa dados inválidos sem alterar nada", async () => {
    const cliente = await criarCliente();

    const resposta = await atualizar(cliente.id, { nome: "", telefone: cliente.telefone });

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toMatchObject({
      erro: { campos: [{ campo: "nome", mensagem: "Informe o nome." }] },
    });
    expect((await buscar(cliente.id)).corpo.cliente).toEqual(cliente);
  });

  it.each([
    ["que não existe", ID_INEXISTENTE],
    ["com id inválido", "abc"],
  ])("responde 404 para cliente %s", async (_caso, id) => {
    const resposta = await atualizar(id, clienteDeTeste());

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toMatchObject({ erro: { mensagem: "Cliente não encontrado." } });
  });
});

describe("DELETE /api/dashboard/customers/:id", () => {
  it("apaga o cliente e os interesses dele, mas não o carro", async () => {
    const cliente = await criarCliente({ desejos: ["Onix"] });
    const { carro } = await criarInteresse(cliente.id);

    const resposta = await api.requisitar("DELETE", `/dashboard/customers/${cliente.id}`, {
      cookie,
    });

    expect(resposta.status).toBe(204);
    expect(resposta.texto).toBe("");
    expect((await buscar(cliente.id)).status).toBe(404);
    const interesses = await api.requisitar<{ interesses: Interesse[] }>(
      "GET",
      `/dashboard/interests?carId=${carro.id}`,
      { cookie },
    );
    expect(interesses.corpo.interesses).toEqual([]);
    const restante = await api.requisitar<{ carro: CarroPainel }>(
      "GET",
      `/dashboard/cars/${carro.id}`,
      { cookie },
    );
    expect(restante.corpo.carro.interessados).toBe(0);
    const desejos = await api.requisitar<{ clientes: ClienteComDesejos[] }>(
      "GET",
      "/dashboard/wishes",
      { cookie },
    );
    expect(desejos.corpo.clientes.map((item) => item.cliente.id)).not.toContain(cliente.id);
  });

  it.each([
    ["que não existe", ID_INEXISTENTE],
    ["com id inválido", "abc"],
  ])("responde 404 para cliente %s", async (_caso, id) => {
    const resposta = await api.requisitar("DELETE", `/dashboard/customers/${id}`, { cookie });

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toMatchObject({ erro: { mensagem: "Cliente não encontrado." } });
  });
});
