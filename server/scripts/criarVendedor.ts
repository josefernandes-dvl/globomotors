import { parseArgs } from "node:util";
import { cadastrarVendedor, esquemaVendedor, lerSenha, mensagemDoErro } from "./vendedor.ts";

try {
  const { values } = parseArgs({
    options: {
      nome: { type: "string" },
      email: { type: "string" },
    },
  });
  const dados = esquemaVendedor.omit({ senha: true }).parse(values);
  const senha = await lerSenha(process.stdin, process.stdout);
  const vendedor = await cadastrarVendedor({ ...dados, senha });
  console.log(`Vendedor criado: ${vendedor.nome} <${vendedor.email}>`);
} catch (erro) {
  console.error(mensagemDoErro(erro));
  process.exitCode = 1;
}
