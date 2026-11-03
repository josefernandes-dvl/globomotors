import { parseArgs } from "node:util";
import { lerConfig } from "../src/config.ts";
import { criarBanco } from "../src/db/banco.ts";
import { migrar } from "../src/db/migrar.ts";
import { criarRepositorios } from "../src/repositorios/index.ts";
import { gerarHashSenha } from "../src/senhas.ts";
import { esquemaVendedor, lerSenha, mensagemDoErro } from "./vendedor.ts";

const SERVIDORES_LOCAIS = ["localhost", "127.0.0.1", "[::1]"];

try {
  const { values } = parseArgs({
    options: {
      nome: { type: "string" },
      email: { type: "string" },
    },
  });
  const dados = esquemaVendedor.omit({ senha: true }).parse(values);
  const url = lerConfig(process.env).DATABASE_URL;
  const servidor = new URL(url).hostname;
  if (!SERVIDORES_LOCAIS.includes(servidor)) {
    throw new Error(
      `Este script apaga todos os dados e só roda no banco local, mas o DATABASE_URL aponta para ${servidor}.`,
    );
  }
  const { nome, email, senha } = esquemaVendedor.parse({
    ...dados,
    senha: await lerSenha(process.stdin, process.stdout),
  });
  const { db, pool } = criarBanco(url);
  try {
    await migrar(db);
    const vendedor = await criarRepositorios(db).sistema.zerar({
      nome,
      email,
      senhaHash: await gerarHashSenha(senha),
    });
    console.log(
      `Banco zerado: ficou só o vendedor ${vendedor.nome} <${vendedor.email}>, e a configuração da loja foi mantida.`,
    );
  } finally {
    await pool.end();
  }
} catch (erro) {
  console.error(mensagemDoErro(erro));
  process.exitCode = 1;
}
