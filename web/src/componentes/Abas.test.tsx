import { fireEvent, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { Abas } from "./Abas.tsx";

const ABAS = [
  { valor: null, rotulo: "Todos" },
  { valor: "Scooter", rotulo: "Scooters" },
  { valor: "Patinete", rotulo: "Patinetes" },
] as const;

type Valor = (typeof ABAS)[number]["valor"];

interface PropsExemplo {
  abas?: readonly (typeof ABAS)[number][];
  inicial?: Valor;
  aoMudar: (valor: Valor) => void;
}

function Exemplo({ abas = ABAS, inicial = null, aoMudar }: PropsExemplo) {
  const [valor, setValor] = useState<Valor>(inicial);
  return (
    <Abas
      rotulo="Tipos de veículo"
      abas={abas}
      valor={valor}
      aoMudar={(novo) => {
        setValor(novo);
        aoMudar(novo);
      }}
    >
      <p>Conteúdo de {valor ?? "todos"}</p>
      <input aria-label="Busca" />
    </Abas>
  );
}

const NA_BARRA: Partial<Record<string, [number, number]>> = {
  Todos: [16, 84],
  Scooters: [84, 171],
  Patinetes: [171, 330],
};

function medirBarra() {
  const estilo = document.createElement("style");
  estilo.textContent = '[role="tablist"] { padding-left: 16px; }';
  document.head.append(estilo);
  onTestFinished(() => estilo.remove());
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const lista = this.closest('[role="tablist"]');
    if (lista === this) return new DOMRect(20, 0, 200, 44);
    const [inicio, fim] = NA_BARRA[this.textContent ?? ""] ?? [0, 0];
    return new DOMRect(20 + inicio - (lista?.scrollLeft ?? 0), 0, fim - inicio, 44);
  });
}

function montar() {
  const aoMudar = vi.fn<(valor: Valor) => void>();
  render(<Exemplo aoMudar={aoMudar} />);
  return { aoMudar, aba: (nome: string) => screen.getByRole("tab", { name: nome }) };
}

describe("Abas", () => {
  it("liga as abas ao painel e deixa só a escolhida marcada e no Tab", async () => {
    const usuario = userEvent.setup();
    montar();

    const abas = within(screen.getByRole("tablist", { name: "Tipos de veículo" })).getAllByRole(
      "tab",
    );
    expect(abas.map((aba) => aba.textContent)).toEqual(["Todos", "Scooters", "Patinetes"]);
    expect(abas.map((aba) => aba.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    expect(abas.map((aba) => aba.tabIndex)).toEqual([0, -1, -1]);
    const painel = screen.getByRole("tabpanel", { name: "Todos" });
    expect(painel).toHaveTextContent("Conteúdo de todos");
    for (const aba of abas) expect(aba).toHaveAttribute("aria-controls", painel.id);

    await usuario.tab();
    expect(abas[0]).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole("textbox", { name: "Busca" })).toHaveFocus();
  });

  it("troca no clique e não avisa ao clicar na aba já escolhida", async () => {
    const usuario = userEvent.setup();
    const { aoMudar, aba } = montar();

    await usuario.click(aba("Todos"));
    expect(aoMudar).not.toHaveBeenCalled();

    await usuario.click(aba("Patinetes"));
    expect(aoMudar).toHaveBeenCalledExactlyOnceWith("Patinete");
    expect(aba("Patinetes")).toHaveAttribute("aria-selected", "true");
    expect(aba("Patinetes")).toHaveAttribute("tabindex", "0");
    expect(aba("Todos")).toHaveAttribute("aria-selected", "false");
    expect(aba("Todos")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel", { name: "Patinetes" })).toHaveTextContent(
      "Conteúdo de Patinete",
    );
  });

  it("anda com as setas dando a volta, vai às pontas com Home e End e ignora as outras teclas", async () => {
    const usuario = userEvent.setup();
    const { aoMudar, aba } = montar();
    await usuario.tab();

    await usuario.keyboard("{ArrowRight}");
    expect(aba("Scooters")).toHaveFocus();
    expect(aba("Scooters")).toHaveAttribute("aria-selected", "true");

    await usuario.keyboard("{ArrowRight}{ArrowRight}");
    expect(aba("Todos")).toHaveFocus();

    await usuario.keyboard("{ArrowLeft}");
    expect(aba("Patinetes")).toHaveFocus();

    await usuario.keyboard("{Home}");
    expect(aba("Todos")).toHaveFocus();

    await usuario.keyboard("{End}");
    expect(aba("Patinetes")).toHaveFocus();
    expect(aba("Patinetes")).toHaveAttribute("aria-selected", "true");
    expect(aoMudar.mock.calls).toEqual([
      ["Scooter"],
      ["Patinete"],
      [null],
      ["Patinete"],
      [null],
      ["Patinete"],
    ]);

    expect(fireEvent.keyDown(aba("Patinetes"), { key: "End" })).toBe(false);
    expect(fireEvent.keyDown(aba("Patinetes"), { key: "ArrowDown" })).toBe(true);
    expect(aoMudar).toHaveBeenCalledTimes(6);
    expect(aba("Patinetes")).toHaveFocus();
  });

  it("rola só a barra para mostrar inteira a aba escolhida, sem encostar na borda", async () => {
    medirBarra();
    const rolarPagina = vi.spyOn(Element.prototype, "scrollIntoView");
    const usuario = userEvent.setup();
    const { aba } = montar();
    const lista = screen.getByRole("tablist");
    expect(lista.scrollLeft).toBe(0);

    await usuario.click(aba("Patinetes"));
    expect(lista.scrollLeft).toBe(146);

    await usuario.keyboard("{Home}");
    expect(lista.scrollLeft).toBe(0);

    await usuario.keyboard("{End}");
    expect(lista.scrollLeft).toBe(146);

    await usuario.keyboard("{ArrowLeft}");
    expect(lista.scrollLeft).toBe(68);

    await usuario.keyboard("{ArrowRight}");
    expect(lista.scrollLeft).toBe(146);
    expect(rolarPagina).not.toHaveBeenCalled();
  });

  it("já abre com a aba escolhida à vista, como ao voltar no histórico", () => {
    medirBarra();
    render(<Exemplo inicial="Patinete" aoMudar={vi.fn()} />);

    expect(screen.getByRole("tab", { name: "Patinetes" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tablist").scrollLeft).toBe(146);
  });

  it("com uma aba só, não mostra a barra, e o conteúdo não remonta quando as abas aparecem", async () => {
    const usuario = userEvent.setup();
    const aoMudar = vi.fn<(valor: Valor) => void>();
    const { rerender } = render(<Exemplo abas={[ABAS[0]]} aoMudar={aoMudar} />);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
    expect(screen.getByText("Conteúdo de todos")).toBeInTheDocument();
    await usuario.type(screen.getByRole("textbox", { name: "Busca" }), "pcx");

    rerender(<Exemplo aoMudar={aoMudar} />);

    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("textbox", { name: "Busca" })).toHaveValue("pcx");
    expect(screen.getByRole("textbox", { name: "Busca" })).toHaveFocus();
  });
});
