import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { useEstadoDaPagina } from "./estadoDaPagina.ts";

function NoHistorico({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useEstadoDaPagina", () => {
  it("guarda o valor na entrada do histórico e o recupera quando a página volta", () => {
    const primeira = renderHook(() => useEstadoDaPagina("filtros", { marca: "" }), {
      wrapper: NoHistorico,
    });
    expect(primeira.result.current[0]).toEqual({ marca: "" });

    act(() => primeira.result.current[1]({ marca: "Jeep" }));
    primeira.unmount();

    expect(sessionStorage.getItem("globomotors:filtros:default")).toBe('{"marca":"Jeep"}');
    const segunda = renderHook(() => useEstadoDaPagina("filtros", { marca: "" }), {
      wrapper: NoHistorico,
    });
    expect(segunda.result.current[0]).toEqual({ marca: "Jeep" });
  });

  it("usa o valor inicial quando o guardado está corrompido", () => {
    sessionStorage.setItem("globomotors:busca:default", "{");

    const { result } = renderHook(() => useEstadoDaPagina("busca", "onix"), {
      wrapper: NoHistorico,
    });

    expect(result.current[0]).toBe("onix");
  });

  it("segue funcionando quando o navegador bloqueia o armazenamento", () => {
    const bloquear = () => {
      throw new DOMException("Armazenamento bloqueado", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(bloquear);
    const gravar = vi.spyOn(Storage.prototype, "setItem").mockImplementation(bloquear);

    const { result } = renderHook(() => useEstadoDaPagina("busca", ""), {
      wrapper: NoHistorico,
    });
    act(() => result.current[1]("hb20"));

    expect(result.current[0]).toBe("hb20");
    expect(gravar).toHaveBeenCalled();
  });
});
