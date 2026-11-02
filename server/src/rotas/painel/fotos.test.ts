import type { CarroPainel, FotoCarro } from "@globomotors/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  carroDeTeste,
  fotoDeTeste,
  prepararApiDeTeste,
  type ApiDeTeste,
} from "../../testes/apiDeTeste.ts";

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

async function criarCarro() {
  const resposta = await api.requisitar<{ carro: CarroPainel }>("POST", "/dashboard/cars", {
    corpo: carroDeTeste(),
    cookie,
  });
  return resposta.corpo.carro.id;
}

function enviarFoto(carroId: string, dados: Buffer, tipo = "image/jpeg") {
  return api.requisitar<{ foto: FotoCarro }>("POST", `/dashboard/cars/${carroId}/photos`, {
    corpo: dados,
    tipo,
    cookie,
  });
}

async function enviarFotos(carroId: string, quantidade: number) {
  const ids: string[] = [];
  for (let i = 0; i < quantidade; i++) {
    ids.push((await enviarFoto(carroId, fotoDeTeste("jpeg"))).corpo.foto.id);
  }
  return ids;
}

async function idsDasFotos(carroId: string) {
  const resposta = await api.requisitar<{ carro: CarroPainel }>(
    "GET",
    `/dashboard/cars/${carroId}`,
    {
      cookie,
    },
  );
  return resposta.corpo.carro.fotos.map((foto) => foto.id);
}

function reordenar(carroId: string, ordem: unknown) {
  return api.requisitar("PATCH", `/dashboard/cars/${carroId}/photos`, { corpo: { ordem }, cookie });
}

describe("POST /api/dashboard/cars/:id/photos", () => {
  it.each([
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ] as const)("recebe foto %s e devolve o id e a URL do painel", async (formato, tipo) => {
    const carroId = await criarCarro();
    const dados = fotoDeTeste(formato);
    const resposta = await enviarFoto(carroId, dados, tipo);

    expect(resposta.status).toBe(201);
    const { id, url } = resposta.corpo.foto;
    expect(url).toBe(`/api/dashboard/photos/${id}`);
    const baixada = await api.baixar(`/dashboard/photos/${id}`, cookie);
    expect(baixada.status).toBe(200);
    expect(baixada.headers.get("content-type")).toBe(tipo);
    expect(baixada.dados.equals(dados)).toBe(true);
  });

  it("guarda o tipo pelo conteúdo do arquivo, não pelo cabeçalho", async () => {
    const carroId = await criarCarro();
    const resposta = await enviarFoto(carroId, fotoDeTeste("png"), "image/jpeg");

    const baixada = await api.baixar(`/dashboard/photos/${resposta.corpo.foto.id}`, cookie);
    expect(baixada.headers.get("content-type")).toBe("image/png");
  });

  it("adiciona cada foto no fim, na ordem de envio", async () => {
    const carroId = await criarCarro();
    const ids = await enviarFotos(carroId, 3);

    expect(await idsDasFotos(carroId)).toEqual(ids);
  });

  it.each([
    ["tipo não aceito", "text/plain", Buffer.from("olá")],
    ["JSON no lugar da imagem", "application/json", Buffer.from('{"foto":1}')],
    ["conteúdo que não é imagem", "image/jpeg", Buffer.from("não sou uma imagem")],
    ["arquivo vazio", "image/png", Buffer.alloc(0)],
  ])("recusa %s com 400", async (_caso, tipo, dados) => {
    const carroId = await criarCarro();
    const resposta = await enviarFoto(carroId, dados, tipo);

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toMatchObject({
      erro: { codigo: "arquivo_invalido", mensagem: "Envie uma imagem JPG, PNG ou WebP." },
    });
    expect(await idsDasFotos(carroId)).toEqual([]);
  });

  it("recusa arquivo acima de 5 MB", async () => {
    const carroId = await criarCarro();
    const grande = Buffer.concat([fotoDeTeste("jpeg"), Buffer.alloc(5 * 1024 * 1024)]);
    const resposta = await enviarFoto(carroId, grande);

    expect(resposta.status).toBe(413);
    expect(await idsDasFotos(carroId)).toEqual([]);
  });

  it.each([
    ["que não existe", ID_INEXISTENTE],
    ["com id inválido", "abc"],
  ])("responde 404 para carro %s", async (_caso, carroId) => {
    const resposta = await enviarFoto(carroId, fotoDeTeste("jpeg"));

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "nao_encontrado", mensagem: "Carro não encontrado." },
    });
  });

  it("aceita até 20 fotos por carro", async () => {
    const carroId = await criarCarro();
    await enviarFotos(carroId, 20);

    const resposta = await enviarFoto(carroId, fotoDeTeste("jpeg"));

    expect(resposta.status).toBe(409);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "conflito", mensagem: "Cada carro pode ter no máximo 20 fotos." },
    });
    expect(await idsDasFotos(carroId)).toHaveLength(20);
  });

  it("não passa do limite com envios simultâneos", async () => {
    const carroId = await criarCarro();
    await enviarFotos(carroId, 18);

    const respostas = await Promise.all(
      [1, 2, 3, 4].map(() => enviarFoto(carroId, fotoDeTeste("jpeg"))),
    );

    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([201, 201, 409, 409]);
    expect(await idsDasFotos(carroId)).toHaveLength(20);
  });
});

describe("GET /api/dashboard/photos/:id", () => {
  it("serve a foto com cache privado", async () => {
    const carroId = await criarCarro();
    const [id] = await enviarFotos(carroId, 1);
    const baixada = await api.baixar(`/dashboard/photos/${id}`, cookie);

    expect(baixada.headers.get("cache-control")).toBe("private, max-age=86400");
  });

  it.each([
    ["que não existe", ID_INEXISTENTE],
    ["com id inválido", "abc"],
  ])("responde 404 para foto %s", async (_caso, id) => {
    const resposta = await api.requisitar("GET", `/dashboard/photos/${id}`, { cookie });

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "nao_encontrado", mensagem: "Foto não encontrada." },
    });
  });
});

describe("PATCH /api/dashboard/cars/:id/photos", () => {
  it("reordena as fotos; a primeira passa a ser a capa", async () => {
    const carroId = await criarCarro();
    const [a, b, c] = await enviarFotos(carroId, 3);

    const resposta = await reordenar(carroId, [c, a, b]);

    expect(resposta.status).toBe(204);
    expect(await idsDasFotos(carroId)).toEqual([c, a, b]);
  });

  it.each([
    ["sem uma das fotos", (ids: string[]) => ids.slice(1)],
    ["com foto de outro carro", (ids: string[], outra: string) => [...ids.slice(1), outra]],
    ["com foto a mais", (ids: string[], outra: string) => [...ids, outra]],
  ])("recusa a ordem %s e mantém a anterior", async (_caso, montar) => {
    const carroId = await criarCarro();
    const ids = await enviarFotos(carroId, 2);
    const [outra = ""] = await enviarFotos(await criarCarro(), 1);

    const resposta = await reordenar(carroId, montar(ids, outra));

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({
      erro: {
        codigo: "validacao",
        mensagem: "Dados inválidos.",
        campos: [{ campo: "ordem", mensagem: "Envie todas as fotos do carro, cada uma uma vez." }],
      },
    });
    expect(await idsDasFotos(carroId)).toEqual(ids);
  });

  it("recusa foto repetida e id inválido", async () => {
    const carroId = await criarCarro();
    const [a = "", b = ""] = await enviarFotos(carroId, 2);

    expect((await reordenar(carroId, [a, a])).corpo).toMatchObject({
      erro: { campos: [{ campo: "ordem", mensagem: "A mesma foto aparece duas vezes." }] },
    });
    expect((await reordenar(carroId, [a, "abc"])).corpo).toMatchObject({
      erro: { campos: [{ campo: "ordem.1", mensagem: "Foto inválida." }] },
    });
    expect(await idsDasFotos(carroId)).toEqual([a, b]);
  });

  it("responde 404 para carro que não existe", async () => {
    expect((await reordenar(ID_INEXISTENTE, [])).status).toBe(404);
  });
});

describe("DELETE /api/dashboard/cars/:id/photos/:fotoId", () => {
  it("apaga a foto e mantém as outras na mesma ordem", async () => {
    const carroId = await criarCarro();
    const [a, b, c] = await enviarFotos(carroId, 3);

    const resposta = await api.requisitar("DELETE", `/dashboard/cars/${carroId}/photos/${b}`, {
      cookie,
    });

    expect(resposta.status).toBe(204);
    expect(await idsDasFotos(carroId)).toEqual([a, c]);
    expect((await api.baixar(`/dashboard/photos/${b}`, cookie)).status).toBe(404);
  });

  it("não apaga foto de outro carro", async () => {
    const carroId = await criarCarro();
    const [fotoDoOutro] = await enviarFotos(await criarCarro(), 1);

    const resposta = await api.requisitar(
      "DELETE",
      `/dashboard/cars/${carroId}/photos/${fotoDoOutro}`,
      { cookie },
    );

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "nao_encontrado", mensagem: "Foto não encontrada." },
    });
    expect((await api.baixar(`/dashboard/photos/${fotoDoOutro}`, cookie)).status).toBe(200);
  });

  it("responde 404 ao apagar de novo ou com ids inválidos", async () => {
    const carroId = await criarCarro();
    const [id] = await enviarFotos(carroId, 1);
    await api.requisitar("DELETE", `/dashboard/cars/${carroId}/photos/${id}`, { cookie });

    const deNovo = await api.requisitar("DELETE", `/dashboard/cars/${carroId}/photos/${id}`, {
      cookie,
    });
    const fotoInvalida = await api.requisitar("DELETE", `/dashboard/cars/${carroId}/photos/abc`, {
      cookie,
    });
    const carroInvalido = await api.requisitar("DELETE", `/dashboard/cars/abc/photos/${id}`, {
      cookie,
    });

    expect([deNovo.status, fotoInvalida.status, carroInvalido.status]).toEqual([404, 404, 404]);
    expect(carroInvalido.corpo).toMatchObject({ erro: { mensagem: "Carro não encontrado." } });
  });
});
