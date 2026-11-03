import { jsPDF, type jsPDFOptions } from "jspdf";
import { afterEach, describe, expect, it, vi } from "vitest";
import { carroPublico, LOJA_PUBLICA } from "../testes/dados.ts";
import { respostaDeErro, simularApi } from "../testes/simularApi.ts";
import {
  gerarCatalogoPdf,
  montarCatalogoPdf,
  nomeDoArquivoPdf,
  textoPdf,
  truncarLinhas,
  type DadosDoCatalogo,
} from "./pdf.ts";

const DADOS: Omit<DadosDoCatalogo, "carros"> = {
  loja: LOJA_PUBLICA,
  geradoEm: new Date("2026-10-30T15:00:00.000Z"),
  origem: "https://loja.com.br",
};
const SEM_IMAGENS = { logo: null, emblema: null, carros: [] };
const WHATSAPP_DA_LOJA = "https://wa.me/5511987654321";

function linksDoPdf(documento: jsPDF) {
  const paginas = [
    ...documento.output().matchAll(/(\d+) 0 obj\n<<\/Type \/Page\n([\s\S]*?)\/Contents/g),
  ];
  const numeroDaPagina = new Map(paginas.map(([, objeto], indice) => [objeto, indice + 1]));
  return paginas.map(([, , conteudo = ""]) => ({
    destinos: [...conteudo.matchAll(/\/Dest \[(\d+) 0 R/g)].map(([, objeto]) =>
      numeroDaPagina.get(objeto),
    ),
    urls: [...conteudo.matchAll(/\/URI \(([^)]*)\)/g)].map(([, url]) => url),
  }));
}

function mensagemNoWhatsApp(slug: string) {
  const mensagem = `Olá! Tenho interesse no Chevrolet Onix 1.0 Turbo LTZ 2020/2021, cor Prata. Ainda está disponível?\nhttps://loja.com.br/catalogo/${slug}`;
  return `${WHATSAPP_DA_LOJA}?text=${encodeURIComponent(mensagem)}`;
}

function pdfQueAnotaImagens(imagens: { pagina: number; imagem: unknown }[]) {
  return function (opcoes: jsPDFOptions) {
    const documento = new jsPDF(opcoes);
    vi.spyOn(documento, "addImage").mockImplementation((imagem: unknown) => {
      imagens.push({ pagina: documento.getCurrentPageInfo().pageNumber, imagem });
      return documento;
    });
    return documento;
  } as unknown as typeof jsPDF;
}

describe("textoPdf", () => {
  it("troca espaços e hífens especiais pelos comuns", () => {
    expect(textoPdf("R$\u00a089.900")).toBe("R$ 89.900");
    expect(textoPdf("10\u202fkm")).toBe("10 km");
    expect(textoPdf("Turbo\u2011Flex")).toBe("Turbo-Flex");
  });

  it("mantém acentos e a pontuação que a fonte do PDF imprime e tira o resto", () => {
    expect(textoPdf("Sa\u0303o Paulo — “único dono” • 🚗")).toBe("São Paulo — “único dono” •");
  });

  it("apara as bordas, tira espaço antes da quebra de linha e aceita vazio", () => {
    expect(textoPdf("  Linha 1   \nLinha 2  ")).toBe("Linha 1\nLinha 2");
    expect(textoPdf(null)).toBe("");
    expect(textoPdf(undefined)).toBe("");
  });
});

describe("truncarLinhas", () => {
  it("mantém as linhas que cabem", () => {
    expect(truncarLinhas(["um", "dois"], 2)).toEqual(["um", "dois"]);
  });

  it("corta no limite e troca a última palavra visível por reticências", () => {
    expect(truncarLinhas(["primeira linha", "segunda linha longa", "terceira"], 2)).toEqual([
      "primeira linha",
      "segunda linha…",
    ]);
  });

  it("não mostra nada quando não sobra espaço", () => {
    expect(truncarLinhas(["um", "dois"], 0)).toEqual([]);
    expect(truncarLinhas(["um", "dois"], -3)).toEqual([]);
  });
});

describe("nomeDoArquivoPdf", () => {
  it("usa o nome da loja sem acentos e a data de São Paulo", () => {
    expect(
      nomeDoArquivoPdf("Automóveis São João & Filhos!", new Date("2026-10-31T02:00:00.000Z")),
    ).toBe("catalogo-automoveis-sao-joao-filhos-2026-10-30.pdf");
  });

  it("usa “loja” quando o nome não tem letra nem número", () => {
    expect(nomeDoArquivoPdf("🚗 ★", new Date("2026-10-30T15:00:00.000Z"))).toBe(
      "catalogo-loja-2026-10-30.pdf",
    );
  });
});

describe("montarCatalogoPdf", () => {
  it("monta capa, grade de 6 carros por página e uma página por carro, todas ligadas", () => {
    const carros = Array.from({ length: 7 }, (_, indice) => carroPublico({ slug: `c${indice}` }));

    const documento = montarCatalogoPdf(jsPDF, { ...DADOS, carros }, SEM_IMAGENS);

    expect(documento.getNumberOfPages()).toBe(10);
    expect(linksDoPdf(documento).map(({ destinos }) => destinos)).toEqual([
      [2],
      [4, 5, 6, 7, 8, 9],
      [10],
      [2],
      [2],
      [2],
      [2],
      [2],
      [2],
      [3],
    ]);
  });

  it("põe o WhatsApp da loja na capa e o botão com a mensagem do carro, exceto no vendido", () => {
    const carros = [
      carroPublico({ slug: "disponivel" }),
      carroPublico({ slug: "vendido", status: "vendido" }),
    ];

    const links = linksDoPdf(montarCatalogoPdf(jsPDF, { ...DADOS, carros }, SEM_IMAGENS));

    expect(links.map(({ urls }) => urls)).toEqual([
      [WHATSAPP_DA_LOJA],
      [],
      [mensagemNoWhatsApp("disponivel")],
      [],
    ]);
  });

  it("não cria link de WhatsApp quando a loja não tem número", () => {
    const documento = montarCatalogoPdf(
      jsPDF,
      { ...DADOS, loja: { ...LOJA_PUBLICA, whatsapp: null }, carros: [carroPublico()] },
      SEM_IMAGENS,
    );

    expect(linksDoPdf(documento).flatMap(({ urls }) => urls)).toEqual([]);
  });

  it("aceita carro só com marca e modelo e descrição enorme sem criar página extra", () => {
    const minimo = carroPublico({
      versao: null,
      anoFabricacao: null,
      anoModelo: null,
      km: null,
      cambio: null,
      combustivel: null,
      carroceria: null,
      cor: null,
      motor: null,
      portas: null,
      opcionais: [],
      descricao: null,
      preco: null,
    });
    const longo = carroPublico({
      opcionais: Array.from({ length: 60 }, (_, indice) => `Opcional ${indice}`),
      descricao: "Revisado e com garantia. ".repeat(300),
    });

    const documento = montarCatalogoPdf(jsPDF, { ...DADOS, carros: [minimo, longo] }, SEM_IMAGENS);

    expect(documento.getNumberOfPages()).toBe(4);
  });

  it("usa a capa na grade e a foto principal com até 4 miniaturas na página do carro", () => {
    const imagens: { pagina: number; imagem: unknown }[] = [];

    montarCatalogoPdf(
      pdfQueAnotaImagens(imagens),
      { ...DADOS, carros: [carroPublico()] },
      {
        logo: "logo",
        emblema: "emblema",
        carros: [
          { capa: "capa", principal: "principal", miniaturas: ["m1", "m2", "m3", "m4", "m5"] },
        ],
      },
    );

    expect(imagens).toEqual([
      { pagina: 1, imagem: "logo" },
      { pagina: 2, imagem: "emblema" },
      { pagina: 2, imagem: "capa" },
      { pagina: 3, imagem: "emblema" },
      { pagina: 3, imagem: "principal" },
      { pagina: 3, imagem: "m1" },
      { pagina: 3, imagem: "m2" },
      { pagina: 3, imagem: "m3" },
      { pagina: 3, imagem: "m4" },
    ]);
  });
});

describe("gerarCatalogoPdf", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("monta o catálogo só com a vitrine pública, com os destaques primeiro", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T02:00:00.000Z"));
    const api = simularApi({
      "GET /api/showroom/cars": {
        carros: [
          carroPublico({ slug: "comum" }),
          carroPublico({
            slug: "destaque",
            destaque: true,
            fotos: [{ id: "f1", url: "/api/showroom/photos/f1" }],
          }),
        ],
      },
      "GET /api/showroom/store": { loja: LOJA_PUBLICA },
    });

    const { documento, nomeDoArquivo } = await gerarCatalogoPdf("https://loja.com.br");

    expect(nomeDoArquivo).toBe("catalogo-globo-motors-2026-10-30.pdf");
    expect(documento.getNumberOfPages()).toBe(4);
    expect(linksDoPdf(documento)[2]?.urls).toEqual([mensagemNoWhatsApp("destaque")]);
    expect(api.chaves().sort()).toEqual(["GET /api/showroom/cars", "GET /api/showroom/store"]);
  });

  it("avisa quando não há carro publicado", async () => {
    simularApi({
      "GET /api/showroom/cars": { carros: [] },
      "GET /api/showroom/store": { loja: LOJA_PUBLICA },
    });

    await expect(gerarCatalogoPdf()).rejects.toThrow(
      "Não há carros publicados no catálogo para exportar.",
    );
  });

  it("repassa a falha da API", async () => {
    simularApi({
      "GET /api/showroom/cars": respostaDeErro(500, "erro_interno", "Erro interno."),
      "GET /api/showroom/store": { loja: LOJA_PUBLICA },
    });

    await expect(gerarCatalogoPdf()).rejects.toMatchObject({ status: 500 });
  });
});
