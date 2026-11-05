import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calcularDigitoRenavam,
  calcularMargem,
  esquemaCarro,
  esquemaOrdemFotos,
  esquemaStatusCarro,
} from "./carros.ts";

function erros(dados: unknown) {
  const resultado = esquemaCarro.safeParse(dados);
  if (resultado.success) return {};
  return Object.fromEntries(resultado.error.issues.map((i) => [i.path.join("."), i.message]));
}

const basico = { marca: "Fiat", modelo: "Argo" };

afterEach(() => {
  vi.useRealTimers();
});

describe("esquemaCarro", () => {
  it("aceita só marca e modelo e preenche o resto com o padrão", () => {
    expect(esquemaCarro.parse({ marca: " Fiat ", modelo: "Argo " })).toEqual({
      marca: "Fiat",
      modelo: "Argo",
      versao: null,
      anoFabricacao: null,
      anoModelo: null,
      km: null,
      cambio: null,
      combustivel: null,
      carroceria: null,
      cores: [],
      motor: null,
      portas: null,
      opcionais: [],
      descricao: null,
      precoVenda: null,
      destaque: false,
      status: "rascunho",
      precoCompra: null,
      custoPreparacao: null,
      custoDocumentacao: null,
      custoComissao: null,
      precoMinimo: null,
      placa: null,
      chassi: null,
      renavam: null,
      origem: null,
      vendedorNome: null,
      vendedorTelefone: null,
      observacoesInternas: null,
    });
  });

  it("troca campo vazio por null", () => {
    const carro = esquemaCarro.parse({
      ...basico,
      versao: "   ",
      motor: "",
      precoVenda: "",
      placa: "",
      dataEntrada: "",
    });
    expect(carro).toMatchObject({ versao: null, motor: null, precoVenda: null, placa: null });
    expect(carro.dataEntrada).toBeUndefined();
  });

  it("responde em português quando o corpo não é um objeto", () => {
    expect(erros(undefined)).toEqual({ "": "Dados inválidos." });
    expect(erros([])).toEqual({ "": "Dados inválidos." });
  });

  it("exige marca e modelo", () => {
    expect(erros({})).toEqual({ marca: "Informe a marca.", modelo: "Informe o modelo." });
    expect(erros({ marca: "  ", modelo: 3 })).toEqual({
      marca: "Informe a marca.",
      modelo: "Informe o modelo.",
    });
  });

  it("limita o tamanho dos textos", () => {
    expect(erros({ ...basico, versao: "x".repeat(81), descricao: "x".repeat(2001) })).toEqual({
      versao: "Use no máximo 80 caracteres.",
      descricao: "Use no máximo 2000 caracteres.",
    });
  });

  it("aceita só as opções conhecidas de câmbio, combustível, carroceria e status", () => {
    expect(
      erros({ ...basico, cambio: "Manuel", combustivel: "Água", carroceria: "Nave", status: "x" }),
    ).toEqual({
      cambio: "Câmbio inválido.",
      combustivel: "Combustível inválido.",
      carroceria: "Carroceria inválida.",
      status: "Status inválido.",
    });
  });

  it.each(["Moto", "Scooter", "Moto elétrica", "Triciclo", "Patinete", "Infantil"])(
    "aceita a carroceria %s",
    (carroceria) => {
      expect(esquemaCarro.parse({ ...basico, carroceria }).carroceria).toBe(carroceria);
    },
  );

  it.each([
    ["abc-1234", "ABC1234"],
    ["abc 1d23", "ABC1D23"],
  ])("normaliza a placa %s", (placa, esperada) => {
    expect(esquemaCarro.parse({ ...basico, placa }).placa).toBe(esperada);
  });

  it.each(["AB1234", "ABCD123", "ABC12345"])("recusa a placa %s", (placa) => {
    expect(erros({ ...basico, placa })).toEqual({
      placa: "Placa inválida: use ABC1D23 ou ABC-1234.",
    });
  });

  it("normaliza o chassi e recusa I, O e Q", () => {
    expect(esquemaCarro.parse({ ...basico, chassi: "9bw zzz377vt004251" }).chassi).toBe(
      "9BWZZZ377VT004251",
    );
    expect(erros({ ...basico, chassi: "9BWZZZ377VT00425I" })).toEqual({
      chassi: "Chassi inválido: são 17 letras e números, sem I, O e Q.",
    });
  });

  it("aceita Renavam com dígito verificador certo e completa os zeros", () => {
    expect(esquemaCarro.parse({ ...basico, renavam: "639884962" }).renavam).toBe("00639884962");
    expect(esquemaCarro.parse({ ...basico, renavam: "006.398.849-62" }).renavam).toBe(
      "00639884962",
    );
    expect(erros({ ...basico, renavam: "00639884963" })).toEqual({
      renavam: "Renavam inválido: confira os dígitos.",
    });
    expect(erros({ ...basico, renavam: "12345" })).toEqual({
      renavam: "Renavam inválido: confira os dígitos.",
    });
  });

  it("remove adicionais repetidos, ignorando maiúsculas e espaços", () => {
    expect(
      esquemaCarro.parse({
        ...basico,
        opcionais: ["Ar-condicionado", " ar-condicionado ", "Multimídia"],
      }).opcionais,
    ).toEqual(["Ar-condicionado", "Multimídia"]);
  });

  it("recusa adicional vazio, longo demais e mais de 40 adicionais", () => {
    expect(erros({ ...basico, opcionais: ["Teto", " ", "x".repeat(61)] })).toEqual({
      "opcionais.1": "Adicional vazio.",
      "opcionais.2": "Cada adicional pode ter no máximo 60 caracteres.",
    });
    expect(
      erros({ ...basico, opcionais: Array.from({ length: 41 }, (_, i) => `Item ${i}`) }),
    ).toEqual({ opcionais: "Informe no máximo 40 adicionais." });
    expect(erros({ ...basico, opcionais: "Teto" })).toEqual({
      opcionais: "Lista de adicionais inválida.",
    });
  });

  it("guarda as cores sem espaços nas pontas e sem repetir, ignorando maiúsculas", () => {
    expect(
      esquemaCarro.parse({ ...basico, cores: [" Preta ", "Branca", "preta", "Azul"] }).cores,
    ).toEqual(["Preta", "Branca", "Azul"]);
  });

  it("recusa cor vazia, longa demais, mais de 12 cores e cores fora de uma lista", () => {
    expect(erros({ ...basico, cores: ["Prata", " ", "x".repeat(31), 7] })).toEqual({
      "cores.1": "Cor vazia.",
      "cores.2": "Cada cor pode ter no máximo 30 caracteres.",
      "cores.3": "Cor inválida.",
    });
    expect(erros({ ...basico, cores: Array.from({ length: 13 }, (_, i) => `Cor ${i}`) })).toEqual({
      cores: "Informe no máximo 12 cores.",
    });
    expect(erros({ ...basico, cores: "Prata" })).toEqual({ cores: "Lista de cores inválida." });
  });

  it("guarda o nome e o telefone de quem vende o carro, com o telefone só em dígitos", () => {
    expect(
      esquemaCarro.parse({
        ...basico,
        vendedorNome: " Auto Lima Multimarcas ",
        vendedorTelefone: "+55 (62) 99999-0000",
      }),
    ).toMatchObject({ vendedorNome: "Auto Lima Multimarcas", vendedorTelefone: "62999990000" });
    expect(
      esquemaCarro.parse({ ...basico, vendedorNome: " ", vendedorTelefone: "" }),
    ).toMatchObject({ vendedorNome: null, vendedorTelefone: null });
  });

  it("recusa telefone de vendedor inválido e nome longo demais", () => {
    expect(
      erros({ ...basico, vendedorNome: "x".repeat(101), vendedorTelefone: "9999-0000" }),
    ).toEqual({
      vendedorNome: "Use no máximo 100 caracteres.",
      vendedorTelefone: "Telefone inválido: informe DDD e número, como (62) 99999-0000.",
    });
  });

  it("aceita ano de 1900 até o ano que vem", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    expect(erros({ ...basico, anoFabricacao: 2027, anoModelo: 2027 })).toEqual({});
    expect(erros({ ...basico, anoFabricacao: 1899, anoModelo: 2028 })).toEqual({
      anoFabricacao: "Informe um ano a partir de 1900.",
      anoModelo: "Informe um ano até 2027.",
    });
    expect(erros({ ...basico, anoFabricacao: 2020.5 })).toEqual({
      anoFabricacao: "Informe um ano válido.",
    });
  });

  it("exige ano modelo igual ao de fabricação ou o seguinte", () => {
    expect(erros({ ...basico, anoFabricacao: 2020, anoModelo: 2021 })).toEqual({});
    expect(erros({ ...basico, anoFabricacao: 2020, anoModelo: 2022 })).toEqual({
      anoModelo: "O ano modelo deve ser o de fabricação ou o seguinte.",
    });
    expect(erros({ ...basico, anoFabricacao: 2021, anoModelo: 2020 })).toEqual({
      anoModelo: "O ano modelo deve ser o de fabricação ou o seguinte.",
    });
  });

  it("guarda dinheiro em centavos inteiros e não negativos", () => {
    expect(erros({ ...basico, precoVenda: 10.5, precoCompra: -1 })).toEqual({
      precoVenda: "Informe um valor válido.",
      precoCompra: "O valor não pode ser negativo.",
    });
  });

  it("recusa preço mínimo acima do preço anunciado", () => {
    expect(erros({ ...basico, precoVenda: 100_00, precoMinimo: 100_00 })).toEqual({});
    expect(erros({ ...basico, precoVenda: 100_00, precoMinimo: 100_01 })).toEqual({
      precoMinimo: "O preço mínimo não pode passar do preço anunciado.",
    });
  });

  it("recusa data de entrada no futuro pelo fuso de São Paulo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T01:00:00Z"));
    expect(esquemaCarro.parse({ ...basico, dataEntrada: "2026-10-30" }).dataEntrada).toBe(
      "2026-10-30",
    );
    expect(erros({ ...basico, dataEntrada: "2026-10-31" })).toEqual({
      dataEntrada: "A data de entrada não pode estar no futuro.",
    });
    expect(erros({ ...basico, dataEntrada: "2026-02-30" })).toEqual({
      dataEntrada: "Data inválida.",
    });
  });
});

describe("esquemaStatusCarro", () => {
  it("aceita só os status do fluxo", () => {
    expect(esquemaStatusCarro.parse({ status: "vendido" })).toEqual({ status: "vendido" });
    expect(esquemaStatusCarro.safeParse({ status: "publicado" }).success).toBe(false);
    expect(esquemaStatusCarro.safeParse({}).success).toBe(false);
  });
});

describe("esquemaOrdemFotos", () => {
  const a = "6f1c1f2e-3a7b-4c1d-9e8f-0a1b2c3d4e5f";
  const b = "7a2d2e3f-4b8c-4d2e-8f90-1b2c3d4e5f60";

  it("aceita a lista de ids", () => {
    expect(esquemaOrdemFotos.parse({ ordem: [b, a] })).toEqual({ ordem: [b, a] });
  });

  it("recusa id repetido ou que não é uuid", () => {
    expect(esquemaOrdemFotos.safeParse({ ordem: [a, a] }).error?.issues[0]?.message).toBe(
      "A mesma foto aparece duas vezes.",
    );
    expect(esquemaOrdemFotos.safeParse({ ordem: ["1"] }).error?.issues[0]?.message).toBe(
      "Foto inválida.",
    );
  });
});

describe("calcularMargem", () => {
  const custos = { custoPreparacao: 1_000_00, custoDocumentacao: null, custoComissao: 500_00 };

  it("desconta compra e custos do preço de venda", () => {
    expect(calcularMargem({ precoVenda: 60_000_00, precoCompra: 50_000_00, ...custos })).toBe(
      8_500_00,
    );
  });

  it("fica negativa quando o carro dá prejuízo", () => {
    expect(calcularMargem({ precoVenda: 50_000_00, precoCompra: 50_000_00, ...custos })).toBe(
      -1_500_00,
    );
  });

  it("é null sem preço de venda ou de compra", () => {
    expect(calcularMargem({ precoVenda: null, precoCompra: 50_000_00, ...custos })).toBeNull();
    expect(calcularMargem({ precoVenda: 60_000_00, precoCompra: null, ...custos })).toBeNull();
  });
});

describe("calcularDigitoRenavam", () => {
  it("calcula o dígito dos 10 primeiros números", () => {
    expect(calcularDigitoRenavam("0063988496")).toBe(2);
  });
});
