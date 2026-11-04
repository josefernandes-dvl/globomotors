import { randomUUID } from "node:crypto";
import { dataEmSaoPaulo, hojeEmSaoPaulo, type CarroPainel } from "@globomotors/shared";
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

interface RespostaCarro {
  carro: CarroPainel;
  possiveisInteressados?: number;
}

function criar(corpo: unknown) {
  return api.requisitar<RespostaCarro>("POST", "/dashboard/cars", { corpo, cookie });
}

async function criarCarro(extra: Record<string, unknown> = {}) {
  const resposta = await criar(carroDeTeste(extra));
  expect(resposta.status).toBe(201);
  return resposta.corpo.carro;
}

function buscar(id: string) {
  return api.requisitar<RespostaCarro>("GET", `/dashboard/cars/${id}`, { cookie });
}

function alterarStatus(id: string, status: string) {
  return api.requisitar<RespostaCarro>("PATCH", `/dashboard/cars/${id}/status`, {
    corpo: { status },
    cookie,
  });
}

function diasAtras(dias: number) {
  return dataEmSaoPaulo(new Date(Date.now() - dias * 86_400_000));
}

describe("GET /api/dashboard/cars", () => {
  it("devolve lista vazia quando não há carros", async () => {
    const resposta = await api.requisitar("GET", "/dashboard/cars", { cookie });

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual({ carros: [] });
  });

  it("lista do mais novo para o mais antigo, com os campos privados", async () => {
    const antigo = await criarCarro({ modelo: "Antigo" });
    const novo = await criarCarro({ modelo: "Novo", status: "rascunho" });

    const resposta = await api.requisitar<{ carros: CarroPainel[] }>("GET", "/dashboard/cars", {
      cookie,
    });

    expect(resposta.corpo.carros.map((carro) => carro.id)).toEqual([novo.id, antigo.id]);
    expect(resposta.corpo.carros[0]).toMatchObject({
      status: "rascunho",
      placa: novo.placa,
      precoCompra: 7_650_000,
      vendedorNome: "Auto Lima Multimarcas",
      vendedorTelefone: "11987654321",
      observacoesInternas: "Pneu dianteiro com desgaste.",
    });
  });
});

describe("POST /api/dashboard/cars", () => {
  it("cria rascunho só com marca e modelo, com os valores padrão", async () => {
    const resposta = await criar({ marca: " Fiat ", modelo: "Uno" });

    expect(resposta.status).toBe(201);
    const { carro } = resposta.corpo;
    expect(carro).toMatchObject({
      marca: "Fiat",
      modelo: "Uno",
      versao: null,
      status: "rascunho",
      destaque: false,
      opcionais: [],
      precoVenda: null,
      precoCompra: null,
      margem: null,
      placa: null,
      chassi: null,
      renavam: null,
      vendedorNome: null,
      vendedorTelefone: null,
      dataEntrada: hojeEmSaoPaulo(),
      diasEmEstoque: 0,
      fotos: [],
      interessados: 0,
      vendidoEm: null,
      publicadoEm: null,
    });
    expect(resposta.corpo.possiveisInteressados).toBe(0);
    expect(carro.id).toMatch(UUID);
    expect(carro.slug).toMatch(/^fiat-uno-[0-9a-f]{6}$/);
    expect(new Date(carro.criadoEm).toISOString()).toBe(carro.criadoEm);
  });

  it("normaliza os documentos e o contato do vendedor e calcula margem e dias em estoque", async () => {
    const resposta = await criar(
      carroDeTeste({
        placa: "qwe-1r23",
        chassi: "9bw zzz377 vt004251",
        renavam: "6398849-62",
        vendedorNome: "  Auto Lima Multimarcas ",
        vendedorTelefone: "+55 (11) 98765-4321",
        dataEntrada: diasAtras(29),
      }),
    );

    expect(resposta.status).toBe(201);
    expect(resposta.corpo.carro).toMatchObject({
      placa: "QWE1R23",
      chassi: "9BWZZZ377VT004251",
      renavam: "00639884962",
      margem: 8_990_000 - 7_650_000 - 120_000 - 45_000 - 90_000,
      diasEmEstoque: 29,
      status: "disponivel",
      opcionais: ["Ar-condicionado", "Câmera de ré"],
      origem: "Troca na loja",
      vendedorNome: "Auto Lima Multimarcas",
      vendedorTelefone: "11987654321",
    });
  });

  it("devolve 400 com os erros de cada campo", async () => {
    const resposta = await criar({
      marca: "",
      cambio: "Foguete",
      portas: 9,
      placa: "123",
      chassi: "CURTO",
      renavam: "12345678901",
      vendedorNome: "x".repeat(101),
      vendedorTelefone: "9999-0000",
      precoVenda: 10.5,
      status: "publicado",
    });

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({
      erro: {
        codigo: "validacao",
        mensagem: "Dados inválidos.",
        campos: [
          { campo: "marca", mensagem: "Informe a marca." },
          { campo: "modelo", mensagem: "Informe o modelo." },
          { campo: "cambio", mensagem: "Câmbio inválido." },
          { campo: "portas", mensagem: "Informe de 1 a 6 portas." },
          { campo: "precoVenda", mensagem: "Informe um valor válido." },
          { campo: "status", mensagem: "Status inválido." },
          { campo: "placa", mensagem: "Placa inválida: use ABC1D23 ou ABC-1234." },
          {
            campo: "chassi",
            mensagem: "Chassi inválido: são 17 letras e números, sem I, O e Q.",
          },
          { campo: "renavam", mensagem: "Renavam inválido: confira os dígitos." },
          { campo: "vendedorNome", mensagem: "Use no máximo 100 caracteres." },
          {
            campo: "vendedorTelefone",
            mensagem: "Telefone inválido: informe DDD e número, como (62) 99999-0000.",
          },
        ],
      },
    });
  });

  it("aplica as regras entre campos: ano modelo e preço mínimo", async () => {
    const resposta = await criar(
      carroDeTeste({ anoFabricacao: 2020, anoModelo: 2022, precoVenda: 100, precoMinimo: 200 }),
    );

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toMatchObject({
      erro: {
        campos: [
          {
            campo: "anoModelo",
            mensagem: "O ano modelo deve ser o de fabricação ou o seguinte.",
          },
          { campo: "precoMinimo", mensagem: "O preço mínimo não pode passar do preço anunciado." },
        ],
      },
    });
  });

  it("recusa data de entrada no futuro", async () => {
    const amanha = dataEmSaoPaulo(new Date(Date.now() + 2 * 86_400_000));
    const resposta = await criar(carroDeTeste({ dataEntrada: amanha }));

    expect(resposta.corpo).toMatchObject({
      erro: {
        campos: [{ campo: "dataEntrada", mensagem: "A data de entrada não pode estar no futuro." }],
      },
    });
  });

  it("recusa corpo que não é objeto", async () => {
    const resposta = await criar(["Fiat"]);

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toMatchObject({
      erro: { campos: [{ campo: "", mensagem: "Dados inválidos." }] },
    });
  });

  it.each([
    ["placa", "Já existe um veículo com esta placa."],
    ["chassi", "Já existe um veículo com este chassi."],
    ["renavam", "Já existe um veículo com este Renavam."],
  ] as const)("recusa %s repetido com 409 no campo certo", async (campo, mensagem) => {
    const existente = await criarCarro();
    const resposta = await criar(carroDeTeste({ [campo]: existente[campo] }));

    expect(resposta.status).toBe(409);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "conflito", mensagem, campos: [{ campo, mensagem }] },
    });
  });

  it("reconhece a placa repetida mesmo digitada em outro formato", async () => {
    const existente = await criarCarro();
    const placa = existente.placa ?? "";
    const resposta = await criar(
      carroDeTeste({ placa: `${placa.slice(0, 3)}-${placa.slice(3)}`.toLowerCase() }),
    );

    expect(resposta.status).toBe(409);
  });
});

describe("GET /api/dashboard/cars/:id", () => {
  it("devolve o carro com a contagem de interessados", async () => {
    const carro = await criarCarro();
    const adicionarInteressado = async () => {
      const cliente = await api.requisitar<{ cliente: { id: string } }>(
        "POST",
        "/dashboard/customers",
        { corpo: clienteDeTeste(), cookie },
      );
      await api.requisitar("POST", "/dashboard/interests", {
        corpo: { clienteId: cliente.corpo.cliente.id, carroId: carro.id },
        cookie,
      });
    };
    await adicionarInteressado();
    await adicionarInteressado();

    const resposta = await buscar(carro.id);

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.carro).toMatchObject({ id: carro.id, interessados: 2 });
  });

  it.each([
    ["que não existe", ID_INEXISTENTE],
    ["com id inválido", "abc"],
  ])("responde 404 para carro %s", async (_caso, id) => {
    const resposta = await buscar(id);

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "nao_encontrado", mensagem: "Veículo não encontrado." },
    });
  });
});

describe("PUT /api/dashboard/cars/:id", () => {
  it("substitui o cadastro: campo omitido fica vazio, slug e data de entrada ficam", async () => {
    const original = await criarCarro();
    const resposta = await api.requisitar<RespostaCarro>("PUT", `/dashboard/cars/${original.id}`, {
      corpo: { marca: "Fiat", modelo: "Argo", status: "reservado", precoVenda: 7_000_000 },
      cookie,
    });

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.carro).toMatchObject({
      id: original.id,
      slug: original.slug,
      dataEntrada: original.dataEntrada,
      marca: "Fiat",
      modelo: "Argo",
      versao: null,
      status: "reservado",
      precoVenda: 7_000_000,
      precoCompra: null,
      placa: null,
      opcionais: [],
      vendedorNome: null,
      vendedorTelefone: null,
      observacoesInternas: null,
      margem: null,
    });
    expect(resposta.corpo.carro.atualizadoEm).not.toBe(original.atualizadoEm);
  });

  it("aceita manter a própria placa", async () => {
    const original = await criarCarro();
    const resposta = await api.requisitar("PUT", `/dashboard/cars/${original.id}`, {
      corpo: carroDeTeste({ placa: original.placa, chassi: original.chassi, km: 40_000 }),
      cookie,
    });

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toMatchObject({ carro: { km: 40_000, placa: original.placa } });
  });

  it("recusa a placa de outro carro com 409", async () => {
    const outro = await criarCarro();
    const carro = await criarCarro();
    const resposta = await api.requisitar("PUT", `/dashboard/cars/${carro.id}`, {
      corpo: carroDeTeste({ placa: outro.placa }),
      cookie,
    });

    expect(resposta.status).toBe(409);
    expect(resposta.corpo).toMatchObject({ erro: { campos: [{ campo: "placa" }] } });
  });

  it("valida o corpo antes de salvar", async () => {
    const carro = await criarCarro();
    const resposta = await api.requisitar("PUT", `/dashboard/cars/${carro.id}`, {
      corpo: { marca: "Fiat" },
      cookie,
    });

    expect(resposta.status).toBe(400);
    expect((await buscar(carro.id)).corpo.carro.marca).toBe("Chevrolet");
  });

  it("responde 404 para carro que não existe", async () => {
    const resposta = await api.requisitar("PUT", `/dashboard/cars/${ID_INEXISTENTE}`, {
      corpo: carroDeTeste(),
      cookie,
    });

    expect(resposta.status).toBe(404);
  });
});

describe("PATCH /api/dashboard/cars/:id/status", () => {
  it("publica, vende e volta a vender, guardando a data da venda", async () => {
    const carro = await criarCarro({ status: "rascunho", dataEntrada: diasAtras(10) });

    const disponivel = await alterarStatus(carro.id, "disponivel");
    expect(disponivel.status).toBe(200);
    expect(disponivel.corpo.carro).toMatchObject({ status: "disponivel", vendidoEm: null });

    const vendido = await alterarStatus(carro.id, "vendido");
    expect(vendido.corpo.carro).toMatchObject({ status: "vendido", diasEmEstoque: 10 });
    const { vendidoEm } = vendido.corpo.carro;
    expect(new Date(vendidoEm ?? "").toISOString()).toBe(vendidoEm);

    const vendidoDeNovo = await alterarStatus(carro.id, "vendido");
    expect(vendidoDeNovo.corpo.carro.vendidoEm).toBe(vendidoEm);

    const reservado = await alterarStatus(carro.id, "reservado");
    expect(reservado.corpo.carro).toMatchObject({ status: "reservado", vendidoEm: null });
  });

  it("muda só o status, sem mexer no resto do cadastro", async () => {
    const carro = await criarCarro();
    const resposta = await alterarStatus(carro.id, "reservado");

    expect(resposta.corpo.carro).toEqual({
      ...carro,
      status: "reservado",
      atualizadoEm: resposta.corpo.carro.atualizadoEm,
    });
  });

  it("marca vendido pelo PUT também e mantém a data numa nova edição", async () => {
    const carro = await criarCarro();
    const corpo = carroDeTeste({
      placa: carro.placa,
      chassi: carro.chassi,
      renavam: carro.renavam,
      status: "vendido",
    });

    const vendido = await api.requisitar<RespostaCarro>("PUT", `/dashboard/cars/${carro.id}`, {
      corpo,
      cookie,
    });
    const editado = await api.requisitar<RespostaCarro>("PUT", `/dashboard/cars/${carro.id}`, {
      corpo: { ...corpo, km: 50_000 },
      cookie,
    });

    expect(vendido.corpo.carro.vendidoEm).not.toBeNull();
    expect(editado.corpo.carro.vendidoEm).toBe(vendido.corpo.carro.vendidoEm);
  });

  it("recusa status desconhecido", async () => {
    const carro = await criarCarro();
    const resposta = await alterarStatus(carro.id, "publicado");

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toMatchObject({
      erro: { campos: [{ campo: "status", mensagem: "Status inválido." }] },
    });
  });

  it("responde 404 para carro que não existe", async () => {
    expect((await alterarStatus(ID_INEXISTENTE, "vendido")).status).toBe(404);
  });
});

describe("entrada no catálogo e possíveis interessados", () => {
  async function clienteQueProcura(...desejos: string[]) {
    const resposta = await api.requisitar<{ cliente: { id: string } }>(
      "POST",
      "/dashboard/customers",
      { corpo: clienteDeTeste({ desejos }), cookie },
    );
    expect(resposta.status).toBe(201);
    return resposta.corpo.cliente.id;
  }

  function modeloNovo() {
    return `Modelo${randomUUID().slice(0, 6)}`;
  }

  it("guarda a publicação de quem entra disponível e conta cada cliente compatível uma vez", async () => {
    const modelo = modeloNovo();
    await clienteQueProcura(modelo, `${modelo} automático`);
    await clienteQueProcura(`${modelo} prata`);
    await clienteQueProcura(`${modelo} diesel`);
    const antes = Date.now();

    const resposta = await criar(carroDeTeste({ modelo }));

    expect(resposta.status).toBe(201);
    expect(resposta.corpo.possiveisInteressados).toBe(2);
    const { publicadoEm } = resposta.corpo.carro;
    expect(new Date(publicadoEm ?? "").toISOString()).toBe(publicadoEm);
    expect(new Date(publicadoEm ?? "").getTime()).toBeGreaterThanOrEqual(antes);
  });

  it("conta de novo só quando o veículo volta ao catálogo", async () => {
    const modelo = modeloNovo();
    await clienteQueProcura(modelo);
    const carro = await criarCarro({ modelo, status: "rascunho" });
    expect(carro.publicadoEm).toBeNull();

    const publicado = await alterarStatus(carro.id, "disponivel");
    expect(publicado.corpo.possiveisInteressados).toBe(1);
    const { publicadoEm } = publicado.corpo.carro;
    expect(publicadoEm).not.toBeNull();

    const editado = await api.requisitar<RespostaCarro>("PUT", `/dashboard/cars/${carro.id}`, {
      corpo: carroDeTeste({
        modelo,
        placa: carro.placa,
        chassi: carro.chassi,
        renavam: carro.renavam,
        km: 1_000,
      }),
      cookie,
    });
    expect(editado.corpo).toMatchObject({ carro: { publicadoEm }, possiveisInteressados: 0 });

    const reservado = await alterarStatus(carro.id, "reservado");
    expect(reservado.corpo).toMatchObject({ carro: { publicadoEm }, possiveisInteressados: 0 });

    const deVolta = await alterarStatus(carro.id, "disponivel");
    expect(deVolta.corpo.possiveisInteressados).toBe(1);
    expect(deVolta.corpo.carro.publicadoEm).not.toBe(publicadoEm);
  });

  it("não conta o cliente que já está no funil do veículo", async () => {
    const modelo = modeloNovo();
    const clienteId = await clienteQueProcura(modelo);
    await clienteQueProcura(modelo);
    const carro = await criarCarro({ modelo, status: "reservado" });
    await api.requisitar("POST", "/dashboard/interests", {
      corpo: { clienteId, carroId: carro.id },
      cookie,
    });

    expect((await alterarStatus(carro.id, "disponivel")).corpo.possiveisInteressados).toBe(1);
  });
});

describe("DELETE /api/dashboard/cars/:id", () => {
  it("apaga o carro junto com fotos e interesses", async () => {
    const carro = await criarCarro();
    const foto = await api.requisitar<{ foto: { id: string } }>(
      "POST",
      `/dashboard/cars/${carro.id}/photos`,
      { corpo: fotoDeTeste("jpeg"), tipo: "image/jpeg", cookie },
    );
    const cliente = await api.requisitar<{ cliente: { id: string } }>(
      "POST",
      "/dashboard/customers",
      {
        corpo: clienteDeTeste(),
        cookie,
      },
    );
    await api.requisitar("POST", "/dashboard/interests", {
      corpo: { clienteId: cliente.corpo.cliente.id, carroId: carro.id },
      cookie,
    });

    const resposta = await api.requisitar("DELETE", `/dashboard/cars/${carro.id}`, { cookie });

    expect(resposta.status).toBe(204);
    expect((await buscar(carro.id)).status).toBe(404);
    expect((await api.baixar(`/dashboard/photos/${foto.corpo.foto.id}`, cookie)).status).toBe(404);
    const interesses = await api.requisitar("GET", `/dashboard/interests?carId=${carro.id}`, {
      cookie,
    });
    expect(interesses.corpo).toEqual({ interesses: [] });
    expect(
      (await api.requisitar("GET", `/dashboard/customers/${cliente.corpo.cliente.id}`, { cookie }))
        .status,
    ).toBe(200);
  });

  it("responde 404 ao apagar de novo ou com id inválido", async () => {
    const carro = await criarCarro();
    await api.requisitar("DELETE", `/dashboard/cars/${carro.id}`, { cookie });

    expect((await api.requisitar("DELETE", `/dashboard/cars/${carro.id}`, { cookie })).status).toBe(
      404,
    );
    expect((await api.requisitar("DELETE", "/dashboard/cars/abc", { cookie })).status).toBe(404);
  });
});
