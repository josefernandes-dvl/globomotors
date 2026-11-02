import { describe, expect, it } from "vitest";
import { carroPainel, carroPublico } from "../testes/dados.ts";
import {
  fichaDoCarro,
  linkDoCarro,
  linkWhatsApp,
  mensagemDeInteresse,
} from "./compartilhamento.ts";

describe("linkWhatsApp", () => {
  it("põe o código do Brasil no número com DDD e codifica a mensagem", () => {
    expect(linkWhatsApp("(11) 98765-4321", "Olá! Tudo bem?")).toBe(
      "https://wa.me/5511987654321?text=Ol%C3%A1!%20Tudo%20bem%3F",
    );
  });

  it("mantém o número que já tem código do país e dispensa texto vazio", () => {
    expect(linkWhatsApp("5511987654321")).toBe("https://wa.me/5511987654321");
  });
});

describe("linkDoCarro", () => {
  it("monta o link público do carro na origem informada", () => {
    expect(linkDoCarro("onix-2021", "https://loja.com.br")).toBe(
      "https://loja.com.br/catalogo/onix-2021",
    );
  });

  it("usa a origem da página quando nenhuma é informada", () => {
    expect(linkDoCarro("onix-2021")).toBe(`${window.location.origin}/catalogo/onix-2021`);
  });
});

describe("mensagemDeInteresse", () => {
  it("cita o carro, os anos, a cor e o link, sem falar de preço", () => {
    const mensagem = mensagemDeInteresse(carroPublico(), "https://loja.com.br/catalogo/onix");

    expect(mensagem).toBe(
      "Olá! Tenho interesse no Chevrolet Onix 1.0 Turbo LTZ 2020/2021, cor Prata. Ainda está disponível?\nhttps://loja.com.br/catalogo/onix",
    );
    expect(mensagem).not.toMatch(/R\$|anunciado|89\.900/);
  });

  it("omite a versão, os anos e a cor que o carro não informou", () => {
    expect(
      mensagemDeInteresse(
        carroPublico({ versao: null, anoFabricacao: null, anoModelo: null, cor: null }),
        "https://loja.com.br/catalogo/onix",
      ),
    ).toBe(
      "Olá! Tenho interesse no Chevrolet Onix. Ainda está disponível?\nhttps://loja.com.br/catalogo/onix",
    );
  });
});

describe("fichaDoCarro", () => {
  const loja = { nome: "Globo Motors", whatsapp: "11987654321" };

  it("monta a ficha para WhatsApp só com dados públicos", () => {
    const ficha = fichaDoCarro(carroPainel(), loja, "https://loja.com.br/catalogo/onix");

    expect(ficha).toBe(
      [
        "🚗 *Chevrolet Onix 1.0 Turbo LTZ*",
        "📅 2020/2021  ·  🛣️ 42.000 km",
        "⚙️ Automático  ·  ⛽ Flex  ·  🎨 Prata",
        "🔧 Motor 1.0 Turbo",
        "💰 *R$\u00a089.900*",
        "✅ Ar-condicionado, Multimídia",
        "",
        "Único dono, revisões na concessionária.",
        "",
        "🔗 https://loja.com.br/catalogo/onix",
        "",
        "Globo Motors · WhatsApp (11) 98765-4321",
      ].join("\n"),
    );
    for (const privado of [
      "ABC1D23",
      "9BGKS48U0LG123456",
      "75.000",
      "Pneus novos",
      "Troca",
      "Auto Lima",
      "62988887777",
      "98888-7777",
    ]) {
      expect(ficha).not.toContain(privado);
    }
  });

  it("omite linhas vazias, o link de carro não publicado e o WhatsApp ausente", () => {
    const carro = carroPainel({
      versao: null,
      anoFabricacao: null,
      anoModelo: null,
      km: null,
      cambio: null,
      combustivel: null,
      cor: null,
      motor: null,
      opcionais: [],
      descricao: null,
      precoVenda: null,
    });

    expect(fichaDoCarro(carro, { nome: "Globo Motors", whatsapp: null }, null)).toBe(
      ["🚗 *Chevrolet Onix*", "💰 *Consulte*", "", "Globo Motors"].join("\n"),
    );
  });
});
