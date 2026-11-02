import { describe, expect, it } from "vitest";
import { esquemaEntrar } from "./auth.ts";

describe("esquemaEntrar", () => {
  it("normaliza o e-mail e mantém a senha como veio", () => {
    expect(
      esquemaEntrar.parse({ email: " Vendedor@GloboMotors.com ", senha: " teste123 " }),
    ).toEqual({ email: "vendedor@globomotors.com", senha: " teste123 " });
  });

  it("exige e-mail válido e senha", () => {
    expect(
      esquemaEntrar.safeParse({ email: "", senha: "" }).error?.issues.map((i) => i.message),
    ).toEqual(["Informe o e-mail.", "Informe a senha."]);
    expect(
      esquemaEntrar.safeParse({ email: "vendedor", senha: "x" }).error?.issues[0]?.message,
    ).toBe("E-mail inválido.");
  });

  it("recusa senha longa demais", () => {
    expect(esquemaEntrar.safeParse({ email: "a@b.com", senha: "x".repeat(201) }).success).toBe(
      false,
    );
  });
});
