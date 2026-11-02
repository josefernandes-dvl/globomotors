import { PassThrough } from "node:stream";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { criarRepositorios } from "../src/repositorios/index.ts";
import { verificarSenha } from "../src/senhas.ts";
import { criarBancoDeTeste } from "../src/testes/bancoDeTeste.ts";
import { cadastrarVendedor, lerSenha, mensagemDoErro } from "./vendedor.ts";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;

beforeAll(async () => {
  banco = await criarBancoDeTeste();
});

afterAll(async () => {
  await banco.destruir();
});

function buscarVendedor(email: string) {
  return criarRepositorios(banco.db).usuarios.buscarPorEmail(email);
}

describe("cadastrarVendedor", () => {
  it("grava o vendedor com nome e e-mail normalizados e a senha só como hash", async () => {
    vi.stubEnv("DATABASE_URL", banco.url);

    const vendedor = await cadastrarVendedor({
      nome: "  Marcos Vendedor ",
      email: " Marcos@GloboMotors.TEST ",
      senha: "teste123",
    });

    expect(vendedor).toEqual({
      id: expect.any(String) as string,
      nome: "Marcos Vendedor",
      email: "marcos@globomotors.test",
    });
    const gravado = await buscarVendedor("marcos@globomotors.test");
    expect(gravado?.id).toBe(vendedor.id);
    expect(gravado?.senhaHash).not.toContain("teste123");
    expect(await verificarSenha("teste123", gravado?.senhaHash ?? "")).toBe(true);
  });

  it("recusa e-mail já cadastrado, mesmo com outra caixa, sem alterar o vendedor existente", async () => {
    vi.stubEnv("DATABASE_URL", banco.url);
    await cadastrarVendedor({ nome: "Ana", email: "ana@globomotors.test", senha: "teste123" });

    await expect(
      cadastrarVendedor({ nome: "Outra Ana", email: "ANA@globomotors.test", senha: "outra123" }),
    ).rejects.toThrow("Já existe um vendedor com este e-mail.");

    const gravado = await buscarVendedor("ana@globomotors.test");
    expect(gravado?.nome).toBe("Ana");
    expect(await verificarSenha("teste123", gravado?.senhaHash ?? "")).toBe(true);
  });

  it.each([
    [
      "sem nenhum dado",
      {},
      "✖ Informe o nome (--nome).\n  → at nome\n✖ Informe o e-mail (--email).\n  → at email\n✖ Informe a senha.\n  → at senha",
    ],
    [
      "com nome em branco, e-mail inválido e senha curta",
      { nome: "   ", email: "vendedor.globomotors", senha: "1234567" },
      "✖ Informe o nome (--nome).\n  → at nome\n✖ E-mail inválido.\n  → at email\n✖ A senha precisa de pelo menos 8 caracteres.\n  → at senha",
    ],
    [
      "com nome e senha longos demais",
      { nome: "A".repeat(101), email: "longo@globomotors.test", senha: "s".repeat(201) },
      "✖ Nome longo demais.\n  → at nome\n✖ Senha longa demais.\n  → at senha",
    ],
  ])("valida os dados %s antes de conectar ao banco", async (_caso, dados, mensagem) => {
    vi.stubEnv("DATABASE_URL", "postgres://globomotors:globomotors@127.0.0.1:1/inexistente");

    const erro: unknown = await cadastrarVendedor(dados).catch((motivo: unknown) => motivo);

    expect(erro).toBeInstanceOf(z.ZodError);
    expect(mensagemDoErro(erro)).toBe(mensagem);
  });
});

describe("lerSenha", () => {
  function capturarSaida() {
    const saida = new PassThrough();
    let texto = "";
    saida.on("data", (pedaco) => (texto += String(pedaco)));
    return { saida, texto: () => texto };
  }

  function entradaDeTerminal() {
    const setRawMode = vi.fn();
    return { entrada: Object.assign(new PassThrough(), { isTTY: true, setRawMode }), setRawMode };
  }

  it("lê a senha e a confirmação da entrada redirecionada sem escrevê-las na saída", async () => {
    const { saida, texto } = capturarSaida();
    const entrada = new PassThrough();
    entrada.end("teste123\r\nteste123\r\n");

    await expect(lerSenha(entrada, saida)).resolves.toBe("teste123");
    expect(texto()).toBe("Senha: \nRepita a senha: \n");
  });

  it("no terminal, desliga o eco enquanto a senha é digitada e o religa no fim", async () => {
    const { saida, texto } = capturarSaida();
    const { entrada, setRawMode } = entradaDeTerminal();

    const senha = lerSenha(entrada, saida);
    entrada.write("teste1234\x7f\r");
    entrada.write("teste123\r");

    await expect(senha).resolves.toBe("teste123");
    expect(setRawMode.mock.calls).toEqual([[true], [false]]);
    expect(texto()).toBe("Senha: \nRepita a senha: \n");
  });

  it("no terminal, desiste com Ctrl+C e religa o eco", async () => {
    const { entrada, setRawMode } = entradaDeTerminal();

    const senha = lerSenha(entrada, new PassThrough());
    entrada.write("test\x03");

    await expect(senha).rejects.toThrow("Informe a senha.");
    expect(setRawMode.mock.calls).toEqual([[true], [false]]);
  });

  it.each([
    ["as senhas não conferem", "teste123\nteste124\n", "As senhas não conferem."],
    ["a entrada acaba antes da confirmação", "teste123\n", "Informe a senha."],
    ["a entrada vem vazia", "", "Informe a senha."],
  ])("recusa quando %s", async (_caso, texto, mensagem) => {
    const entrada = new PassThrough();
    entrada.end(texto);

    await expect(lerSenha(entrada, new PassThrough())).rejects.toThrow(mensagem);
  });
});

describe("mensagemDoErro", () => {
  it("mostra a mensagem do erro ou o próprio valor lançado", () => {
    expect(mensagemDoErro(new Error("Sem conexão com o banco."))).toBe("Sem conexão com o banco.");
    expect(mensagemDoErro("falhou")).toBe("falhou");
  });
});
