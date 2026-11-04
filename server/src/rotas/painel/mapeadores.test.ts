import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LinhaCarroPainel } from "../../repositorios/carros.ts";
import type { LinhaDesejo } from "../../repositorios/desejos.ts";
import type { LinhaInteresse } from "../../repositorios/interesses.ts";
import {
  paraCarroPainel,
  paraCliente,
  paraClienteComDesejos,
  paraDesejo,
  paraInteresse,
  urlDaFoto,
} from "./mapeadores.ts";

const FOTO_1 = "0b3c2a9e-1f47-4c55-9d21-6a3f8e2b7c10";
const FOTO_2 = "7d4e1f0a-2b36-4e88-8c15-9f0a1b2c3d4e";

function linhaDeCarro(extra: Partial<LinhaCarroPainel> = {}): LinhaCarroPainel {
  return {
    id: "5c1d8a7b-3e2f-4a10-b9c8-7d6e5f4a3b2c",
    slug: "chevrolet-onix-2023-a1b2c3",
    marca: "Chevrolet",
    modelo: "Onix",
    versao: null,
    anoFabricacao: 2022,
    anoModelo: 2023,
    km: 32_000,
    cambio: "Automático",
    combustivel: "Flex",
    carroceria: "Hatch",
    cor: "Prata",
    motor: null,
    portas: 4,
    opcionais: [],
    descricao: null,
    precoVenda: 8_990_000,
    destaque: false,
    status: "disponivel",
    precoCompra: 7_650_000,
    custoPreparacao: 120_000,
    custoDocumentacao: null,
    custoComissao: 90_000,
    precoMinimo: null,
    dataEntrada: "2026-10-01",
    placa: "ABC1D23",
    chassi: null,
    renavam: null,
    origem: null,
    vendedorNome: "Auto Lima Multimarcas",
    vendedorTelefone: "62988887777",
    observacoesInternas: null,
    vendidoEm: null,
    publicadoEm: null,
    criadoEm: new Date("2026-10-01T13:00:00.000Z"),
    atualizadoEm: new Date("2026-10-02T13:00:00.000Z"),
    fotos: [FOTO_1, FOTO_2],
    interessados: 2,
    ...extra,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-30T15:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("paraCarroPainel", () => {
  it("monta a resposta do painel com margem, URLs das fotos e datas em ISO", () => {
    const carro = paraCarroPainel(linhaDeCarro());

    expect(carro).toMatchObject({
      placa: "ABC1D23",
      precoCompra: 7_650_000,
      vendedorNome: "Auto Lima Multimarcas",
      vendedorTelefone: "62988887777",
      margem: 8_990_000 - 7_650_000 - 120_000 - 90_000,
      diasEmEstoque: 29,
      interessados: 2,
      fotos: [
        { id: FOTO_1, url: `/api/dashboard/photos/${FOTO_1}` },
        { id: FOTO_2, url: `/api/dashboard/photos/${FOTO_2}` },
      ],
      vendidoEm: null,
      publicadoEm: null,
      criadoEm: "2026-10-01T13:00:00.000Z",
      atualizadoEm: "2026-10-02T13:00:00.000Z",
    });
  });

  it("converte a data de publicação para ISO", () => {
    const carro = linhaDeCarro({ publicadoEm: new Date("2026-10-03T10:00:00.000Z") });
    expect(paraCarroPainel(carro).publicadoEm).toBe("2026-10-03T10:00:00.000Z");
  });

  it("conta os dias pelo calendário de São Paulo", () => {
    vi.setSystemTime(new Date("2026-10-30T02:59:59.000Z"));
    expect(paraCarroPainel(linhaDeCarro()).diasEmEstoque).toBe(28);

    vi.setSystemTime(new Date("2026-10-30T03:00:00.000Z"));
    expect(paraCarroPainel(linhaDeCarro()).diasEmEstoque).toBe(29);
  });

  it("congela os dias em estoque na data da venda", () => {
    const vendido = linhaDeCarro({
      status: "vendido",
      vendidoEm: new Date("2026-10-11T01:00:00.000Z"),
    });

    expect(paraCarroPainel(vendido)).toMatchObject({
      diasEmEstoque: 9,
      vendidoEm: "2026-10-11T01:00:00.000Z",
    });
  });

  it("não devolve dias negativos se a entrada for depois da venda", () => {
    const carro = linhaDeCarro({ vendidoEm: new Date("2026-09-20T12:00:00.000Z") });
    expect(paraCarroPainel(carro).diasEmEstoque).toBe(0);
  });

  it("deixa a margem nula sem preço de compra ou de venda", () => {
    expect(paraCarroPainel(linhaDeCarro({ precoCompra: null })).margem).toBeNull();
    expect(paraCarroPainel(linhaDeCarro({ precoVenda: null })).margem).toBeNull();
  });

  it("devolve lista de fotos vazia para carro sem fotos", () => {
    expect(paraCarroPainel(linhaDeCarro({ fotos: [] })).fotos).toEqual([]);
  });
});

describe("paraCliente", () => {
  it("mantém os dados e converte as datas para ISO", () => {
    const cliente = paraCliente({
      id: "1d2e3f4a-5b6c-4d7e-8f90-a1b2c3d4e5f6",
      nome: "Maria Souza",
      telefone: "62999990000",
      email: null,
      origem: "instagram",
      observacoes: null,
      desejos: ["Onix automático"],
      interesses: 3,
      criadoEm: new Date("2026-10-29T12:00:00.000Z"),
      atualizadoEm: new Date("2026-10-30T12:00:00.000Z"),
    });

    expect(cliente).toEqual({
      id: "1d2e3f4a-5b6c-4d7e-8f90-a1b2c3d4e5f6",
      nome: "Maria Souza",
      telefone: "62999990000",
      email: null,
      origem: "instagram",
      observacoes: null,
      desejos: ["Onix automático"],
      interesses: 3,
      criadoEm: "2026-10-29T12:00:00.000Z",
      atualizadoEm: "2026-10-30T12:00:00.000Z",
    });
  });
});

describe("paraInteresse", () => {
  function linhaDeInteresse(capa: string | null): LinhaInteresse {
    return {
      id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
      etapa: "proposta",
      motivoPerda: null,
      criadoEm: new Date("2026-10-29T12:00:00.000Z"),
      atualizadoEm: new Date("2026-10-30T12:00:00.000Z"),
      cliente: { id: "c1", nome: "Maria Souza", telefone: "62999990000" },
      carro: {
        id: "c2",
        marca: "Chevrolet",
        modelo: "Onix",
        versao: null,
        anoModelo: 2023,
        status: "disponivel",
        capa,
      },
    };
  }

  it("transforma a capa do carro em URL do painel e as datas em ISO", () => {
    expect(paraInteresse(linhaDeInteresse(FOTO_1))).toMatchObject({
      etapa: "proposta",
      carro: { capa: urlDaFoto(FOTO_1) },
      criadoEm: "2026-10-29T12:00:00.000Z",
      atualizadoEm: "2026-10-30T12:00:00.000Z",
    });
  });

  it("mantém a capa nula para carro sem fotos", () => {
    expect(paraInteresse(linhaDeInteresse(null)).carro.capa).toBeNull();
  });
});

describe("paraDesejo e paraClienteComDesejos", () => {
  const desejo: LinhaDesejo = {
    id: "3f2e1d0c-9b8a-4765-8432-10fedcba9876",
    clienteId: "1d2e3f4a-5b6c-4d7e-8f90-a1b2c3d4e5f6",
    nome: "Onix automático",
    anoMinimo: 2020,
    precoMaximo: 9_000_000,
    observacoes: null,
    ordem: 7,
    criadoEm: new Date("2026-10-29T12:00:00.000Z"),
    possiveis: [linhaDeCarro({ publicadoEm: new Date("2026-10-30T12:00:00.000Z") })],
  };

  it("devolve só os campos do interesse e os dados básicos de cada veículo possível", () => {
    expect(paraDesejo(desejo)).toEqual({
      id: desejo.id,
      nome: "Onix automático",
      anoMinimo: 2020,
      precoMaximo: 9_000_000,
      observacoes: null,
      criadoEm: "2026-10-29T12:00:00.000Z",
      possiveis: [
        {
          id: "5c1d8a7b-3e2f-4a10-b9c8-7d6e5f4a3b2c",
          marca: "Chevrolet",
          modelo: "Onix",
          versao: null,
          anoFabricacao: 2022,
          anoModelo: 2023,
          precoVenda: 8_990_000,
        },
      ],
    });
  });

  it("agrupa os interesses do cliente com a data do possível interesse em ISO", () => {
    const cliente = { id: desejo.clienteId, nome: "Maria Souza", telefone: "62999990000" };
    expect(
      paraClienteComDesejos({
        cliente,
        possivelDesde: new Date("2026-10-30T12:00:00.000Z"),
        recente: desejo.criadoEm.getTime(),
        desejos: [desejo],
      }),
    ).toEqual({
      cliente,
      possivelDesde: "2026-10-30T12:00:00.000Z",
      desejos: [paraDesejo(desejo)],
    });
    expect(
      paraClienteComDesejos({ cliente, possivelDesde: null, recente: 0, desejos: [] }),
    ).toEqual({ cliente, possivelDesde: null, desejos: [] });
  });
});
