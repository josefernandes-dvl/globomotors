import { CODIGOS_ERRO } from "@globomotors/shared";
import { describe, expect, it, vi } from "vitest";
import { ErroHttp } from "./erros.ts";
import { criarIa, lerCarroExtraido, type Ia } from "./ia.ts";

const CONFIG = {
  AI_API_KEY: "chave-secreta",
  AI_MODEL: "modelo-de-teste",
  AI_BASE_URL: "https://ia.exemplo.com/v1/",
};

function respostaDaIa(conteudo: unknown) {
  return Response.json({ choices: [{ message: { content: conteudo } }] });
}

function simularIa(resposta: Response | Error) {
  const fetchFalso = vi.fn<typeof fetch>();
  if (resposta instanceof Error) fetchFalso.mockRejectedValue(resposta);
  else fetchFalso.mockResolvedValue(resposta);
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

function iaDeTeste(): Ia {
  const ia = criarIa(CONFIG);
  if (!ia) throw new Error("A IA deveria existir com a chave.");
  return ia;
}

async function erroDe(promessa: Promise<unknown>) {
  try {
    await promessa;
  } catch (erro) {
    return erro;
  }
  throw new Error("A promessa deveria falhar.");
}

describe("criarIa", () => {
  it("não cria a IA sem chave", () => {
    expect(criarIa({ ...CONFIG, AI_API_KEY: undefined })).toBeNull();
  });

  it("manda o texto e as imagens ao endpoint compatível com a OpenAI, com a chave só no header", async () => {
    const fetchFalso = simularIa(respostaDaIa(JSON.stringify({ marca: "Chevrolet" })));
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x01]);

    await iaDeTeste().lerCarro({
      texto: "Onix 2021",
      imagens: [{ tipo: "image/jpeg", dados: jpeg }],
    });

    expect(fetchFalso).toHaveBeenCalledOnce();
    const chamada = fetchFalso.mock.calls[0];
    const opcoes = chamada?.[1];
    expect(chamada?.[0]).toBe("https://ia.exemplo.com/v1/chat/completions");
    expect(opcoes?.method).toBe("POST");
    expect(opcoes?.headers).toEqual({
      authorization: "Bearer chave-secreta",
      "content-type": "application/json",
    });
    expect(opcoes?.signal).toBeInstanceOf(AbortSignal);
    const corpo = JSON.parse(opcoes?.body as string) as {
      model: string;
      messages: { role: string; content: string | object[] }[];
      response_format: {
        type: string;
        json_schema: { name: string; schema: { properties: Record<string, unknown> } };
      };
    };
    expect(corpo.model).toBe("modelo-de-teste");
    expect(corpo.messages[0]?.role).toBe("system");
    expect(corpo.messages[0]?.content).toContain("nunca invente");
    expect(corpo.messages[1]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "Onix 2021" },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
        },
      ],
    });
    expect(corpo.response_format.type).toBe("json_schema");
    expect(corpo.response_format.json_schema.name).toBe("carro");
    expect(Object.keys(corpo.response_format.json_schema.schema.properties)).toContain(
      "precoVenda",
    );
    expect(opcoes?.body).not.toContain("chave-secreta");
  });

  it("avisa a IA quando não há texto, só imagens", async () => {
    const fetchFalso = simularIa(respostaDaIa("{}"));

    await iaDeTeste().lerCarro({
      texto: "",
      imagens: [{ tipo: "image/png", dados: Buffer.from([0x89, 0x50]) }],
    });

    const corpo = JSON.parse(fetchFalso.mock.calls[0]?.[1]?.body as string) as {
      messages: { content: { type: string; text?: string }[] }[];
    };
    expect(corpo.messages[1]?.content[0]).toEqual({
      type: "text",
      text: "Não há texto: leia só as imagens.",
    });
  });

  it("devolve só os campos válidos, com o dinheiro em centavos", async () => {
    simularIa(
      respostaDaIa(
        JSON.stringify({
          marca: " Chevrolet ",
          modelo: "Onix",
          versao: "",
          anoFabricacao: 2020,
          anoModelo: 2021,
          km: 45000,
          cambio: "Automático",
          combustivel: "Flex",
          cor: null,
          opcionais: ["Ar-condicionado", "ar-condicionado", "Câmera de ré"],
          precoVenda: 89900,
          precoCompra: 71000.5,
          placa: "abc-1d23",
          vendedorTelefone: "(62) 99999-0000",
          campoQueNaoExiste: "ignorado",
        }),
      ),
    );

    const carro = await iaDeTeste().lerCarro({ texto: "Onix", imagens: [] });

    expect(carro).toEqual({
      marca: "Chevrolet",
      modelo: "Onix",
      anoFabricacao: 2020,
      anoModelo: 2021,
      km: 45000,
      cambio: "Automático",
      combustivel: "Flex",
      opcionais: ["Ar-condicionado", "Câmera de ré"],
      precoVenda: 8_990_000,
      precoCompra: 7_100_050,
      placa: "ABC1D23",
      vendedorTelefone: "62999990000",
    });
  });

  it("aceita o JSON dentro de um bloco de código", async () => {
    simularIa(respostaDaIa('```json\n{ "marca": "Fiat", "portas": 4 }\n```'));

    await expect(iaDeTeste().lerCarro({ texto: "Argo", imagens: [] })).resolves.toEqual({
      marca: "Fiat",
      portas: 4,
    });
  });

  it("trata o limite do plano gratuito como 429", async () => {
    simularIa(new Response("{}", { status: 429 }));

    const erro = await erroDe(iaDeTeste().lerCarro({ texto: "Onix", imagens: [] }));

    expect(erro).toBeInstanceOf(ErroHttp);
    expect(erro).toMatchObject({
      status: 429,
      codigo: CODIGOS_ERRO.IA_INDISPONIVEL,
      message: "O limite gratuito da IA acabou por agora. Tente de novo mais tarde.",
    });
  });

  it.each([
    ["erro do provedor", new Response("{}", { status: 500 })],
    ["chave recusada", new Response("{}", { status: 401 })],
    ["resposta sem conteúdo", Response.json({ choices: [] })],
    ["JSON inválido", respostaDaIa("não é JSON")],
    ["falha de rede", new TypeError("fetch failed")],
  ])("responde 502 com a causa guardada em %s", async (_caso, resposta) => {
    simularIa(resposta);

    const erro = await erroDe(iaDeTeste().lerCarro({ texto: "Onix", imagens: [] }));

    expect(erro).toBeInstanceOf(ErroHttp);
    expect(erro).toMatchObject({
      status: 502,
      codigo: CODIGOS_ERRO.IA_INDISPONIVEL,
      message: "A IA não respondeu agora. Tente de novo em instantes.",
    });
    expect((erro as ErroHttp).cause).toBeInstanceOf(Error);
  });
});

describe("lerCarroExtraido", () => {
  it("devolve objeto vazio quando a resposta não é um objeto", () => {
    expect(lerCarroExtraido(null)).toEqual({});
    expect(lerCarroExtraido("Onix")).toEqual({});
    expect(lerCarroExtraido(42)).toEqual({});
  });

  it("descarta valor inválido, vazio ou inventado sem perder os outros campos", () => {
    expect(
      lerCarroExtraido({
        marca: "",
        modelo: "HB20S",
        anoFabricacao: 1800,
        km: -10,
        cambio: "Semiautomático",
        portas: 9,
        opcionais: [],
        descricao: "   ",
        precoVenda: "R$ 89.900",
        precoMinimo: -1,
        dataEntrada: "2999-01-01",
        chassi: "123",
        renavam: "12345678901",
        vendedorTelefone: "123",
        origem: "Troca",
      }),
    ).toEqual({ modelo: "HB20S", origem: "Troca" });
  });
});
