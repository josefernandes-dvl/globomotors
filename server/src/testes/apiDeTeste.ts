import { randomInt, randomUUID } from "node:crypto";
import { calcularDigitoRenavam } from "@globomotors/shared";
import { criarApp } from "../app.ts";
import type { Ia } from "../ia.ts";
import { criarLogger } from "../logger.ts";
import { criarRepositorios } from "../repositorios/index.ts";
import { gerarHashSenha } from "../senhas.ts";
import { criarBancoDeTeste } from "./bancoDeTeste.ts";
import { iniciarServidorDeTeste } from "./servidorDeTeste.ts";

interface OpcoesRequisicao {
  corpo?: unknown;
  cookie?: string | undefined;
  tipo?: string;
}

export const SENHA_DE_TESTE = "teste123";

export async function prepararApiDeTeste({ ia }: { ia?: Ia } = {}) {
  const banco = await criarBancoDeTeste();
  const repositorios = criarRepositorios(banco.db);
  const logger = criarLogger({ NODE_ENV: "test" });
  const servidor = await iniciarServidorDeTeste(criarApp({ repositorios, logger, ia: ia ?? null }));

  async function enviar(metodo: string, caminho: string, opcoes: OpcoesRequisicao = {}) {
    const { corpo, cookie, tipo } = opcoes;
    const binario = corpo instanceof Uint8Array;
    const headers = new Headers();
    if (cookie) headers.set("cookie", cookie);
    if (corpo !== undefined) headers.set("content-type", tipo ?? "application/json");
    return fetch(`${servidor.url}/api${caminho}`, {
      method: metodo,
      headers,
      body: binario ? corpo : corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  }

  async function requisitar<T = unknown>(
    metodo: string,
    caminho: string,
    opcoes?: OpcoesRequisicao,
  ) {
    const resposta = await enviar(metodo, caminho, opcoes);
    const texto = await resposta.text();
    return {
      status: resposta.status,
      headers: resposta.headers,
      texto,
      corpo: (texto ? JSON.parse(texto) : undefined) as T,
    };
  }

  async function baixar(caminho: string, cookie?: string) {
    const resposta = await enviar("GET", caminho, { cookie });
    return {
      status: resposta.status,
      headers: resposta.headers,
      dados: Buffer.from(await resposta.arrayBuffer()),
    };
  }

  async function criarVendedor() {
    const email = `vendedor-${randomUUID().slice(0, 6)}@teste.com`;
    const senhaHash = await gerarHashSenha(SENHA_DE_TESTE);
    const usuario = await repositorios.usuarios.criar({
      nome: "Vendedor de Teste",
      email,
      senhaHash,
    });
    return { ...usuario, senha: SENHA_DE_TESTE };
  }

  async function entrar() {
    const { email, senha } = await criarVendedor();
    const resposta = await enviar("POST", "/auth/login", { corpo: { email, senha } });
    const cookie = resposta.headers.getSetCookie()[0]?.split(";")[0];
    if (!cookie) throw new Error(`Login de teste falhou com status ${resposta.status}.`);
    return cookie;
  }

  async function encerrar() {
    await servidor.fechar();
    await banco.destruir();
  }

  return {
    banco,
    repositorios,
    logger,
    url: servidor.url,
    requisitar,
    baixar,
    criarVendedor,
    entrar,
    encerrar,
  };
}

export type ApiDeTeste = Awaited<ReturnType<typeof prepararApiDeTeste>>;

export function fotoDeTeste(tipo: "jpeg" | "png" | "webp", conteudo = randomUUID()) {
  const cabecalhos = {
    jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    webp: Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]),
  };
  return Buffer.concat([cabecalhos[tipo], Buffer.from(conteudo)]);
}

const LETRAS = "ABCDEFGHJKLMNPRSTUVWXYZ";
const DIGITOS = "0123456789";

function sortear(caracteres: string, tamanho: number) {
  return Array.from({ length: tamanho }, () =>
    caracteres.charAt(randomInt(caracteres.length)),
  ).join("");
}

export function documentosDeTeste() {
  const baseRenavam = sortear(DIGITOS, 10);
  return {
    placa: `${sortear(LETRAS, 3)}${sortear(DIGITOS, 1)}${sortear(LETRAS, 1)}${sortear(DIGITOS, 2)}`,
    chassi: `9BW${sortear(LETRAS + DIGITOS, 14)}`,
    renavam: `${baseRenavam}${calcularDigitoRenavam(baseRenavam)}`,
  };
}

export function carroDeTeste(extra: Record<string, unknown> = {}) {
  return {
    marca: "Chevrolet",
    modelo: "Onix",
    versao: "1.0 Turbo LT",
    anoFabricacao: 2022,
    anoModelo: 2023,
    km: 32_000,
    cambio: "Automático",
    combustivel: "Flex",
    carroceria: "Hatch",
    cores: ["Prata"],
    motor: "1.0 Turbo",
    portas: 4,
    opcionais: ["Ar-condicionado", "Câmera de ré"],
    descricao: "Único dono, revisões em dia.",
    precoVenda: 8_990_000,
    destaque: false,
    status: "disponivel",
    precoCompra: 7_650_000,
    custoPreparacao: 120_000,
    custoDocumentacao: 45_000,
    custoComissao: 90_000,
    precoMinimo: 8_600_000,
    dataEntrada: "2026-10-01",
    ...documentosDeTeste(),
    origem: "Troca na loja",
    vendedorNome: "Auto Lima Multimarcas",
    vendedorTelefone: "11987654321",
    observacoesInternas: "Pneu dianteiro com desgaste.",
    ...extra,
  };
}

export function clienteDeTeste(extra: Record<string, unknown> = {}) {
  return {
    nome: "Maria Souza",
    telefone: `629${sortear(DIGITOS, 8)}`,
    email: `maria-${randomUUID().slice(0, 6)}@teste.com`,
    origem: "instagram",
    observacoes: "Prefere contato à tarde.",
    ...extra,
  };
}
