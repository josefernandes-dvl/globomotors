import { randomUUID } from "node:crypto";
import { cadastrarVendedor, mensagemDoErro } from "./vendedor.ts";

const API = `http://localhost:${process.env.PORT ?? "3001"}/api`;
const WEB = "http://localhost:5173";
const SENHA = "teste123";
const sufixo = randomUUID().slice(0, 6);

const VEICULOS = [
  {
    marca: "Chevrolet",
    modelo: "Onix",
    versao: "1.0 Turbo LTZ",
    carroceria: "Hatch",
    combustivel: "Flex",
    cambio: "Automático",
    anoFabricacao: 2020,
    anoModelo: 2021,
    km: 42_000,
    cores: ["Prata"],
    precoVenda: 8_990_000,
  },
  {
    marca: "Jeep",
    modelo: "Compass",
    versao: "Longitude",
    carroceria: "SUV",
    combustivel: "Diesel",
    cambio: "Automático",
    anoFabricacao: 2022,
    anoModelo: 2023,
    km: 15_000,
    precoVenda: 14_500_000,
    destaque: true,
  },
  {
    marca: "Honda",
    modelo: "CG 160",
    versao: "Titan",
    carroceria: "Moto",
    combustivel: "Flex",
    cambio: "Manual",
    anoFabricacao: 2023,
    anoModelo: 2023,
    km: 8_000,
    precoVenda: 1_890_000,
  },
  {
    marca: "Fiat",
    modelo: "Uno",
    versao: "Way 1.0",
    combustivel: "Flex",
    cambio: "Manual",
    anoFabricacao: 2015,
    anoModelo: 2016,
    km: 98_000,
    precoVenda: 3_190_000,
  },
  {
    marca: "Yamaha",
    modelo: "Fazer FZ25",
    versao: "ABS",
    carroceria: "Moto",
    combustivel: "Gasolina",
    cambio: "Manual",
    anoFabricacao: 2022,
    anoModelo: 2023,
    km: 12_000,
    precoVenda: 2_190_000,
  },
  {
    marca: "Honda",
    modelo: "PCX 160",
    versao: "DLX",
    carroceria: "Scooter",
    combustivel: "Gasolina",
    cambio: "CVT",
    anoFabricacao: 2025,
    anoModelo: 2025,
    km: 0,
    cores: ["Branca", "Preta", "Cinza"],
    precoVenda: 2_090_000,
    destaque: true,
  },
  {
    marca: "Yamaha",
    modelo: "NMax 160",
    versao: "ABS",
    carroceria: "Scooter",
    combustivel: "Gasolina",
    cambio: "CVT",
    anoFabricacao: 2024,
    anoModelo: 2024,
    km: 3_000,
    precoVenda: 1_950_000,
  },
  {
    marca: "Voltz",
    modelo: "EVS",
    carroceria: "Moto elétrica",
    combustivel: "Elétrico",
    cambio: "Automático",
    anoFabricacao: 2024,
    anoModelo: 2024,
    km: 1_200,
    precoVenda: 1_790_000,
  },
  {
    marca: "Super Soco",
    modelo: "TC Max",
    carroceria: "Moto elétrica",
    combustivel: "Elétrico",
    cambio: "Automático",
    anoFabricacao: 2024,
    anoModelo: 2024,
    km: 2_500,
    precoVenda: 2_390_000,
  },
  {
    marca: "Xiaomi",
    modelo: "Mi Pro 2",
    carroceria: "Patinete",
    combustivel: "Elétrico",
    anoFabricacao: 2025,
    anoModelo: 2025,
    km: 0,
    precoVenda: 349_000,
  },
  {
    marca: "Segway",
    modelo: "Ninebot Max G2",
    carroceria: "Patinete",
    combustivel: "Elétrico",
    anoFabricacao: 2025,
    anoModelo: 2025,
    km: 150,
    precoVenda: 459_000,
  },
  {
    marca: "Shineray",
    modelo: "Trike",
    versao: "1500W",
    carroceria: "Triciclo",
    combustivel: "Elétrico",
    cambio: "Automático",
    motor: "1500W",
    cores: ["Prata", "Vermelha"],
    anoFabricacao: 2025,
    anoModelo: 2025,
    km: 0,
    precoVenda: 1_590_000,
  },
  {
    marca: "Bandeirante",
    modelo: "Jipe Elétrico",
    versao: "12V",
    carroceria: "Infantil",
    combustivel: "Elétrico",
    motor: "12V",
    cores: ["Azul"],
    anoFabricacao: 2025,
    anoModelo: 2025,
    km: 0,
    precoVenda: 129_000,
  },
];

let cookie = "";

async function chamar(metodo: string, caminho: string, corpo: unknown) {
  const resposta = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(corpo),
  }).catch((erro: unknown) => {
    throw new Error(`A API não respondeu em ${API}. Suba-a com npm run dev na raiz.`, {
      cause: erro,
    });
  });
  if (!resposta.ok) {
    throw new Error(
      `${metodo} /api${caminho} respondeu ${resposta.status}: ${await resposta.text()}`,
    );
  }
  return resposta;
}

function linha(rotulo: string, valor: string) {
  return `${rotulo.padEnd(18)} ${valor}`;
}

async function prepararTesteAbas() {
  const email = `abas.${sufixo}@globomotors.test`;
  await cadastrarVendedor({ nome: `Rui ${sufixo}`, email, senha: SENHA });
  const login = await chamar("POST", "/auth/login", { email, senha: SENHA });
  cookie = login.headers.getSetCookie()[0]?.split(";")[0] ?? "";

  for (const veiculo of VEICULOS) {
    await chamar("POST", "/dashboard/cars", { ...veiculo, status: "disponivel" });
  }

  const nomes = (carroceria: string) =>
    VEICULOS.filter((veiculo) => veiculo.carroceria === carroceria)
      .map(({ marca, modelo }) => `${marca} ${modelo}`)
      .join(" e ");

  console.log(`
Teste das abas e das cores pronto (sufixo ${sufixo}).

${linha("Entrar", `${WEB}/login`)}
${linha("  e-mail", email)}
${linha("  senha", SENHA)}
${linha("Catálogo", `${WEB}/catalogo`)}
${linha("Veículos (painel)", `${WEB}/dashboard/cars`)}
${linha("Página inicial", WEB)}

Publicados agora, todos disponíveis:
  Carros: Chevrolet Onix, Jeep Compass (destaque) e Fiat Uno (sem carroceria, entra em Carros)
  Motos: ${nomes("Moto")} (na aba Todos, ficam junto com os carros)
  Scooters: ${nomes("Scooter")} (a PCX tem destaque)
  Motos elétricas: ${nomes("Moto elétrica")}
  Patinetes: ${nomes("Patinete")}
  Triciclos: ${nomes("Triciclo")}
  Infantis: ${nomes("Infantil")}

Cores: a PCX vem em Branca, Preta e Cinza e o Trike em Prata e Vermelha (a página do veículo
lista as cores disponíveis e a ficha não mostra Cor); o Onix (Prata) e o Jipe (Azul) têm
uma cor só, que aparece na ficha e na mensagem do WhatsApp.
`);
}

try {
  await prepararTesteAbas();
} catch (erro) {
  console.error(mensagemDoErro(erro));
  process.exitCode = 1;
}
