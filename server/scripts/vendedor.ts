import { createInterface } from "node:readline";
import { esquemaEntrar } from "@globomotors/shared";
import { z } from "zod";
import { lerConfig } from "../src/config.ts";
import { criarBanco } from "../src/db/banco.ts";
import { migrar } from "../src/db/migrar.ts";
import { criarRepositorios } from "../src/repositorios/index.ts";
import { gerarHashSenha } from "../src/senhas.ts";

export const esquemaVendedor = z.object({
  nome: z
    .string({ error: "Informe o nome (--nome)." })
    .trim()
    .min(1, "Informe o nome (--nome).")
    .max(100, "Nome longo demais."),
  email: z.string({ error: "Informe o e-mail (--email)." }).pipe(esquemaEntrar.shape.email),
  senha: z
    .string({ error: "Informe a senha." })
    .min(8, "A senha precisa de pelo menos 8 caracteres.")
    .max(200, "Senha longa demais."),
});

export async function cadastrarVendedor(dados: unknown) {
  const { nome, email, senha } = esquemaVendedor.parse(dados);
  const { db, pool } = criarBanco(lerConfig(process.env).DATABASE_URL);
  try {
    await migrar(db);
    const senhaHash = await gerarHashSenha(senha);
    return await criarRepositorios(db).usuarios.criar({ nome, email, senhaHash });
  } finally {
    await pool.end();
  }
}

export async function lerSenha(
  entrada: NodeJS.ReadableStream & { isTTY?: boolean },
  saida: NodeJS.WritableStream,
) {
  const leitor = createInterface({ input: entrada, terminal: Boolean(entrada.isTTY) });
  const linhas = leitor[Symbol.asyncIterator]();
  async function perguntar(pergunta: string) {
    saida.write(pergunta);
    const { value, done } = await linhas.next();
    saida.write("\n");
    if (done) throw new Error("Informe a senha.");
    return value;
  }
  try {
    const senha = await perguntar("Senha: ");
    if (senha !== (await perguntar("Repita a senha: "))) throw new Error("As senhas não conferem.");
    return senha;
  } finally {
    leitor.close();
  }
}

export function mensagemDoErro(erro: unknown) {
  if (erro instanceof z.ZodError) return z.prettifyError(erro);
  return erro instanceof Error ? erro.message : String(erro);
}
