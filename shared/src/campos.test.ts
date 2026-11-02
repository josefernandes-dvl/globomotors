import { describe, expect, it } from "vitest";
import { digitosDoTelefone } from "./campos.ts";

describe("digitosDoTelefone", () => {
  it.each([
    ["(62) 99999-0000", "62999990000"],
    ["+55 (62) 99999-0000", "62999990000"],
    ["55 62 3222-1111", "6232221111"],
    ["(55) 99999-0000", "55999990000"],
    ["+55 55 99999-0000", "55999990000"],
    ["9999", "9999"],
    ["sem número", ""],
  ])("transforma %s em %s", (texto, esperado) => {
    expect(digitosDoTelefone(texto)).toBe(esperado);
  });
});
