import { describe, expect, it } from "vitest";
import { carroPainel } from "../testes/dados.ts";
import {
  avisoDeInteressados,
  fichaTecnica,
  formatarAnos,
  formatarData,
  formatarDinheiro,
  formatarKm,
  formatarPreco,
  formatarReais,
  formatarTelefone,
  nomeDoVeiculo,
  plural,
  resumoDoCarro,
  tituloDoCarro,
} from "./formatacao.ts";

describe("formatarDinheiro", () => {
  it("omite os centavos quando são zero", () => {
    expect(formatarDinheiro(8_990_000)).toBe("R$\u00a089.900");
  });

  it("mostra os centavos quando existem", () => {
    expect(formatarDinheiro(8_990_050)).toBe("R$\u00a089.900,50");
  });

  it("formata valores negativos, como margem de prejuízo", () => {
    expect(formatarDinheiro(-150_000)).toBe("-R$\u00a01.500");
  });
});

describe("formatarPreco", () => {
  it("mostra “Consulte” quando não há preço", () => {
    expect(formatarPreco(null)).toBe("Consulte");
  });

  it("formata o preço em reais", () => {
    expect(formatarPreco(4_500_000)).toBe("R$\u00a045.000");
  });
});

describe("formatarReais", () => {
  it("devolve vazio para valor ausente e número sem símbolo para o formulário", () => {
    expect(formatarReais(null)).toBe("");
    expect(formatarReais(8_990_000)).toBe("89.900");
    expect(formatarReais(12_345)).toBe("123,45");
  });
});

describe("formatarKm", () => {
  it("formata a quilometragem, inclusive zero km", () => {
    expect(formatarKm(42_000)).toBe("42.000 km");
    expect(formatarKm(0)).toBe("0 km");
    expect(formatarKm(null)).toBeNull();
  });
});

describe("formatarAnos", () => {
  it("junta fabricação e modelo quando são diferentes", () => {
    expect(formatarAnos({ anoFabricacao: 2020, anoModelo: 2021 })).toBe("2020/2021");
  });

  it("mostra um ano só quando são iguais ou falta um deles", () => {
    expect(formatarAnos({ anoFabricacao: 2021, anoModelo: 2021 })).toBe("2021");
    expect(formatarAnos({ anoFabricacao: null, anoModelo: 2022 })).toBe("2022");
    expect(formatarAnos({ anoFabricacao: 2019, anoModelo: null })).toBe("2019");
    expect(formatarAnos({ anoFabricacao: null, anoModelo: null })).toBeNull();
  });
});

describe("título, resumo e ficha técnica", () => {
  it("monta o título com marca e modelo", () => {
    expect(tituloDoCarro({ marca: "Fiat", modelo: "Pulse" })).toBe("Fiat Pulse");
  });

  it("nomeia o veículo com marca, modelo, versão e anos, pulando o que falta", () => {
    expect(nomeDoVeiculo(carroPainel())).toBe("Chevrolet Onix 1.0 Turbo LTZ 2020/2021");
    expect(
      nomeDoVeiculo({
        marca: "Honda",
        modelo: "CG 160",
        versao: null,
        anoFabricacao: 2022,
        anoModelo: 2022,
      }),
    ).toBe("Honda CG 160 2022");
    expect(
      nomeDoVeiculo({
        marca: "Fiat",
        modelo: "Pulse",
        versao: "",
        anoFabricacao: null,
        anoModelo: null,
      }),
    ).toBe("Fiat Pulse");
  });

  it("avisa quantos clientes têm possível interesse no veículo", () => {
    expect(avisoDeInteressados(1, { marca: "Honda", modelo: "CG 160" })).toBe(
      "1 cliente tem possível interesse no veículo Honda CG 160. Veja em Interesses.",
    );
    expect(avisoDeInteressados(3, carroPainel())).toBe(
      "3 clientes têm possível interesse no veículo Chevrolet Onix. Veja em Interesses.",
    );
  });

  it("resume km e câmbio, sem os anos, e pula o que falta", () => {
    expect(resumoDoCarro(carroPainel())).toBe("42.000 km · Automático");
    expect(resumoDoCarro({ km: 0, cambio: null })).toBe("0 km");
    expect(resumoDoCarro({ km: null, cambio: "Manual" })).toBe("Manual");
    expect(resumoDoCarro({ km: null, cambio: null })).toBe("");
  });

  it("lista na ficha técnica só os campos preenchidos, na ordem da vitrine", () => {
    expect(
      fichaTecnica(carroPainel({ cores: [], motor: null, carroceria: null, portas: 2 })),
    ).toEqual([
      { rotulo: "Ano", valor: "2020/2021" },
      { rotulo: "Quilometragem", valor: "42.000 km" },
      { rotulo: "Câmbio", valor: "Automático" },
      { rotulo: "Combustível", valor: "Flex" },
      { rotulo: "Portas", valor: "2" },
    ]);
  });

  it("mostra a cor na ficha técnica só quando o veículo tem uma cor", () => {
    const rotulos = (cores: string[]) =>
      fichaTecnica(carroPainel({ cores })).map(({ rotulo, valor }) => `${rotulo}: ${valor}`);

    expect(rotulos(["Prata"])).toContain("Cor: Prata");
    expect(rotulos(["Prata", "Preta"]).join()).not.toContain("Cor");
  });
});

describe("formatarData", () => {
  it("formata data sem hora sem mudar o dia", () => {
    expect(formatarData("2026-10-30")).toBe("30/10/2026");
  });

  it("exibe data e hora no fuso de São Paulo", () => {
    expect(formatarData("2026-10-30T02:00:00.000Z")).toBe("29/10/2026");
    expect(formatarData(new Date("2026-10-30T15:00:00.000Z"))).toBe("30/10/2026");
  });
});

describe("formatarTelefone", () => {
  it("formata celular e fixo com DDD", () => {
    expect(formatarTelefone("11987654321")).toBe("(11) 98765-4321");
    expect(formatarTelefone("1133334444")).toBe("(11) 3333-4444");
  });

  it("devolve como veio o que não é telefone brasileiro com DDD", () => {
    expect(formatarTelefone("5511987654321")).toBe("5511987654321");
    expect(formatarTelefone("123")).toBe("123");
  });
});

describe("plural", () => {
  it("usa o singular só para 1 e formata o número", () => {
    expect(plural(1, "dia", "dias")).toBe("1 dia");
    expect(plural(0, "dia", "dias")).toBe("0 dias");
    expect(plural(1500, "carro", "carros")).toBe("1.500 carros");
  });
});
