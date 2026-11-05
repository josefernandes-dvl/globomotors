import { afterEach, describe, expect, it, vi } from "vitest";
import {
  esquemaCarroDoDesejo,
  esquemaDesejo,
  normalizarTexto,
  veiculoCombinaComDesejo,
  type CriterioDeDesejo,
  type VeiculoParaDesejo,
} from "./desejos.ts";

const CLIENTE_ID = "6f1c9a52-2a6e-4b8e-9b55-0d6a4f1f2c3d";

function erros(dados: unknown) {
  const resultado = esquemaDesejo.safeParse(dados);
  if (resultado.success) return {};
  return Object.fromEntries(resultado.error.issues.map((i) => [i.path.join("."), i.message]));
}

const onix: VeiculoParaDesejo = {
  marca: "Chevrolet",
  modelo: "Onix",
  versao: "1.0 Turbo LTZ",
  anoFabricacao: 2022,
  anoModelo: 2023,
  cores: ["Branco"],
  cambio: "Automático",
  combustivel: "Flex",
  carroceria: "Hatch",
  motor: "1.0 Turbo",
  opcionais: ["Teto solar", "Câmera de ré"],
  precoVenda: 8_990_000,
};

function desejo(campos: Partial<CriterioDeDesejo> = {}): CriterioDeDesejo {
  return { nome: "Onix", anoMinimo: null, precoMaximo: null, ...campos };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("esquemaDesejo", () => {
  it("aceita cliente e veículo procurado e preenche o resto com null", () => {
    expect(esquemaDesejo.parse({ clienteId: CLIENTE_ID, nome: " SUV diesel " })).toEqual({
      clienteId: CLIENTE_ID,
      nome: "SUV diesel",
      anoMinimo: null,
      precoMaximo: null,
      observacoes: null,
    });
  });

  it("guarda ano mínimo, preço máximo em centavos e observações", () => {
    expect(
      esquemaDesejo.parse({
        clienteId: CLIENTE_ID,
        nome: "Corolla",
        anoMinimo: 2020,
        precoMaximo: 12_000_000,
        observacoes: " Prefere prata ",
      }),
    ).toMatchObject({ anoMinimo: 2020, precoMaximo: 12_000_000, observacoes: "Prefere prata" });
  });

  it("exige cliente e veículo procurado", () => {
    expect(erros({ clienteId: "1", nome: " " })).toEqual({
      clienteId: "Escolha um cliente.",
      nome: "Informe o veículo procurado.",
    });
    expect(erros({ clienteId: CLIENTE_ID, nome: "x".repeat(81) })).toEqual({
      nome: "Use no máximo 80 caracteres.",
    });
  });

  it("recusa ano fora do intervalo, preço negativo e observações longas", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00-03:00"));
    expect(
      erros({
        clienteId: CLIENTE_ID,
        nome: "Onix",
        anoMinimo: 2028,
        precoMaximo: -1,
        observacoes: "x".repeat(501),
      }),
    ).toEqual({
      anoMinimo: "Informe um ano até 2027.",
      precoMaximo: "O valor não pode ser negativo.",
      observacoes: "Use no máximo 500 caracteres.",
    });
  });
});

describe("esquemaCarroDoDesejo", () => {
  it("exige o id do veículo", () => {
    expect(esquemaCarroDoDesejo.safeParse({ carroId: "" }).error?.issues[0]?.message).toBe(
      "Escolha um veículo.",
    );
    expect(esquemaCarroDoDesejo.parse({ carroId: CLIENTE_ID })).toEqual({ carroId: CLIENTE_ID });
  });
});

describe("normalizarTexto", () => {
  it("tira acentos e passa para minúsculas", () => {
    expect(normalizarTexto("Câmbio AUTOMÁTICO Sedã")).toBe("cambio automatico seda");
  });
});

describe("veiculoCombinaComDesejo", () => {
  it.each([
    "Onix",
    "chevrolet onix",
    "ONIX automatico",
    "hatch flex branco",
    "Onix 2023",
    "Onix com teto solar",
    "Chev Turbo",
    "camera de re",
  ])("combina %s com o Onix pelas palavras do veículo", (nome) => {
    expect(veiculoCombinaComDesejo(onix, desejo({ nome }))).toBe(true);
  });

  it.each(["Onix diesel", "Corolla", "SUV", "Onix 2021", "Onix manual", "de com"])(
    "não combina %s com o Onix",
    (nome) => {
      expect(veiculoCombinaComDesejo(onix, desejo({ nome }))).toBe(false);
    },
  );

  it("combina pela cor com qualquer uma das cores do veículo", () => {
    const harley = { ...onix, cores: ["Preta", "Vermelha", "Azul"] };

    expect(veiculoCombinaComDesejo(harley, desejo({ nome: "Onix vermelha" }))).toBe(true);
    expect(veiculoCombinaComDesejo(harley, desejo({ nome: "Onix azul" }))).toBe(true);
    expect(veiculoCombinaComDesejo(harley, desejo({ nome: "Onix branco" }))).toBe(false);
    expect(veiculoCombinaComDesejo({ ...onix, cores: [] }, desejo({ nome: "Onix branco" }))).toBe(
      false,
    );
  });

  it("não combina quando o ano do veículo fica abaixo do mínimo", () => {
    expect(veiculoCombinaComDesejo(onix, desejo({ anoMinimo: 2023 }))).toBe(true);
    expect(veiculoCombinaComDesejo(onix, desejo({ anoMinimo: 2024 }))).toBe(false);
    expect(veiculoCombinaComDesejo({ ...onix, anoModelo: null }, desejo({ anoMinimo: 2023 }))).toBe(
      false,
    );
  });

  it("não combina quando o preço passa do máximo", () => {
    expect(veiculoCombinaComDesejo(onix, desejo({ precoMaximo: 8_990_000 }))).toBe(true);
    expect(veiculoCombinaComDesejo(onix, desejo({ precoMaximo: 8_989_999 }))).toBe(false);
  });

  it("considera possível o veículo sem ano ou sem preço", () => {
    const semDados = { ...onix, anoFabricacao: null, anoModelo: null, precoVenda: null };
    expect(veiculoCombinaComDesejo(semDados, desejo({ anoMinimo: 2025, precoMaximo: 100 }))).toBe(
      true,
    );
  });
});
