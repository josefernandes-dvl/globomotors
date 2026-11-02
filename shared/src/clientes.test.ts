import { describe, expect, it } from "vitest";
import { esquemaCliente, esquemaEtapaInteresse, esquemaNovoInteresse } from "./clientes.ts";

function erros(dados: unknown) {
  const resultado = esquemaCliente.safeParse(dados);
  if (resultado.success) return {};
  return Object.fromEntries(resultado.error.issues.map((i) => [i.path.join("."), i.message]));
}

const TELEFONE_INVALIDO = "Telefone inválido: informe DDD e número, como (62) 99999-0000.";

describe("esquemaCliente", () => {
  it("aceita nome e telefone e preenche o resto com null", () => {
    expect(esquemaCliente.parse({ nome: " Ana Souza ", telefone: "(62) 99999-0000" })).toEqual({
      nome: "Ana Souza",
      telefone: "62999990000",
      email: null,
      origem: null,
      observacoes: null,
    });
  });

  it.each([
    ["+55 (62) 99999-0000", "62999990000"],
    ["55 62 3333-4444", "6233334444"],
    ["(55) 99999-0000", "55999990000"],
  ])("guarda o telefone %s só com DDD e número", (telefone, esperado) => {
    expect(esquemaCliente.parse({ nome: "Ana", telefone }).telefone).toBe(esperado);
  });

  it.each(["(01) 99999-0000", "62 9999-000", "62 1333-4444", "abc"])(
    "recusa o telefone %s",
    (telefone) => {
      expect(erros({ nome: "Ana", telefone })).toEqual({ telefone: TELEFONE_INVALIDO });
    },
  );

  it("exige nome e telefone", () => {
    expect(erros({ telefone: "" })).toEqual({
      nome: "Informe o nome.",
      telefone: "Informe o telefone.",
    });
  });

  it("guarda o e-mail em minúsculas e aceita e-mail vazio", () => {
    expect(
      esquemaCliente.parse({ nome: "Ana", telefone: "62999990000", email: " ANA@Email.COM " })
        .email,
    ).toBe("ana@email.com");
    expect(esquemaCliente.parse({ nome: "Ana", telefone: "62999990000", email: "" }).email).toBe(
      null,
    );
  });

  it("recusa e-mail inválido e origem desconhecida", () => {
    expect(erros({ nome: "Ana", telefone: "62999990000", email: "ana@", origem: "tv" })).toEqual({
      email: "E-mail inválido.",
      origem: "Origem inválida.",
    });
  });
});

describe("esquemaNovoInteresse", () => {
  it("exige ids de cliente e de carro", () => {
    const resultado = esquemaNovoInteresse.safeParse({ clienteId: "1", carroId: "" });
    expect(resultado.error?.issues.map((i) => i.message)).toEqual([
      "Escolha um cliente.",
      "Escolha um carro.",
    ]);
  });
});

describe("esquemaEtapaInteresse", () => {
  it("exige o motivo quando o interesse é perdido", () => {
    expect(esquemaEtapaInteresse.safeParse({ etapa: "perdido" }).error?.issues).toMatchObject([
      { path: ["motivoPerda"], message: "Informe o motivo da perda." },
    ]);
    expect(esquemaEtapaInteresse.parse({ etapa: "perdido", motivoPerda: " Achou caro " })).toEqual({
      etapa: "perdido",
      motivoPerda: "Achou caro",
    });
  });

  it("descarta o motivo nas outras etapas", () => {
    expect(esquemaEtapaInteresse.parse({ etapa: "proposta", motivoPerda: "x" })).toEqual({
      etapa: "proposta",
      motivoPerda: null,
    });
  });

  it("recusa etapa desconhecida", () => {
    expect(esquemaEtapaInteresse.safeParse({ etapa: "fechado" }).error?.issues[0]?.message).toBe(
      "Etapa inválida.",
    );
  });
});
