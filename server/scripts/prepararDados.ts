import { randomInt, randomUUID } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";
import {
  calcularDigitoRenavam,
  type CarroPainel,
  type CarroValidado,
  type Cliente,
  type DadosLoja,
  type EtapaFunil,
  type Interesse,
  type OrigemCliente,
} from "@globomotors/shared";
import { cadastrarVendedor, mensagemDoErro } from "./vendedor.ts";

type Rgb = readonly [number, number, number];

interface Trapezio {
  topo: number;
  base: number;
  esquerdaTopo: number;
  direitaTopo: number;
  esquerdaBase: number;
  direitaBase: number;
}

interface CarroDeExemplo {
  chave: string;
  tom: Rgb;
  fotos: number;
  dados: Partial<CarroValidado> & Pick<CarroValidado, "marca" | "modelo">;
}

interface ClienteDeExemplo {
  chave: string;
  nome: string;
  ddd: string;
  email: string | null;
  origem: OrigemCliente;
  observacoes: string | null;
}

type InteresseDeExemplo = [cliente: string, carro: string, etapa: EtapaFunil, motivo?: string];

const API = `http://localhost:${process.env.PORT ?? "3001"}/api`;
const WEB = "http://localhost:5173";
const SENHA = "teste123";
const sufixo = randomUUID().slice(0, 6);
let cookie = "";

const LOJA: DadosLoja = {
  nome: "Globo Motors",
  cidade: "Campinas, SP",
  slogan: "Seminovos revisados, com procedência e garantia",
  whatsapp: "(19) 98765-4321",
  instagram: "@globomotors",
  mostrarPreco: true,
  mostrarVendidos: true,
};

const CARROS: CarroDeExemplo[] = [
  {
    chave: "onix",
    tom: [192, 197, 204],
    fotos: 8,
    dados: {
      marca: "Chevrolet",
      modelo: "Onix",
      versao: "1.0 Turbo LTZ",
      anoFabricacao: 2020,
      anoModelo: 2021,
      km: 42_000,
      cambio: "Automático",
      combustivel: "Flex",
      carroceria: "Hatch",
      cores: ["Prata"],
      motor: "1.0 Turbo",
      portas: 4,
      opcionais: ["Ar-condicionado", "Direção elétrica", "Multimídia", "Câmera de ré"],
      descricao: "Único dono, revisões na concessionária e manual completo.",
      precoVenda: 8_990_000,
      destaque: true,
      status: "disponivel",
      precoCompra: 7_500_000,
      custoPreparacao: 120_000,
      custoDocumentacao: 80_000,
      custoComissao: 50_000,
      precoMinimo: 8_500_000,
      dataEntrada: diasAtras(29),
      origem: "Troca na venda de um Tracker",
      vendedorNome: "Auto Lima Multimarcas",
      vendedorTelefone: "1932324545",
      observacoesInternas: "Pneus novos. IPVA 2026 pago.",
    },
  },
  {
    chave: "corolla",
    tom: [236, 238, 240],
    fotos: 2,
    dados: {
      marca: "Toyota",
      modelo: "Corolla",
      versao: "XEi 2.0",
      anoFabricacao: 2021,
      anoModelo: 2022,
      km: 61_000,
      cambio: "CVT",
      combustivel: "Flex",
      carroceria: "Sedã",
      cores: ["Branco"],
      motor: "2.0",
      portas: 4,
      opcionais: ["Bancos de couro", "Piloto automático", "Faróis de LED", "Multimídia"],
      descricao: "Sedã confortável, todas as revisões feitas na Toyota.",
      precoVenda: 13_290_000,
      destaque: true,
      status: "disponivel",
      precoCompra: 11_500_000,
      custoPreparacao: 180_000,
      custoDocumentacao: 90_000,
      custoComissao: 120_000,
      precoMinimo: 12_800_000,
      dataEntrada: diasAtras(12),
      origem: "Leilão de frota",
      vendedorNome: "Marcos Pereira",
      vendedorTelefone: "19991234567",
      observacoesInternas: "Pequeno risco no para-choque traseiro.",
    },
  },
  {
    chave: "pulse",
    tom: [170, 32, 38],
    fotos: 2,
    dados: {
      marca: "Fiat",
      modelo: "Pulse",
      versao: "Drive 1.3",
      anoFabricacao: 2022,
      anoModelo: 2023,
      km: 28_000,
      cambio: "CVT",
      combustivel: "Flex",
      carroceria: "SUV",
      cores: ["Vermelho"],
      motor: "1.3",
      portas: 4,
      opcionais: ["Central multimídia", "Controle de tração", "Ar digital"],
      descricao: "SUV compacto, ainda na garantia de fábrica.",
      precoVenda: 10_490_000,
      status: "reservado",
      precoCompra: 9_200_000,
      custoPreparacao: 60_000,
      custoDocumentacao: 80_000,
      precoMinimo: 10_000_000,
      dataEntrada: diasAtras(45),
      origem: "Compra direta de particular",
      vendedorNome: "Auto Lima Multimarcas",
      vendedorTelefone: "1932324545",
      observacoesInternas: "Reservado com sinal de R$ 2.000.",
    },
  },
  {
    chave: "compass",
    tom: [38, 40, 44],
    fotos: 2,
    dados: {
      marca: "Jeep",
      modelo: "Compass",
      versao: "Longitude 2.0 Diesel",
      anoFabricacao: 2020,
      anoModelo: 2021,
      km: 78_000,
      cambio: "Automático",
      combustivel: "Diesel",
      carroceria: "SUV",
      cores: ["Preto"],
      motor: "2.0 Turbo Diesel",
      portas: 4,
      opcionais: ["Tração 4x4", "Teto solar", "Bancos de couro"],
      descricao: "4x4 a diesel, pronto para viajar.",
      precoVenda: 14_990_000,
      status: "disponivel",
      precoCompra: 13_000_000,
      custoPreparacao: 250_000,
      custoDocumentacao: 90_000,
      custoComissao: 150_000,
      precoMinimo: 14_200_000,
      dataEntrada: diasAtras(64),
      origem: "Troca",
      vendedorNome: "Rodrigo Alves",
      vendedorTelefone: "11988776655",
      observacoesInternas: "Trocar pastilhas de freio antes da entrega.",
    },
  },
  {
    chave: "gol",
    tom: [236, 238, 240],
    fotos: 1,
    dados: {
      marca: "Volkswagen",
      modelo: "Gol",
      versao: "1.0 MPI",
      anoFabricacao: 2019,
      anoModelo: 2020,
      km: 95_000,
      cambio: "Manual",
      combustivel: "Flex",
      carroceria: "Hatch",
      cores: ["Branco"],
      portas: 4,
      descricao: "Econômico e com manutenção barata.",
      precoVenda: 5_290_000,
      status: "vendido",
      precoCompra: 4_300_000,
      custoPreparacao: 90_000,
      precoMinimo: 5_000_000,
      dataEntrada: diasAtras(90),
      origem: "Troca",
      vendedorNome: "Garagem Central",
      vendedorTelefone: "1932418800",
    },
  },
  {
    chave: "fit",
    tom: [120, 126, 134],
    fotos: 0,
    dados: {
      marca: "Honda",
      modelo: "Fit",
      versao: "EXL 1.5",
      anoFabricacao: 2019,
      anoModelo: 2019,
      km: 70_000,
      cambio: "CVT",
      combustivel: "Flex",
      carroceria: "Hatch",
      cores: ["Cinza"],
      precoCompra: 6_800_000,
      dataEntrada: diasAtras(2),
      origem: "Compra direta de particular",
      vendedorNome: "Patrícia Gomes",
      observacoesInternas: "Aguardando fotos e polimento.",
    },
  },
  {
    chave: "hb20",
    tom: [36, 74, 140],
    fotos: 2,
    dados: {
      marca: "Hyundai",
      modelo: "HB20",
      versao: "1.0 Comfort",
      anoFabricacao: 2022,
      anoModelo: 2022,
      km: 33_000,
      cambio: "Manual",
      combustivel: "Flex",
      carroceria: "Hatch",
      cores: ["Azul"],
      portas: 4,
      descricao: "Preço sob consulta: aceitamos seu usado na troca.",
      status: "disponivel",
      precoCompra: 6_100_000,
      dataEntrada: diasAtras(7),
      origem: "Troca",
    },
  },
  {
    chave: "hilux",
    tom: [180, 184, 190],
    fotos: 2,
    dados: {
      marca: "Toyota",
      modelo: "Hilux",
      versao: "SRV 2.8 4x4",
      anoFabricacao: 2019,
      anoModelo: 2019,
      km: 112_000,
      cambio: "Automático",
      combustivel: "Diesel",
      carroceria: "Picape",
      cores: ["Prata"],
      motor: "2.8 Turbo Diesel",
      portas: 4,
      opcionais: ["Tração 4x4", "Capota marítima", "Engate", "Bancos de couro"],
      descricao: "Picape pronta para o trabalho, revisada e com pneus novos.",
      precoVenda: 18_990_000,
      status: "disponivel",
      precoCompra: 16_800_000,
      custoPreparacao: 200_000,
      custoDocumentacao: 120_000,
      custoComissao: 180_000,
      precoMinimo: 18_300_000,
      dataEntrada: diasAtras(20),
      origem: "Consignada por produtor rural",
      vendedorNome: "Sérgio Nogueira",
      vendedorTelefone: "19997771122",
      observacoesInternas: "O dono aceita um carro de menor valor na troca.",
    },
  },
  {
    chave: "corollaCross",
    tom: [98, 102, 108],
    fotos: 2,
    dados: {
      marca: "Toyota",
      modelo: "Corolla Cross",
      versao: "XRX Hybrid 1.8",
      anoFabricacao: 2023,
      anoModelo: 2023,
      km: 18_000,
      cambio: "CVT",
      combustivel: "Híbrido",
      carroceria: "SUV",
      cores: ["Cinza"],
      motor: "1.8 Híbrido",
      portas: 4,
      opcionais: ["Teto solar", "Faróis de LED", "Piloto automático adaptativo"],
      descricao: "Híbrido econômico, ainda na garantia de fábrica.",
      precoVenda: 16_490_000,
      destaque: true,
      status: "disponivel",
      precoCompra: 15_200_000,
      custoPreparacao: 50_000,
      custoDocumentacao: 90_000,
      custoComissao: 160_000,
      precoMinimo: 16_000_000,
      dataEntrada: diasAtras(5),
      origem: "Repasse de loja parceira",
      vendedorNome: "Garagem Central",
      vendedorTelefone: "1932418800",
    },
  },
  {
    chave: "argo",
    tom: [236, 238, 240],
    fotos: 2,
    dados: {
      marca: "Fiat",
      modelo: "Argo",
      versao: "Drive 1.3 GSR",
      anoFabricacao: 2020,
      anoModelo: 2021,
      km: 54_000,
      cambio: "Automatizado",
      combustivel: "Flex",
      carroceria: "Hatch",
      cores: ["Branco"],
      motor: "1.3",
      portas: 4,
      opcionais: ["Multimídia", "Câmera de ré", "Sensor de estacionamento"],
      descricao: "Câmbio automatizado, ideal para o trânsito da cidade.",
      precoVenda: 6_490_000,
      status: "disponivel",
      precoCompra: 5_600_000,
      custoPreparacao: 70_000,
      custoDocumentacao: 60_000,
      precoMinimo: 6_200_000,
      dataEntrada: diasAtras(16),
      origem: "Repasse de loja parceira",
      vendedorNome: "Auto Lima Multimarcas",
      vendedorTelefone: "1932324545",
    },
  },
  {
    chave: "uno",
    tom: [176, 30, 36],
    fotos: 1,
    dados: {
      marca: "Fiat",
      modelo: "Uno",
      versao: "Way 1.0",
      anoFabricacao: 2014,
      anoModelo: 2015,
      km: 128_000,
      cambio: "Manual",
      combustivel: "Flex",
      carroceria: "Hatch",
      cores: ["Vermelho"],
      motor: "1.0",
      portas: 4,
      opcionais: ["Ar-condicionado", "Direção hidráulica"],
      descricao: "Ótimo primeiro carro, com a documentação em dia.",
      precoVenda: 2_890_000,
      status: "disponivel",
      precoCompra: 2_350_000,
      custoPreparacao: 80_000,
      precoMinimo: 2_700_000,
      dataEntrada: diasAtras(33),
      origem: "Particular",
      vendedorNome: "Luciana Prado",
      vendedorTelefone: "19988445566",
    },
  },
];

const CLIENTES: ClienteDeExemplo[] = [
  {
    chave: "ana",
    nome: "Ana Souza",
    ddd: "19",
    email: "ana",
    origem: "instagram",
    observacoes: "Procura hatch automático até R$ 90 mil.",
  },
  {
    chave: "bruno",
    nome: "Bruno Lima",
    ddd: "19",
    email: "bruno",
    origem: "indicacao",
    observacoes: "Tem um Uno 2012 para dar na troca.",
  },
  {
    chave: "carla",
    nome: "Carla Dias",
    ddd: "11",
    email: null,
    origem: "vitrine",
    observacoes: null,
  },
  {
    chave: "diego",
    nome: "Diego Rocha",
    ddd: "19",
    email: "diego",
    origem: "marketplace",
    observacoes: "Quer financiar em 48 vezes.",
  },
  {
    chave: "elaine",
    nome: "Elaine Martins",
    ddd: "11",
    email: "elaine",
    origem: "whatsapp",
    observacoes: "Quer SUV a diesel para viajar.",
  },
];

const INTERESSES: InteresseDeExemplo[] = [
  ["ana", "onix", "proposta"],
  ["ana", "hb20", "novo"],
  ["bruno", "onix", "em_contato"],
  ["bruno", "gol", "vendido"],
  ["carla", "pulse", "negociacao"],
  ["diego", "compass", "visita_agendada"],
  ["elaine", "compass", "perdido", "Achou o preço alto e comprou em outra loja."],
  ["elaine", "corolla", "novo"],
  ["ana", "argo", "em_contato"],
  ["carla", "corollaCross", "proposta"],
  ["diego", "hilux", "novo"],
  ["elaine", "hilux", "visita_agendada"],
];

const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const LARGURA = 800;
const ALTURA = 600;
const HORIZONTE = 390;
const RODAS = [
  [250, 445],
  [560, 445],
] as const;
const CABINE: Trapezio = {
  topo: 270,
  base: 352,
  esquerdaTopo: 290,
  direitaTopo: 520,
  esquerdaBase: 215,
  direitaBase: 610,
};
const JANELA: Trapezio = {
  topo: 284,
  base: 344,
  esquerdaTopo: 302,
  direitaTopo: 506,
  esquerdaBase: 236,
  direitaBase: 586,
};
const FUNDOS: [parede: Rgb, chao: Rgb][] = [
  [
    [226, 232, 240],
    [150, 160, 176],
  ],
  [
    [242, 232, 218],
    [172, 154, 134],
  ],
  [
    [216, 228, 224],
    [124, 142, 136],
  ],
];

function diasAtras(dias: number) {
  return new Date(Date.now() - dias * 86_400_000).toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

function digitos(quantidade: number) {
  return Array.from({ length: quantidade }, () => randomInt(10)).join("");
}

function placaAleatoria() {
  const letra = () => String.fromCharCode(65 + randomInt(26));
  return `${letra()}${letra()}${letra()}${digitos(1)}${letra()}${digitos(2)}`;
}

function chassiAleatorio() {
  const simbolos = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  return Array.from({ length: 17 }, () => simbolos.charAt(randomInt(simbolos.length))).join("");
}

function renavamAleatorio() {
  const base = digitos(10);
  return `${base}${calcularDigitoRenavam(base)}`;
}

function limitar(valor: number) {
  return Math.min(255, Math.max(0, Math.round(valor)));
}

function misturar(a: Rgb, b: Rgb, proporcao: number): Rgb {
  return [
    limitar(a[0] + (b[0] - a[0]) * proporcao),
    limitar(a[1] + (b[1] - a[1]) * proporcao),
    limitar(a[2] + (b[2] - a[2]) * proporcao),
  ];
}

function sombrear(cor: Rgb, fator: number): Rgb {
  return [limitar(cor[0] * fator), limitar(cor[1] * fator), limitar(cor[2] * fator)];
}

function dentroDoTrapezio(x: number, y: number, forma: Trapezio) {
  if (y < forma.topo || y > forma.base) return false;
  const proporcao = (y - forma.topo) / (forma.base - forma.topo);
  const esquerda = forma.esquerdaTopo + (forma.esquerdaBase - forma.esquerdaTopo) * proporcao;
  const direita = forma.direitaTopo + (forma.direitaBase - forma.direitaTopo) * proporcao;
  return x >= esquerda && x <= direita;
}

function dentroDaCarroceria(x: number, y: number) {
  const [esquerda, direita, topo, base, raio] = [120, 690, 350, 452, 38];
  if (x < esquerda || x > direita || y < topo || y > base) return false;
  const cantoX = x < esquerda + raio ? esquerda + raio : x > direita - raio ? direita - raio : x;
  const cantoY = y < topo + raio ? topo + raio : y > base - raio ? base - raio : y;
  return Math.hypot(x - cantoX, y - cantoY) <= raio;
}

function pintarCarro(tom: Rgb, [parede, chao]: [Rgb, Rgb], espelhado: boolean) {
  return (coluna: number, y: number): Rgb => {
    const x = espelhado ? LARGURA - 1 - coluna : coluna;
    for (const [cx, cy] of RODAS) {
      const distancia = Math.hypot(x - cx, y - cy);
      if (distancia <= 12) return [92, 96, 102];
      if (distancia <= 32) return [178, 182, 188];
      if (distancia <= 56) return [30, 31, 34];
    }
    if (dentroDoTrapezio(x, y, JANELA) && Math.abs(x - 410) > 6) {
      return misturar([58, 78, 104], [150, 172, 196], ((x - 236) / 350) * 0.7);
    }
    if (dentroDoTrapezio(x, y, CABINE) || dentroDaCarroceria(x, y)) {
      if (x >= 668 && x <= 690 && y >= 372 && y <= 390) return [252, 244, 206];
      if (x >= 120 && x <= 136 && y >= 370 && y <= 388) return [196, 30, 34];
      if (Math.abs(x - 410) <= 1 && y >= 356 && y <= 440) return sombrear(tom, 0.7);
      return sombrear(tom, y < 380 ? 1.08 : y > 430 ? 0.82 : 1);
    }
    if (y < HORIZONTE) return misturar(parede, sombrear(parede, 0.9), y / HORIZONTE);
    const piso = misturar(chao, sombrear(chao, 0.8), (y - HORIZONTE) / (ALTURA - HORIZONTE));
    const sombra = ((x - 405) / 310) ** 2 + ((y - 498) / 24) ** 2;
    return sombra <= 1 ? sombrear(piso, 0.6 + sombra * 0.4) : piso;
  };
}

function blocoPng(tipo: string, dados: Buffer) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const conteudo = Buffer.concat([Buffer.from(tipo, "latin1"), dados]);
  const verificacao = Buffer.alloc(4);
  verificacao.writeUInt32BE(crc32(conteudo));
  return Buffer.concat([tamanho, conteudo, verificacao]);
}

function fotoDoCarro(tom: Rgb, variante: number) {
  const fundo = FUNDOS[variante % FUNDOS.length] ?? FUNDOS[0];
  if (!fundo) throw new Error("Sem fundo para a foto.");
  const pintar = pintarCarro(tom, fundo, variante % 2 === 1);
  const larguraDaLinha = LARGURA * 3 + 1;
  const pixels = Buffer.alloc(larguraDaLinha * ALTURA);
  for (let y = 0; y < ALTURA; y++) {
    for (let x = 0; x < LARGURA; x++) {
      pixels.set(pintar(x, y), y * larguraDaLinha + 1 + x * 3);
    }
  }
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(LARGURA, 0);
  cabecalho.writeUInt32BE(ALTURA, 4);
  cabecalho.set([8, 2], 8);
  return Buffer.concat([
    ASSINATURA_PNG,
    blocoPng("IHDR", cabecalho),
    blocoPng("IDAT", deflateSync(pixels)),
    blocoPng("IEND", Buffer.alloc(0)),
  ]);
}

function corpoDaRequisicao(corpo: unknown): { tipo?: string; body?: RequestInit["body"] } {
  if (corpo === undefined) return {};
  if (corpo instanceof Uint8Array) return { tipo: "image/png", body: new Blob([corpo]) };
  return { tipo: "application/json", body: JSON.stringify(corpo) };
}

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const { tipo, body } = corpoDaRequisicao(corpo);
  const resposta = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { cookie, ...(tipo && { "content-type": tipo }) },
    body,
  }).catch((erro: unknown) => {
    throw new Error(`A API não respondeu em ${API}. Suba-a com npm run dev na raiz.`, {
      cause: erro,
    });
  });
  if (!resposta.ok) {
    throw new Error(`${metodo} ${caminho} respondeu ${resposta.status}: ${await resposta.text()}`);
  }
  if (caminho === "/auth/login") {
    cookie = resposta.headers.getSetCookie()[0]?.split(";")[0] ?? "";
  }
  return (await resposta.json()) as T;
}

function buscar<T>(mapa: Map<string, T>, chave: string) {
  const valor = mapa.get(chave);
  if (!valor) throw new Error(`Exemplo "${chave}" não foi cadastrado.`);
  return valor;
}

async function prepararDados() {
  const email = `vendedor.${sufixo}@globomotors.test`;
  await cadastrarVendedor({ nome: "Vendedor Teste", email, senha: SENHA });
  await chamar("POST", "/auth/login", { email, senha: SENHA });
  await chamar("PUT", "/dashboard/store", LOJA);

  const carros = new Map<string, CarroPainel>();
  for (const { chave, tom, fotos, dados } of CARROS) {
    const { carro } = await chamar<{ carro: CarroPainel }>("POST", "/dashboard/cars", {
      ...dados,
      placa: placaAleatoria(),
      chassi: chassiAleatorio(),
      renavam: renavamAleatorio(),
    });
    for (let variante = 0; variante < fotos; variante++) {
      await chamar("POST", `/dashboard/cars/${carro.id}/photos`, fotoDoCarro(tom, variante));
    }
    carros.set(chave, carro);
  }

  const clientes = new Map<string, Cliente>();
  for (const { chave, ddd, email: usuario, ...dados } of CLIENTES) {
    const { cliente } = await chamar<{ cliente: Cliente }>("POST", "/dashboard/customers", {
      ...dados,
      telefone: `${ddd}9${digitos(8)}`,
      email: usuario && `${usuario}.${sufixo}@exemplo.com`,
    });
    clientes.set(chave, cliente);
  }

  for (const [cliente, carro, etapa, motivo] of INTERESSES) {
    const { interesse } = await chamar<{ interesse: Interesse }>("POST", "/dashboard/interests", {
      clienteId: buscar(clientes, cliente).id,
      carroId: buscar(carros, carro).id,
    });
    if (etapa !== "novo") {
      await chamar("PATCH", `/dashboard/interests/${interesse.id}`, {
        etapa,
        motivoPerda: motivo ?? null,
      });
    }
  }

  console.log(`
Dados prontos (sufixo ${sufixo}): ${carros.size} carros, ${clientes.size} clientes e ${INTERESSES.length} interesses.

Página inicial      ${WEB}/
Catálogo            ${WEB}/catalogo
Página de um carro  ${WEB}/catalogo/${buscar(carros, "onix").slug}
Entrar              ${WEB}/login
  e-mail            ${email}
  senha             ${SENHA}
Carros do painel    ${WEB}/dashboard/cars
Funil               ${WEB}/dashboard/funnel
Rascunho (fora do catálogo)  ${WEB}/dashboard/cars/${buscar(carros, "fit").id}
`);
}

try {
  await prepararDados();
} catch (erro) {
  console.error(mensagemDoErro(erro));
  process.exitCode = 1;
}
