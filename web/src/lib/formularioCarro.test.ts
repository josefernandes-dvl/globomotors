import { esquemaCarro } from "@globomotors/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { carroPainel } from "../testes/dados.ts";
import { lerDinheiro, lerInteiro, paraDadosCarro, valoresDoCarro } from "./formularioCarro.ts";

describe("lerDinheiro", () => {
  it("lê reais com milhar e centavos no formato brasileiro", () => {
    expect(lerDinheiro("89.900")).toBe(8_990_000);
    expect(lerDinheiro("89900")).toBe(8_990_000);
    expect(lerDinheiro("1.234,56")).toBe(123_456);
    expect(lerDinheiro("R$ 89.900,5")).toBe(8_990_050);
  });

  it("devolve null para campo vazio e NaN para o que não é valor", () => {
    expect(lerDinheiro("  ")).toBeNull();
    expect(lerDinheiro("abc")).toBeNaN();
    expect(lerDinheiro("-100")).toBeNaN();
  });
});

describe("lerInteiro", () => {
  it("lê inteiros com ou sem separador de milhar", () => {
    expect(lerInteiro("42.000")).toBe(42_000);
    expect(lerInteiro(" 2021 ")).toBe(2021);
  });

  it("devolve null para vazio e NaN para decimal ou separador fora do lugar", () => {
    expect(lerInteiro("")).toBeNull();
    expect(lerInteiro("4,5")).toBeNaN();
    expect(lerInteiro("42.00")).toBeNaN();
  });
});

describe("valoresDoCarro", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("começa um carro novo como rascunho, com a entrada de hoje em São Paulo", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T01:30:00.000Z"));

    expect(valoresDoCarro()).toEqual({
      marca: "",
      modelo: "",
      versao: "",
      anoFabricacao: "",
      anoModelo: "",
      km: "",
      cambio: "",
      combustivel: "",
      carroceria: "",
      cor: "",
      motor: "",
      portas: "",
      opcionais: [],
      descricao: "",
      precoVenda: "",
      destaque: false,
      status: "rascunho",
      precoCompra: "",
      custoPreparacao: "",
      custoDocumentacao: "",
      custoComissao: "",
      precoMinimo: "",
      dataEntrada: "2026-10-30",
      placa: "",
      chassi: "",
      renavam: "",
      origem: "",
      vendedorNome: "",
      vendedorTelefone: "",
      observacoesInternas: "",
    });
  });

  it("preenche a edição com números e valores no formato brasileiro", () => {
    expect(valoresDoCarro(carroPainel())).toEqual({
      marca: "Chevrolet",
      modelo: "Onix",
      versao: "1.0 Turbo LTZ",
      anoFabricacao: "2020",
      anoModelo: "2021",
      km: "42.000",
      cambio: "Automático",
      combustivel: "Flex",
      carroceria: "Hatch",
      cor: "Prata",
      motor: "1.0 Turbo",
      portas: "4",
      opcionais: ["Ar-condicionado", "Multimídia"],
      descricao: "Único dono, revisões na concessionária.",
      precoVenda: "89.900",
      destaque: false,
      status: "disponivel",
      precoCompra: "75.000",
      custoPreparacao: "1.200",
      custoDocumentacao: "800",
      custoComissao: "500",
      precoMinimo: "85.000",
      dataEntrada: "2026-10-01",
      placa: "ABC1D23",
      chassi: "9BGKS48U0LG123456",
      renavam: "00123456789",
      origem: "Troca",
      vendedorNome: "Auto Lima Multimarcas",
      vendedorTelefone: "(62) 98888-7777",
      observacoesInternas: "Pneus novos",
    });
  });
});

describe("paraDadosCarro", () => {
  it("devolve à API os mesmos dados que o formulário recebeu", () => {
    expect(paraDadosCarro(valoresDoCarro(carroPainel()))).toEqual({
      marca: "Chevrolet",
      modelo: "Onix",
      versao: "1.0 Turbo LTZ",
      anoFabricacao: 2020,
      anoModelo: 2021,
      km: 42_000,
      cambio: "Automático",
      combustivel: "Flex",
      carroceria: "Hatch",
      cor: "Prata",
      motor: "1.0 Turbo",
      portas: 4,
      opcionais: ["Ar-condicionado", "Multimídia"],
      descricao: "Único dono, revisões na concessionária.",
      precoVenda: 8_990_000,
      destaque: false,
      status: "disponivel",
      precoCompra: 7_500_000,
      custoPreparacao: 120_000,
      custoDocumentacao: 80_000,
      custoComissao: 50_000,
      precoMinimo: 8_500_000,
      dataEntrada: "2026-10-01",
      placa: "ABC1D23",
      chassi: "9BGKS48U0LG123456",
      renavam: "00123456789",
      origem: "Troca",
      vendedorNome: "Auto Lima Multimarcas",
      vendedorTelefone: "(62) 98888-7777",
      observacoesInternas: "Pneus novos",
    });
  });

  it("passa na validação compartilhada com o telefone do vendedor só em dígitos", () => {
    const carro = carroPainel();

    expect(esquemaCarro.parse(paraDadosCarro(valoresDoCarro(carro)))).toMatchObject({
      opcionais: carro.opcionais,
      vendedorNome: "Auto Lima Multimarcas",
      vendedorTelefone: "62988887777",
    });
  });

  it("deixa o carro sem vendedor quando os campos do vendedor ficam vazios", () => {
    const valores = valoresDoCarro(carroPainel({ vendedorNome: null, vendedorTelefone: null }));

    expect(valores).toMatchObject({ vendedorNome: "", vendedorTelefone: "" });
    expect(esquemaCarro.parse(paraDadosCarro(valores))).toMatchObject({
      vendedorNome: null,
      vendedorTelefone: null,
    });
  });

  it("manda null no número vazio e NaN no que não é número, para a validação recusar", () => {
    const dados = paraDadosCarro({
      ...valoresDoCarro(carroPainel()),
      km: "",
      precoVenda: "abc",
      portas: "4,5",
    });

    expect(dados.km).toBeNull();
    expect(dados.precoVenda).toBeNaN();
    expect(dados.portas).toBeNaN();
  });
});
