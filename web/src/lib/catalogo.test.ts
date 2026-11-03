import { CAMBIOS, CARROCERIAS } from "@globomotors/shared";
import { describe, expect, it } from "vitest";
import { carroPainel, carroPublico } from "../testes/dados.ts";
import {
  anosUteis,
  combinaComBusca,
  contarFiltros,
  FILTROS_VAZIOS,
  filtrarCarros,
  LIMITES_DE_KM,
  LIMITES_DE_PRECO,
  limitesUteis,
  marcasDe,
  opcoesPresentes,
  ordenarCarros,
} from "./catalogo.ts";

const onix = carroPainel({ id: "onix" });
const hb20 = carroPainel({
  id: "hb20",
  marca: "Hyundai",
  modelo: "HB20",
  versao: "Comfort",
  anoFabricacao: 2019,
  anoModelo: 2019,
  km: 80_000,
  cambio: "Manual",
  cor: "Branco",
  opcionais: ["Câmera de ré"],
  precoVenda: 5_500_000,
});
const compass = carroPainel({
  id: "compass",
  marca: "Jeep",
  modelo: "Compass",
  versao: "Longitude",
  anoFabricacao: 2022,
  anoModelo: 2023,
  km: null,
  carroceria: "SUV",
  precoVenda: null,
});

const ids = (carros: { id: string }[]) => carros.map((carro) => carro.id);

describe("combinaComBusca", () => {
  it("acha por marca, modelo, versão, cor, ano, câmbio e opcionais", () => {
    expect(combinaComBusca(onix, "onix")).toBe(true);
    expect(combinaComBusca(hb20, "branco")).toBe(true);
    expect(combinaComBusca(onix, "2020/2021")).toBe(true);
    expect(combinaComBusca(hb20, "manual")).toBe(true);
    expect(combinaComBusca(compass, "suv")).toBe(true);
  });

  it("ignora acento e maiúsculas", () => {
    expect(combinaComBusca(hb20, "CAMERA DE RE")).toBe(true);
    expect(combinaComBusca(onix, "automatico")).toBe(true);
  });

  it("exige todos os termos", () => {
    expect(combinaComBusca(onix, "chevrolet prata")).toBe(true);
    expect(combinaComBusca(onix, "chevrolet branco")).toBe(false);
  });

  it("aceita tudo com busca vazia", () => {
    expect(combinaComBusca(onix, "   ")).toBe(true);
  });

  it("procura nos campos extras, como a placa no painel", () => {
    expect(combinaComBusca(onix, "abc1d23")).toBe(false);
    expect(combinaComBusca(onix, "abc1d23", onix.placa)).toBe(true);
    expect(combinaComBusca(onix, "abc", null)).toBe(false);
  });
});

describe("marcasDe", () => {
  it("lista as marcas sem repetição, em ordem alfabética", () => {
    expect(marcasDe([compass, onix, hb20, carroPainel({ marca: "Audi" }), onix])).toEqual([
      "Audi",
      "Chevrolet",
      "Hyundai",
      "Jeep",
    ]);
  });
});

describe("ordenarCarros", () => {
  const preco = (carro: { precoVenda: number | null }) => carro.precoVenda;

  it("mantém a ordem recebida em “mais recentes” sem alterar a lista original", () => {
    const lista = [hb20, compass, onix];
    expect(ids(ordenarCarros(lista, "recentes", preco))).toEqual(["hb20", "compass", "onix"]);
    expect(ids(lista)).toEqual(["hb20", "compass", "onix"]);
  });

  it("ordena por preço e deixa sem preço por último nas duas direções", () => {
    expect(ids(ordenarCarros([compass, onix, hb20], "precoAsc", preco))).toEqual([
      "hb20",
      "onix",
      "compass",
    ]);
    expect(ids(ordenarCarros([compass, hb20, onix], "precoDesc", preco))).toEqual([
      "onix",
      "hb20",
      "compass",
    ]);
  });

  it("ordena pelos mais novos e pela menor km, com km ausente no fim", () => {
    expect(ids(ordenarCarros([hb20, onix, compass], "ano", preco))).toEqual([
      "compass",
      "onix",
      "hb20",
    ]);
    expect(ids(ordenarCarros([compass, hb20, onix], "km", preco))).toEqual([
      "onix",
      "hb20",
      "compass",
    ]);
  });

  it("em destaques, põe destaque primeiro e vendido por último, mesmo em destaque", () => {
    const vendido = carroPainel({ id: "vendido", status: "vendido", destaque: true });
    const destaque = carroPainel({ id: "destaque", destaque: true });
    const comum = carroPainel({ id: "comum" });

    expect(ids(ordenarCarros([vendido, comum, destaque], "destaque", preco))).toEqual([
      "destaque",
      "comum",
      "vendido",
    ]);
  });
});

describe("filtrarCarros", () => {
  const onixPublico = carroPublico({ slug: "onix" });
  const hb20Publico = carroPublico({
    slug: "hb20",
    marca: "Hyundai",
    modelo: "HB20",
    anoFabricacao: 2019,
    anoModelo: 2019,
    km: 80_000,
    cambio: "Manual",
    preco: 5_500_000,
  });
  const compassPublico = carroPublico({
    slug: "compass",
    marca: "Jeep",
    modelo: "Compass",
    anoFabricacao: 2022,
    anoModelo: 2023,
    km: null,
    carroceria: "SUV",
    combustivel: "Diesel",
    preco: null,
  });
  const incompleto = carroPublico({
    slug: "incompleto",
    anoFabricacao: null,
    anoModelo: null,
    cambio: null,
    combustivel: null,
    carroceria: null,
  });
  const todos = [onixPublico, hb20Publico, compassPublico, incompleto];
  const slugs = (carros: { slug: string }[]) => carros.map((carro) => carro.slug);
  const filtrar = (filtros: Partial<typeof FILTROS_VAZIOS>) =>
    slugs(filtrarCarros(todos, { ...FILTROS_VAZIOS, ...filtros }));

  it("devolve todos sem filtro", () => {
    expect(filtrar({})).toEqual(["onix", "hb20", "compass", "incompleto"]);
  });

  it("aceita qualquer valor marcado no grupo, exige todos os grupos e deixa de fora quem não tem o dado", () => {
    expect(filtrar({ marca: "Jeep" })).toEqual(["compass"]);
    expect(filtrar({ carrocerias: ["Hatch", "SUV"] })).toEqual(["onix", "hb20", "compass"]);
    expect(filtrar({ cambios: ["Manual"] })).toEqual(["hb20"]);
    expect(filtrar({ combustiveis: ["Flex", "Diesel"] })).toEqual(["onix", "hb20", "compass"]);
    expect(filtrar({ carrocerias: ["SUV"], combustiveis: ["Flex"] })).toEqual([]);
    expect(filtrar({ marca: "Chevrolet", cambios: ["Automático"] })).toEqual(["onix"]);
  });

  it("limita preço e km pelo máximo, incluindo o próprio limite, e sem o dado o carro sai", () => {
    expect(filtrar({ precoMaximo: 8_990_000 })).toEqual(["onix", "hb20", "incompleto"]);
    expect(filtrar({ precoMaximo: 8_989_999 })).toEqual(["hb20"]);
    expect(filtrar({ kmMaximo: 42_000 })).toEqual(["onix", "incompleto"]);
    expect(filtrar({ precoMaximo: 6_000_000, kmMaximo: 50_000 })).toEqual([]);
  });

  it("filtra o ano mínimo pelo ano do modelo, ou o de fabricação quando falta o do modelo", () => {
    expect(filtrar({ anoMinimo: 2021 })).toEqual(["onix", "compass"]);
    expect(filtrar({ anoMinimo: 2023 })).toEqual(["compass"]);
    expect(
      slugs(
        filtrarCarros(
          [carroPublico({ slug: "fabricacao", anoModelo: null, anoFabricacao: 2022 })],
          {
            ...FILTROS_VAZIOS,
            anoMinimo: 2022,
          },
        ),
      ),
    ).toEqual(["fabricacao"]);
  });
});

describe("contarFiltros", () => {
  it("conta cada valor marcado e cada limite escolhido, sem contar a marca", () => {
    expect(contarFiltros(FILTROS_VAZIOS)).toBe(0);
    expect(contarFiltros({ ...FILTROS_VAZIOS, marca: "Jeep" })).toBe(0);
    expect(
      contarFiltros({
        marca: "Jeep",
        carrocerias: ["SUV", "Hatch"],
        cambios: ["Manual"],
        combustiveis: [],
        precoMaximo: 10_000_000,
        anoMinimo: null,
        kmMaximo: 50_000,
      }),
    ).toBe(5);
  });
});

describe("opcoesPresentes", () => {
  it("lista só os valores usados, sem repetir, na ordem da lista oficial", () => {
    expect(opcoesPresentes(CARROCERIAS, ["SUV", null, "Hatch", "SUV"])).toEqual(["Hatch", "SUV"]);
    expect(opcoesPresentes(CAMBIOS, [null])).toEqual([]);
  });
});

describe("limitesUteis", () => {
  it("só oferece o limite que deixa algum carro de fora e algum carro dentro", () => {
    expect(limitesUteis(LIMITES_DE_PRECO, [5_500_000, 8_990_000, null])).toEqual([7_000_000]);
    expect(limitesUteis(LIMITES_DE_KM, [0, 42_000, 80_000, 200_000])).toEqual([
      10_000, 30_000, 50_000, 80_000, 100_000, 150_000,
    ]);
    expect(limitesUteis(LIMITES_DE_KM, [5_000, 8_000])).toEqual([]);
    expect(limitesUteis(LIMITES_DE_PRECO, [null, null])).toEqual([]);
  });
});

describe("anosUteis", () => {
  it("lista os anos do mais novo ao mais antigo, sem o mais antigo, que não filtraria nada", () => {
    expect(
      anosUteis([
        { anoModelo: 2021, anoFabricacao: 2020 },
        { anoModelo: null, anoFabricacao: 2019 },
        { anoModelo: 2023, anoFabricacao: 2022 },
        { anoModelo: null, anoFabricacao: null },
        { anoModelo: 2021, anoFabricacao: 2021 },
      ]),
    ).toEqual([2023, 2021]);
    expect(anosUteis([{ anoModelo: 2021, anoFabricacao: 2020 }])).toEqual([]);
    expect(anosUteis([])).toEqual([]);
  });
});
