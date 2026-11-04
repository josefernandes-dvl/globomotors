import type {
  CarroPainel,
  CarroPublico,
  Cliente,
  ClienteComDesejos,
  Desejo,
  Interesse,
  Loja,
  LojaPublica,
  Usuario,
  VeiculoPossivel,
} from "@globomotors/shared";
import type { RotasSimuladas } from "./simularApi.ts";

export const USUARIO: Usuario = {
  id: "u1",
  nome: "Marcos Vendedor",
  email: "marcos@globomotors.test",
};

export const LOJA_PUBLICA: LojaPublica = {
  nome: "Globo Motors",
  cidade: "Campinas, SP",
  slogan: "Seminovos com procedência",
  whatsapp: "11987654321",
  instagram: "globomotors",
  mostrarPreco: true,
};

export const LOJA: Loja = { ...LOJA_PUBLICA, mostrarVendidos: false };

export function carroPublico(campos: Partial<CarroPublico> = {}): CarroPublico {
  return {
    slug: "chevrolet-onix-2021-c1",
    marca: "Chevrolet",
    modelo: "Onix",
    versao: "1.0 Turbo LTZ",
    anoFabricacao: 2020,
    anoModelo: 2021,
    km: 42000,
    cambio: "Automático",
    combustivel: "Flex",
    carroceria: "Hatch",
    cor: "Prata",
    motor: "1.0 Turbo",
    portas: 4,
    opcionais: ["Ar-condicionado", "Multimídia"],
    descricao: "Único dono, revisões na concessionária.",
    destaque: false,
    fotos: [],
    preco: 8_990_000,
    status: "disponivel",
    ...campos,
  };
}

export function carroPainel(campos: Partial<CarroPainel> = {}): CarroPainel {
  const { preco, ...publicos } = carroPublico();
  return {
    ...publicos,
    id: "c1",
    status: "disponivel",
    precoVenda: preco,
    precoCompra: 7_500_000,
    custoPreparacao: 120_000,
    custoDocumentacao: 80_000,
    custoComissao: 50_000,
    precoMinimo: 8_500_000,
    margem: 1_240_000,
    dataEntrada: "2026-10-01",
    diasEmEstoque: 29,
    placa: "ABC1D23",
    chassi: "9BGKS48U0LG123456",
    renavam: "00123456789",
    origem: "Troca",
    vendedorNome: "Auto Lima Multimarcas",
    vendedorTelefone: "62988887777",
    observacoesInternas: "Pneus novos",
    interessados: 0,
    vendidoEm: null,
    publicadoEm: "2026-10-01T13:00:00.000Z",
    criadoEm: "2026-10-01T13:00:00.000Z",
    atualizadoEm: "2026-10-01T13:00:00.000Z",
    ...campos,
  };
}

export function cliente(campos: Partial<Cliente> = {}): Cliente {
  return {
    id: "k1",
    nome: "Ana Souza",
    telefone: "11912345678",
    email: "ana@exemplo.com",
    origem: "instagram",
    observacoes: "Procura hatch automático",
    desejos: [],
    interesses: 0,
    criadoEm: "2026-10-20T15:00:00.000Z",
    atualizadoEm: "2026-10-20T15:00:00.000Z",
    ...campos,
  };
}

export function interesse(campos: Partial<Interesse> = {}): Interesse {
  return {
    id: "i1",
    etapa: "novo",
    motivoPerda: null,
    criadoEm: "2026-10-21T15:00:00.000Z",
    atualizadoEm: "2026-10-21T15:00:00.000Z",
    cliente: { id: "k1", nome: "Ana Souza", telefone: "11912345678" },
    carro: {
      id: "c1",
      marca: "Chevrolet",
      modelo: "Onix",
      versao: "1.0 Turbo LTZ",
      anoModelo: 2021,
      status: "disponivel",
      capa: null,
    },
    ...campos,
  };
}

export function veiculoPossivel(campos: Partial<VeiculoPossivel> = {}): VeiculoPossivel {
  return {
    id: "c1",
    marca: "Chevrolet",
    modelo: "Onix",
    versao: "1.0 Turbo LTZ",
    anoFabricacao: 2020,
    anoModelo: 2021,
    precoVenda: 8_990_000,
    ...campos,
  };
}

export function desejo(campos: Partial<Desejo> = {}): Desejo {
  return {
    id: "d1",
    nome: "Onix automático",
    anoMinimo: null,
    precoMaximo: null,
    observacoes: null,
    criadoEm: "2026-10-22T15:00:00.000Z",
    possiveis: [],
    ...campos,
  };
}

export function clienteComDesejos(campos: Partial<ClienteComDesejos> = {}): ClienteComDesejos {
  return {
    cliente: { id: "k1", nome: "Ana Souza", telefone: "11912345678" },
    possivelDesde: null,
    desejos: [desejo()],
    ...campos,
  };
}

export function rotasDoPainel(extra: RotasSimuladas = {}): RotasSimuladas {
  return {
    "GET /api/auth/me": { usuario: USUARIO },
    "GET /api/dashboard/store": { loja: LOJA },
    "GET /api/dashboard/wishes": { clientes: [] },
    ...extra,
  };
}
