import { describe, expect, it } from "vitest";
import { LOJA_PADRAO, esquemaLoja } from "./loja.ts";

const basica = { nome: "Globo Motors", mostrarPreco: true, mostrarVendidos: false };

describe("esquemaLoja", () => {
  it("aceita a configuração padrão", () => {
    expect(esquemaLoja.parse(LOJA_PADRAO)).toEqual(LOJA_PADRAO);
  });

  it.each(["@globo.motors", "globo.motors", "https://www.instagram.com/globo.motors/"])(
    "guarda o Instagram %s só com o perfil",
    (instagram) => {
      expect(esquemaLoja.parse({ ...basica, instagram }).instagram).toBe("globo.motors");
    },
  );

  it("normaliza o WhatsApp e aceita WhatsApp vazio", () => {
    expect(esquemaLoja.parse({ ...basica, whatsapp: "+55 62 99999-0000" }).whatsapp).toBe(
      "62999990000",
    );
    expect(esquemaLoja.parse({ ...basica, whatsapp: " " }).whatsapp).toBeNull();
  });

  it("aponta os campos inválidos", () => {
    const resultado = esquemaLoja.safeParse({ nome: "", instagram: "globo motors", whatsapp: "1" });
    expect(
      Object.fromEntries(resultado.error?.issues.map((i) => [i.path.join("."), i.message]) ?? []),
    ).toEqual({
      nome: "Informe o nome da loja.",
      whatsapp: "Telefone inválido: informe DDD e número, como (62) 99999-0000.",
      instagram: "Instagram inválido: informe o @ do perfil.",
      mostrarPreco: "Valor inválido.",
      mostrarVendidos: "Valor inválido.",
    });
  });
});
