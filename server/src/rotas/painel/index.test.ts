import type { CarroPainel } from "@globomotors/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  carroDeTeste,
  fotoDeTeste,
  prepararApiDeTeste,
  type ApiDeTeste,
} from "../../testes/apiDeTeste.ts";

const ID = "3f0c8a4e-7b1d-4c2e-9a6f-5d8b2e1c0a9f";

const ROTAS_DO_PAINEL = [
  ["GET", "/dashboard/cars"],
  ["POST", "/dashboard/cars"],
  ["GET", `/dashboard/cars/${ID}`],
  ["PUT", `/dashboard/cars/${ID}`],
  ["PATCH", `/dashboard/cars/${ID}/status`],
  ["DELETE", `/dashboard/cars/${ID}`],
  ["POST", `/dashboard/cars/${ID}/photos`],
  ["PATCH", `/dashboard/cars/${ID}/photos`],
  ["DELETE", `/dashboard/cars/${ID}/photos/${ID}`],
  ["GET", `/dashboard/photos/${ID}`],
  ["GET", "/dashboard/customers"],
  ["POST", "/dashboard/customers"],
  ["GET", `/dashboard/customers/${ID}`],
  ["PUT", `/dashboard/customers/${ID}`],
  ["DELETE", `/dashboard/customers/${ID}`],
  ["GET", "/dashboard/interests"],
  ["POST", "/dashboard/interests"],
  ["PATCH", `/dashboard/interests/${ID}`],
  ["DELETE", `/dashboard/interests/${ID}`],
  ["GET", "/dashboard/wishes"],
  ["POST", "/dashboard/wishes"],
  ["DELETE", `/dashboard/wishes/${ID}`],
  ["POST", `/dashboard/wishes/${ID}/attend`],
  ["GET", "/dashboard/store"],
  ["PUT", "/dashboard/store"],
  ["POST", "/dashboard/ai/extract-car"],
  ["GET", "/dashboard/rota-que-nao-existe"],
] as const;

const NAO_AUTENTICADO = {
  erro: { codigo: "nao_autenticado", mensagem: "Faça login para continuar." },
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

function corpoPara(metodo: string, caminho: string) {
  if (metodo === "GET" || metodo === "DELETE") return {};
  if (caminho.endsWith("/photos") && metodo === "POST") {
    return { corpo: fotoDeTeste("jpeg"), tipo: "image/jpeg" };
  }
  return { corpo: {} };
}

describe("proteção do painel", () => {
  it.each(ROTAS_DO_PAINEL)("%s %s exige login", async (metodo, caminho) => {
    const resposta = await api.requisitar(metodo, caminho, corpoPara(metodo, caminho));

    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual(NAO_AUTENTICADO);
  });

  it.each(ROTAS_DO_PAINEL)("%s %s recusa sessão inexistente", async (metodo, caminho) => {
    const resposta = await api.requisitar(metodo, caminho, {
      ...corpoPara(metodo, caminho),
      cookie: "globomotors_sessao=token-que-nao-existe",
    });

    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual(NAO_AUTENTICADO);
  });

  it("não aceita identificar o vendedor por header, query ou corpo", async () => {
    const vendedor = await api.criarVendedor();

    const resposta = await fetch(`${api.url}/api/dashboard/cars?usuarioId=${vendedor.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${vendedor.id}`,
        "x-usuario-id": vendedor.id,
      },
      body: JSON.stringify({ ...carroDeTeste(), usuarioId: vendedor.id }),
    });

    expect(resposta.status).toBe(401);
    expect(await resposta.json()).toEqual(NAO_AUTENTICADO);
  });

  it("não altera nada sem sessão", async () => {
    const criado = await api.requisitar<{ carro: CarroPainel }>("POST", "/dashboard/cars", {
      corpo: carroDeTeste(),
      cookie,
    });
    const { id } = criado.corpo.carro;

    const apagar = await api.requisitar("DELETE", `/dashboard/cars/${id}`);
    const editar = await api.requisitar("PUT", `/dashboard/cars/${id}`, {
      corpo: carroDeTeste({ modelo: "Alterado" }),
    });

    expect([apagar.status, editar.status]).toEqual([401, 401]);
    const atual = await api.requisitar<{ carro: CarroPainel }>("GET", `/dashboard/cars/${id}`, {
      cookie,
    });
    expect(atual.corpo.carro).toEqual(criado.corpo.carro);
  });

  it("perde o acesso depois de sair", async () => {
    const sessao = await api.entrar();
    await api.requisitar("POST", "/auth/logout", { cookie: sessao });

    const resposta = await api.requisitar("GET", "/dashboard/cars", { cookie: sessao });

    expect(resposta.status).toBe(401);
  });

  it("responde sem cache, com ou sem sessão", async () => {
    const comSessao = await api.requisitar("GET", "/dashboard/cars", { cookie });
    const semSessao = await api.requisitar("GET", "/dashboard/cars");

    expect(comSessao.status).toBe(200);
    expect(comSessao.headers.get("cache-control")).toBe("no-store");
    expect(semSessao.headers.get("cache-control")).toBe("no-store");
  });

  it("com sessão, rota desconhecida do painel responde 404", async () => {
    const resposta = await api.requisitar("GET", "/dashboard/rota-que-nao-existe", { cookie });

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "nao_encontrado", mensagem: "Rota não encontrada." },
    });
  });
});
