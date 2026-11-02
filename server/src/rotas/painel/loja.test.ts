import { LOJA_PADRAO, type Loja } from "@globomotors/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepararApiDeTeste, type ApiDeTeste } from "../../testes/apiDeTeste.ts";

let api: ApiDeTeste;
let cookie: string;

beforeAll(async () => {
  api = await prepararApiDeTeste();
  cookie = await api.entrar();
});

afterAll(async () => {
  await api.encerrar();
});

interface RespostaLoja {
  loja: Loja;
}

async function obter() {
  const resposta = await api.requisitar<RespostaLoja>("GET", "/dashboard/store", { cookie });
  expect(resposta.status).toBe(200);
  return resposta.corpo.loja;
}

function salvar(corpo: unknown) {
  return api.requisitar<RespostaLoja>("PUT", "/dashboard/store", { corpo, cookie });
}

const LOJA_VALIDA = {
  nome: "Globo Motors",
  cidade: "Goiânia - GO",
  slogan: "Seminovos com procedência.",
  whatsapp: "62999990000",
  instagram: "globomotors",
  mostrarPreco: true,
  mostrarVendidos: false,
};

describe("GET /api/dashboard/store", () => {
  it("devolve a configuração padrão antes da primeira gravação", async () => {
    expect(await obter()).toEqual(LOJA_PADRAO);
  });
});

describe("PUT /api/dashboard/store", () => {
  it("grava a configuração normalizando os campos", async () => {
    const resposta = await salvar({
      nome: "  Globo Motors  ",
      cidade: " Goiânia - GO ",
      slogan: "",
      whatsapp: "+55 (62) 99999-0000",
      instagram: "https://www.instagram.com/globomotors/",
      mostrarPreco: false,
      mostrarVendidos: true,
    });

    const esperada = {
      nome: "Globo Motors",
      cidade: "Goiânia - GO",
      slogan: null,
      whatsapp: "62999990000",
      instagram: "globomotors",
      mostrarPreco: false,
      mostrarVendidos: true,
    };
    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual({ loja: esperada });
    expect(await obter()).toEqual(esperada);
  });

  it("substitui a configuração anterior por inteiro", async () => {
    await salvar(LOJA_VALIDA);

    const resposta = await salvar({
      nome: "Garagem Nova",
      mostrarPreco: true,
      mostrarVendidos: true,
    });

    const esperada = {
      nome: "Garagem Nova",
      cidade: null,
      slogan: null,
      whatsapp: null,
      instagram: null,
      mostrarPreco: true,
      mostrarVendidos: true,
    };
    expect(resposta.corpo.loja).toEqual(esperada);
    expect(await obter()).toEqual(esperada);
  });

  it.each([
    ["@globo.motors", "globo.motors"],
    ["instagram.com/globo_motors", "globo_motors"],
  ])("aceita o Instagram %s", async (instagram, esperado) => {
    const resposta = await salvar({ ...LOJA_VALIDA, instagram });

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.loja.instagram).toBe(esperado);
  });

  it("exige nome e as duas opções da vitrine", async () => {
    const resposta = await salvar({});

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({
      erro: {
        codigo: "validacao",
        mensagem: "Dados inválidos.",
        campos: [
          { campo: "nome", mensagem: "Informe o nome da loja." },
          { campo: "mostrarPreco", mensagem: "Valor inválido." },
          { campo: "mostrarVendidos", mensagem: "Valor inválido." },
        ],
      },
    });
  });

  it("recusa valores inválidos sem alterar a configuração", async () => {
    await salvar(LOJA_VALIDA);

    const resposta = await salvar({
      nome: "a".repeat(61),
      cidade: "a".repeat(61),
      slogan: "a".repeat(141),
      whatsapp: "123",
      instagram: "perfil com espaço",
      mostrarPreco: "sim",
      mostrarVendidos: 1,
    });

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toMatchObject({
      erro: {
        campos: [
          { campo: "nome", mensagem: "Use no máximo 60 caracteres." },
          { campo: "cidade", mensagem: "Use no máximo 60 caracteres." },
          { campo: "slogan", mensagem: "Use no máximo 140 caracteres." },
          {
            campo: "whatsapp",
            mensagem: "Telefone inválido: informe DDD e número, como (62) 99999-0000.",
          },
          { campo: "instagram", mensagem: "Instagram inválido: informe o @ do perfil." },
          { campo: "mostrarPreco", mensagem: "Valor inválido." },
          { campo: "mostrarVendidos", mensagem: "Valor inválido." },
        ],
      },
    });
    expect(await obter()).toEqual(LOJA_VALIDA);
  });
});
