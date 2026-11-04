import { TAMANHO_MAXIMO_FOTO, type CarroExtraido } from "@globomotors/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ErroHttp } from "../../erros.ts";
import type { Ia, PedidoIa } from "../../ia.ts";
import { fotoDeTeste, prepararApiDeTeste, type ApiDeTeste } from "../../testes/apiDeTeste.ts";

const CARRO: CarroExtraido = { marca: "Chevrolet", modelo: "Onix", precoVenda: 8_990_000 };

const lerCarro = vi.fn<Ia["lerCarro"]>();

let api: ApiDeTeste;
let semIa: ApiDeTeste;
let cookie: string;

beforeAll(async () => {
  api = await prepararApiDeTeste({ ia: { lerCarro } });
  semIa = await prepararApiDeTeste();
  cookie = await api.entrar();
});

afterAll(async () => {
  await api.encerrar();
  await semIa.encerrar();
});

async function multipart(texto: string | null, imagens: { dados: Buffer; tipo: string }[] = []) {
  const formulario = new FormData();
  if (texto !== null) formulario.set("texto", texto);
  imagens.forEach(({ dados, tipo }, indice) => {
    formulario.append(
      "imagens",
      new Blob([new Uint8Array(dados)], { type: tipo }),
      `${indice}.jpg`,
    );
  });
  const resposta = new Response(formulario);
  return {
    corpo: new Uint8Array(await resposta.arrayBuffer()),
    tipo: resposta.headers.get("content-type") ?? "",
  };
}

function extrair(corpo: { corpo: unknown; tipo?: string }, cookieDaVez = cookie, alvo = api) {
  return alvo.requisitar<{ carro?: CarroExtraido; erro?: { codigo: string; mensagem: string } }>(
    "POST",
    "/dashboard/ai/extract-car",
    { ...corpo, cookie: cookieDaVez },
  );
}

describe("POST /api/dashboard/ai/extract-car", () => {
  it("lê o texto e as imagens e devolve os campos do carro", async () => {
    lerCarro.mockResolvedValue(CARRO);
    const jpeg = fotoDeTeste("jpeg");
    const png = fotoDeTeste("png");

    const resposta = await extrair(
      await multipart("  Onix 2021, 45 mil km  ", [
        { dados: jpeg, tipo: "image/jpeg" },
        { dados: png, tipo: "application/octet-stream" },
      ]),
    );

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual({ carro: CARRO });
    expect(resposta.headers.get("cache-control")).toBe("no-store");
    expect(lerCarro).toHaveBeenCalledOnce();
    const pedido = lerCarro.mock.calls[0]?.[0] as PedidoIa;
    expect(pedido.texto).toBe("Onix 2021, 45 mil km");
    expect(pedido.imagens.map(({ tipo }) => tipo)).toEqual(["image/jpeg", "image/png"]);
    expect(pedido.imagens[0]?.dados.equals(jpeg)).toBe(true);
    expect(pedido.imagens[1]?.dados.equals(png)).toBe(true);
  });

  it("aceita só imagens, sem texto", async () => {
    lerCarro.mockResolvedValue({ marca: "Fiat" });

    const resposta = await extrair(
      await multipart(null, [{ dados: fotoDeTeste("webp"), tipo: "image/webp" }]),
    );

    expect(resposta.status).toBe(200);
    expect(lerCarro.mock.calls[0]?.[0]).toMatchObject({ texto: "" });
  });

  it.each([
    ["sem texto e sem imagem", null, 0, "texto", "Cole um texto ou escolha uma imagem."],
    ["só espaços no texto", "   ", 0, "texto", "Cole um texto ou escolha uma imagem."],
    ["texto longo demais", "a".repeat(6001), 0, "texto", "Use no máximo 6000 caracteres."],
    ["imagens demais", "Onix", 5, "imagens", "Escolha no máximo 4 imagens."],
  ])("recusa %s sem chamar a IA", async (_caso, texto, quantidade, campo, mensagem) => {
    const imagens = Array.from({ length: quantidade }, () => ({
      dados: fotoDeTeste("jpeg"),
      tipo: "image/jpeg",
    }));

    const resposta = await extrair(await multipart(texto, imagens));

    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({
      erro: {
        codigo: "validacao",
        mensagem: "Dados inválidos.",
        campos: [{ campo, mensagem }],
      },
    });
    expect(lerCarro).not.toHaveBeenCalled();
  });

  it("confere a assinatura de cada imagem, não o tipo declarado", async () => {
    const resposta = await extrair(
      await multipart("Onix", [
        { dados: fotoDeTeste("jpeg"), tipo: "image/jpeg" },
        { dados: Buffer.from("%PDF-1.7 documento"), tipo: "image/jpeg" },
      ]),
    );

    expect(resposta.status).toBe(400);
    expect(resposta.corpo.erro).toEqual({
      codigo: "arquivo_invalido",
      mensagem: "Envie imagens JPG, PNG ou WebP.",
    });
    expect(lerCarro).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON", { corpo: { texto: "Onix" } }],
    ["multipart quebrado", { corpo: new Uint8Array([1, 2, 3]), tipo: "multipart/form-data" }],
  ])("recusa corpo %s", async (_caso, corpo) => {
    const resposta = await extrair(corpo);

    expect(resposta.status).toBe(400);
    expect(resposta.corpo.erro).toEqual({
      codigo: "requisicao_invalida",
      mensagem: "Envie o texto ou as imagens do veículo.",
    });
    expect(lerCarro).not.toHaveBeenCalled();
  });

  it("recusa corpo acima do limite da função", async () => {
    const resposta = await extrair(
      await multipart("Onix", [{ dados: Buffer.alloc(TAMANHO_MAXIMO_FOTO), tipo: "image/jpeg" }]),
    );

    expect(resposta.status).toBe(413);
    expect(lerCarro).not.toHaveBeenCalled();
  });

  it("repassa o erro da IA ao vendedor", async () => {
    lerCarro.mockRejectedValue(
      new ErroHttp(429, "ia_indisponivel", "O limite gratuito da IA acabou por agora."),
    );

    const resposta = await extrair(await multipart("Onix"));

    expect(resposta.status).toBe(429);
    expect(resposta.corpo.erro).toEqual({
      codigo: "ia_indisponivel",
      mensagem: "O limite gratuito da IA acabou por agora.",
    });
  });

  it("responde 503 quando o servidor não tem a chave da IA", async () => {
    const resposta = await extrair(await multipart("Onix"), await semIa.entrar(), semIa);

    expect(resposta.status).toBe(503);
    expect(resposta.corpo.erro).toEqual({
      codigo: "ia_indisponivel",
      mensagem: "A leitura com IA ainda não foi configurada no servidor.",
    });
  });
});
