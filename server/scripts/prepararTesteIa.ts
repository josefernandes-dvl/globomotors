import { randomUUID } from "node:crypto";
import type { CarroExtraido } from "@globomotors/shared";
import { cadastrarVendedor, mensagemDoErro } from "./vendedor.ts";

const API = `http://localhost:${process.env.PORT ?? "3001"}/api`;
const WEB = "http://localhost:5173";
const SENHA = "teste123";
const sufixo = randomUUID().slice(0, 6);

const ANUNCIO = [
  "Chevrolet Onix LTZ 1.0 Turbo 2020/2021, prata, 42.000 km, câmbio automático, flex, 4 portas.",
  "Ar-condicionado, multimídia com Android Auto, câmera de ré e sensor de estacionamento.",
  "Único dono, revisões na concessionária. R$ 89.900.",
].join("\n");

const OFERTA = [
  "Bom dia! Aqui é o Carlos, da Auto Lima Multimarcas: (62) 98888-7777.",
  "Tenho um Hyundai HB20S 1.6 Comfort Plus 2019/2019, branco, 61 mil km, manual, placa ABC1D23.",
  "Peço R$ 62.000. Veio de troca, tem um arranhão no para-choque traseiro e o IPVA 2026 está pendente.",
].join("\n");

const ATUALIZACAO =
  "O Onix agora está com 51.000 km, ganhou teto solar e o preço passou para R$ 92.500,50.";

const COMO_LIGAR = `Para ligar a leitura com IA (plano gratuito do Gemini):
  1. crie uma chave em https://aistudio.google.com/apikey
  2. acrescente ao server/.env a linha AI_API_KEY=<a chave>
  3. reinicie a API e rode este script de novo`;

async function requisitar(caminho: string, opcoes: RequestInit) {
  return fetch(`${API}${caminho}`, opcoes).catch((erro: unknown) => {
    throw new Error(`A API não respondeu em ${API}. Suba-a com npm run dev na raiz.`, {
      cause: erro,
    });
  });
}

async function enviarJson<T>(caminho: string, corpo: unknown, cookie = "") {
  const resposta = await requisitar(caminho, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!resposta.ok) {
    throw new Error(`POST /api${caminho} respondeu ${resposta.status}: ${await resposta.text()}`);
  }
  return { resposta, dados: (await resposta.json()) as T };
}

async function lerComIa(texto: string, cookie: string) {
  const formulario = new FormData();
  formulario.set("texto", texto);
  const resposta = await requisitar("/dashboard/ai/extract-car", {
    method: "POST",
    headers: { cookie },
    body: formulario,
  });
  const { carro, erro } = (await resposta.json()) as {
    carro?: CarroExtraido;
    erro?: { mensagem: string };
  };
  if (carro) {
    return `✓ A IA leu ${Object.keys(carro).length} campos do anúncio:\n${JSON.stringify(carro, null, 2)}`;
  }
  const aviso = `! A leitura com IA respondeu ${resposta.status}: ${erro?.mensagem ?? "sem mensagem"}`;
  return resposta.status === 503 ? `${aviso}\n${COMO_LIGAR}` : aviso;
}

async function prepararTesteIa() {
  const email = `ia.${sufixo}@globomotors.test`;
  await cadastrarVendedor({ nome: `Vendedor IA ${sufixo}`, email, senha: SENHA });
  const { resposta: login } = await enviarJson("/auth/login", { email, senha: SENHA });
  const cookie = login.headers.getSetCookie()[0]?.split(";")[0] ?? "";
  const { dados } = await enviarJson<{ carro: { id: string } }>(
    "/dashboard/cars",
    {
      marca: "Chevrolet",
      modelo: "Onix",
      versao: "LTZ 1.0 Turbo",
      opcionais: ["Ar-condicionado", "Multimídia"],
      status: "rascunho",
    },
    cookie,
  );
  const leitura = await lerComIa(ANUNCIO, cookie);

  console.log(`
Teste da leitura com IA pronto (sufixo ${sufixo}).

${leitura}

Entrar              ${WEB}/login
  e-mail            ${email}
  senha             ${SENHA}
Novo veículo        ${WEB}/dashboard/cars/new
Rascunho para editar ${WEB}/dashboard/cars/${dados.carro.id}

Texto 1, anúncio (no novo carro):
${ANUNCIO}

Texto 2, oferta de quem vende o carro para a loja (no novo carro):
${OFERTA}

Texto 3, atualização (no rascunho):
${ATUALIZACAO}

Imagens: fotos do veículo, do painel ou do documento, em JPG, PNG ou WebP, até 4 por leitura.
`);
}

try {
  await prepararTesteIa();
} catch (erro) {
  console.error(mensagemDoErro(erro));
  process.exitCode = 1;
}
