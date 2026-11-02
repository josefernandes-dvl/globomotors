import { afterEach, describe, expect, it, vi } from "vitest";
import { dataEmSaoPaulo, diasEntre, hojeEmSaoPaulo } from "./datas.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("dataEmSaoPaulo", () => {
  it("usa o dia de São Paulo, três horas atrás do UTC", () => {
    expect(dataEmSaoPaulo(new Date("2026-10-31T02:59:59Z"))).toBe("2026-10-30");
    expect(dataEmSaoPaulo(new Date("2026-10-31T03:00:00Z"))).toBe("2026-10-31");
  });
});

describe("hojeEmSaoPaulo", () => {
  it("devolve a data de hoje em São Paulo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T01:30:00Z"));
    expect(hojeEmSaoPaulo()).toBe("2026-10-31");
  });
});

describe("diasEntre", () => {
  it("conta os dias entre duas datas", () => {
    expect(diasEntre("2026-10-01", "2026-10-30")).toBe(29);
    expect(diasEntre("2026-10-30", "2026-10-30")).toBe(0);
    expect(diasEntre("2025-12-31", "2026-03-01")).toBe(60);
  });
});
