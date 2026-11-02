import { describe, expect, it } from "vitest";
import { ErroHttp } from "../erros.ts";
import { escaparLike, primeiro, traduzirRestricoes } from "./utilitarios.ts";

function erroDoDrizzle(code: string, constraint: string) {
  return new Error("Failed query", { cause: Object.assign(new Error("pg"), { code, constraint }) });
}

const traduzir = traduzirRestricoes({
  carros_placa_unique: { campo: "placa", mensagem: "Placa repetida." },
  interesses_unique: { mensagem: "Interesse repetido." },
  interesses_carro_fk: { mensagem: "Carro não encontrado." },
});

function capturar(erro: unknown) {
  try {
    traduzir(erro);
  } catch (lancado) {
    return lancado;
  }
  throw new Error("traduzir não lançou");
}

describe("traduzirRestricoes", () => {
  it("transforma violação de unique em 409 com o campo", () => {
    const erro = capturar(erroDoDrizzle("23505", "carros_placa_unique"));
    expect(erro).toBeInstanceOf(ErroHttp);
    expect(erro).toMatchObject({
      status: 409,
      codigo: "conflito",
      message: "Placa repetida.",
      campos: [{ campo: "placa", mensagem: "Placa repetida." }],
    });
  });

  it("transforma unique sem campo em 409 sem campos", () => {
    expect(capturar(erroDoDrizzle("23505", "interesses_unique"))).toMatchObject({
      status: 409,
      campos: undefined,
    });
  });

  it("transforma violação de chave estrangeira em 404", () => {
    expect(capturar(erroDoDrizzle("23503", "interesses_carro_fk"))).toMatchObject({
      status: 404,
      codigo: "nao_encontrado",
      message: "Carro não encontrado.",
    });
  });

  it("lê o erro do pg mesmo sem o embrulho do Drizzle", () => {
    const erro = Object.assign(new Error("pg"), {
      code: "23505",
      constraint: "carros_placa_unique",
    });
    expect(capturar(erro)).toMatchObject({ status: 409 });
  });

  it.each([
    ["restrição desconhecida", erroDoDrizzle("23505", "outra_unique")],
    ["código diferente", erroDoDrizzle("23502", "carros_placa_unique")],
    ["erro sem detalhes", new Error("conexão caiu")],
    ["valor que não é erro", "falhou"],
  ])("relança o erro original com %s", (_caso, original) => {
    expect(capturar(original)).toBe(original);
  });
});

describe("primeiro", () => {
  it("devolve a primeira linha", () => {
    expect(primeiro([{ id: 1 }, { id: 2 }])).toEqual({ id: 1 });
  });

  it("lança erro se não há linha", () => {
    expect(() => primeiro([])).toThrow("A consulta não devolveu nenhuma linha.");
  });
});

describe("escaparLike", () => {
  it("escapa os curingas do LIKE e a barra invertida", () => {
    expect(escaparLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });

  it("mantém texto comum", () => {
    expect(escaparLike("João")).toBe("João");
  });
});
