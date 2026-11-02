import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const CUSTO = 16384;
const BLOCO = 8;
const PARALELISMO = 1;
const TAMANHO_CHAVE = 64;

function derivarChave(senha: string, sal: Buffer, custo: number, bloco: number, paralelo: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(senha, sal, TAMANHO_CHAVE, { N: custo, r: bloco, p: paralelo }, (erro, chave) => {
      if (erro) reject(erro);
      else resolve(chave);
    });
  });
}

export async function gerarHashSenha(senha: string) {
  const sal = randomBytes(16);
  const chave = await derivarChave(senha, sal, CUSTO, BLOCO, PARALELISMO);
  return [
    "scrypt",
    CUSTO,
    BLOCO,
    PARALELISMO,
    sal.toString("base64"),
    chave.toString("base64"),
  ].join("$");
}

export async function verificarSenha(senha: string, hash: string) {
  const [algoritmo, custo, bloco, paralelo, sal, chave] = hash.split("$");
  if (algoritmo !== "scrypt" || !custo || !bloco || !paralelo || !sal || !chave) return false;
  const esperada = Buffer.from(chave, "base64");
  const calculada = await derivarChave(
    senha,
    Buffer.from(sal, "base64"),
    Number(custo),
    Number(bloco),
    Number(paralelo),
  ).catch(() => null);
  return calculada?.length === esperada.length && timingSafeEqual(calculada, esperada);
}
