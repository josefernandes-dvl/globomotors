import { describe, expect, it } from "vitest";
import { gerarSlug } from "./slug.ts";

describe("gerarSlug", () => {
  it("junta as partes em minúsculas, com hífen e sufixo aleatório", () => {
    expect(gerarSlug(["Chevrolet", "Onix", "1.0 Turbo LT", 2022])).toMatch(
      /^chevrolet-onix-1-0-turbo-lt-2022-[0-9a-f]{6}$/,
    );
  });

  it("remove acentos e ignora partes nulas", () => {
    expect(gerarSlug(["Citroën", "C4 Cactus", null, 2021])).toMatch(
      /^citroen-c4-cactus-2021-[0-9a-f]{6}$/,
    );
  });

  it("usa 'carro' quando não sobra nenhum caractere", () => {
    expect(gerarSlug(["***", null])).toMatch(/^carro-[0-9a-f]{6}$/);
  });

  it("corta textos longos sem deixar hífen sobrando", () => {
    const slug = gerarSlug(["Volkswagen", "a".repeat(49), "versão longa"]);
    expect(slug).toMatch(/^volkswagen-a{49}-[0-9a-f]{6}$/);
  });

  it("gera slugs diferentes para o mesmo carro", () => {
    expect(gerarSlug(["Fiat", "Uno"])).not.toBe(gerarSlug(["Fiat", "Uno"]));
  });
});
