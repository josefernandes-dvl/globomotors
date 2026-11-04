import { randomUUID } from "node:crypto";
import type { CarroSalvo, Cliente, ClienteComDesejos, Interesse } from "@globomotors/shared";
import { cadastrarVendedor, mensagemDoErro } from "./vendedor.ts";

const API = `http://localhost:${process.env.PORT ?? "3001"}/api`;
const WEB = "http://localhost:5173";
const SENHA = "teste123";
const sufixo = randomUUID().slice(0, 6);
const finalDoTelefone = String(Number.parseInt(sufixo, 16)).padStart(8, "0").slice(-7);

let cookie = "";

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown) {
  const resposta = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { cookie, ...(corpo !== undefined && { "content-type": "application/json" }) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
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
  return { resposta, dados: (await resposta.json()) as T };
}

async function cadastrarCliente(nome: string, indice: number, desejos: string[]) {
  const { dados } = await chamar<{ cliente: Cliente }>("POST", "/dashboard/customers", {
    nome: `${nome} ${sufixo}`,
    telefone: `119${finalDoTelefone}${indice}`,
    origem: "whatsapp",
    desejos,
  });
  return dados.cliente;
}

async function cadastrarVeiculo(dados: Record<string, unknown>) {
  return (await chamar<CarroSalvo>("POST", "/dashboard/cars", dados)).dados;
}

function linha(rotulo: string, valor: string) {
  return `${rotulo.padEnd(22)} ${valor}`;
}

async function prepararTesteInteresses() {
  const email = `interesses.${sufixo}@globomotors.test`;
  await cadastrarVendedor({ nome: `Lia ${sufixo}`, email, senha: SENHA });
  const { resposta: login } = await chamar("POST", "/auth/login", { email, senha: SENHA });
  cookie = login.headers.getSetCookie()[0]?.split(";")[0] ?? "";

  const ana = await cadastrarCliente("Ana", 1, ["Onix automático", "SUV diesel"]);
  const bruno = await cadastrarCliente("Bruno", 2, []);
  const carla = await cadastrarCliente("Carla", 3, ["CG 160"]);
  const diego = await cadastrarCliente("Diego", 4, ["Hilux"]);
  await chamar("POST", "/dashboard/wishes", {
    clienteId: bruno.id,
    nome: "Compass",
    anoMinimo: 2021,
    precoMaximo: 15_000_000,
    observacoes: "Prefere preto e tem um Renegade para dar na troca.",
  });

  const onix = await cadastrarVeiculo({
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
    precoVenda: 8_990_000,
    status: "disponivel",
  });
  if (onix.possiveisInteressados !== 1) {
    throw new Error(`O Onix devia ter 1 cliente interessado, e não ${onix.possiveisInteressados}.`);
  }
  const compass = await cadastrarVeiculo({
    marca: "Jeep",
    modelo: "Compass",
    versao: "Longitude 2.0 Diesel",
    anoFabricacao: 2022,
    anoModelo: 2023,
    km: 15_000,
    cambio: "Automático",
    combustivel: "Diesel",
    carroceria: "SUV",
    cor: "Preto",
    precoVenda: 14_500_000,
    status: "rascunho",
  });
  const moto = await cadastrarVeiculo({
    marca: "Honda",
    modelo: "CG 160",
    versao: "Titan",
    anoFabricacao: 2023,
    anoModelo: 2023,
    km: 8_000,
    combustivel: "Flex",
    carroceria: "Moto",
    cor: "Vermelha",
    precoVenda: 1_890_000,
    status: "rascunho",
  });

  const { dados: noFunil } = await chamar<{ interesse: Interesse }>(
    "POST",
    "/dashboard/interests",
    { clienteId: diego.id, carroId: onix.carro.id },
  );
  await chamar("PATCH", `/dashboard/interests/${noFunil.interesse.id}`, { etapa: "proposta" });

  const { dados: lista } = await chamar<{ clientes: ClienteComDesejos[] }>(
    "GET",
    "/dashboard/wishes",
  );
  const ordem = lista.clientes.map(
    ({ cliente, possivelDesde, desejos }, indice) =>
      `  ${indice + 1}. ${cliente.nome}: ${desejos.map(({ nome }) => nome).join(", ")}${possivelDesde ? " (possível interesse)" : ""}`,
  );

  console.log(`
Teste da lista de interesses pronto (sufixo ${sufixo}).

${linha("Entrar", `${WEB}/login`)}
${linha("  e-mail", email)}
${linha("  senha", SENHA)}
${linha("Interesses", `${WEB}/dashboard/wishlist`)}
${linha("Veículos", `${WEB}/dashboard/cars`)}
${linha("Funil", `${WEB}/dashboard/funnel`)}
${linha(`Ficha de ${ana.nome}`, `${WEB}/dashboard/customers/${ana.id}`)}
${linha("Rascunho da CG 160", `${WEB}/dashboard/cars/${moto.carro.id}`)}

Lista de interesses agora:
${ordem.join("\n")}

Rascunhos para publicar durante o teste:
  Jeep Compass ${compass.carro.versao ?? ""}: combina com ${bruno.nome} e com o "SUV diesel" de ${ana.nome}
  Honda CG 160 Titan (moto): combina com ${carla.nome}
${diego.nome} já está em "Proposta" no funil do Chevrolet Onix.
`);
}

try {
  await prepararTesteInteresses();
} catch (erro) {
  console.error(mensagemDoErro(erro));
  process.exitCode = 1;
}
