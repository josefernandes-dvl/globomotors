import { fireEvent, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Selecao } from "./Selecao.tsx";

const OPCOES = [
  { valor: "hatch", rotulo: "Hatch" },
  { valor: "seda", rotulo: "Sedã" },
  { valor: "suv", rotulo: "SUV" },
] as const;

type Carroceria = (typeof OPCOES)[number]["valor"];

interface PropsExemplo {
  aoMudar: (valor: Carroceria) => void;
  desabilitado: boolean;
}

function Exemplo({ aoMudar, desabilitado }: PropsExemplo) {
  const [valor, setValor] = useState<Carroceria>("seda");
  return (
    <>
      <Selecao
        rotulo="Carroceria"
        valor={valor}
        opcoes={OPCOES}
        desabilitado={desabilitado}
        aoMudar={(novo) => {
          setValor(novo);
          aoMudar(novo);
        }}
      />
      <button type="button">Fora</button>
    </>
  );
}

function montar(desabilitado = false) {
  const aoMudar = vi.fn<(valor: Carroceria) => void>();
  render(<Exemplo aoMudar={aoMudar} desabilitado={desabilitado} />);
  return { aoMudar, campo: screen.getByRole("combobox", { name: "Carroceria" }) };
}

function opcaoAtiva(campo: HTMLElement) {
  const id = campo.getAttribute("aria-activedescendant");
  return id === null ? null : document.getElementById(id)?.textContent;
}

describe("Selecao", () => {
  it("mostra a opção escolhida e abre a lista com ela marcada", async () => {
    const usuario = userEvent.setup();
    const { campo } = montar();
    expect(campo).toHaveTextContent("Sedã");
    expect(campo).toHaveAttribute("aria-expanded", "false");
    expect(campo).not.toHaveAttribute("aria-activedescendant");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await usuario.click(campo);

    const lista = screen.getByRole("listbox", { name: "Carroceria" });
    expect(campo).toHaveAttribute("aria-expanded", "true");
    expect(campo).toHaveAttribute("aria-controls", lista.id);
    expect(
      within(lista)
        .getAllByRole("option")
        .map((opcao) => opcao.textContent),
    ).toEqual(["Hatch", "Sedã", "SUV"]);
    expect(within(lista).getByRole("option", { name: "Sedã" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(lista).getByRole("option", { name: "SUV" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(opcaoAtiva(campo)).toBe("Sedã");
  });

  it("escolhe pelo toque, devolve o foco ao campo e não avisa quando nada muda", async () => {
    const usuario = userEvent.setup();
    const { campo, aoMudar } = montar();

    await usuario.click(campo);
    await usuario.click(screen.getByRole("option", { name: "SUV" }));

    expect(aoMudar).toHaveBeenCalledExactlyOnceWith("suv");
    expect(campo).toHaveTextContent("SUV");
    expect(campo).toHaveAttribute("aria-expanded", "false");
    expect(campo).toHaveFocus();

    await usuario.click(campo);
    await usuario.click(screen.getByRole("option", { name: "SUV" }));

    expect(aoMudar).toHaveBeenCalledOnce();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("fecha pelo próprio campo, ao tocar fora e ao perder o foco", async () => {
    const usuario = userEvent.setup();
    const { campo, aoMudar } = montar();

    await usuario.click(campo);
    await usuario.click(campo);
    expect(campo).toHaveAttribute("aria-expanded", "false");

    await usuario.click(campo);
    fireEvent.pointerDown(screen.getByRole("option", { name: "Hatch" }));
    expect(campo).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerDown(document.body);
    expect(campo).toHaveAttribute("aria-expanded", "false");
    expect(campo).toHaveFocus();

    await usuario.click(campo);
    await usuario.tab();
    expect(campo).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Fora" })).toHaveFocus();
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it("funciona pelo teclado e mantém a opção ativa à vista", async () => {
    const usuario = userEvent.setup();
    const rolar = vi.spyOn(Element.prototype, "scrollIntoView");
    const { campo, aoMudar } = montar();

    await usuario.tab();
    expect(campo).toHaveFocus();

    await usuario.keyboard("{ArrowDown}");
    expect(campo).toHaveAttribute("aria-expanded", "true");
    expect(opcaoAtiva(campo)).toBe("Sedã");

    await usuario.keyboard("{ArrowDown}");
    expect(opcaoAtiva(campo)).toBe("SUV");
    expect(rolar.mock.contexts.at(-1)).toBe(screen.getByRole("option", { name: "SUV" }));
    expect(rolar).toHaveBeenLastCalledWith({ block: "nearest" });

    await usuario.keyboard("{ArrowDown}");
    expect(opcaoAtiva(campo)).toBe("SUV");
    await usuario.keyboard("{Home}");
    expect(opcaoAtiva(campo)).toBe("Hatch");
    await usuario.keyboard("{ArrowUp}");
    expect(opcaoAtiva(campo)).toBe("Hatch");
    await usuario.keyboard("{End}");
    expect(opcaoAtiva(campo)).toBe("SUV");

    await usuario.keyboard("{ArrowUp}{ArrowUp}{Enter}");
    expect(aoMudar).toHaveBeenLastCalledWith("hatch");
    expect(campo).toHaveTextContent("Hatch");
    expect(campo).toHaveAttribute("aria-expanded", "false");

    await usuario.keyboard(" ");
    expect(opcaoAtiva(campo)).toBe("Hatch");
    await usuario.keyboard("{End} ");
    expect(aoMudar).toHaveBeenLastCalledWith("suv");

    await usuario.keyboard("{Enter}{ArrowUp}{Escape}");
    expect(campo).toHaveAttribute("aria-expanded", "false");
    expect(campo).toHaveTextContent("SUV");
    expect(aoMudar).toHaveBeenCalledTimes(2);
  });

  it("desabilitado não abre nem entra na ordem do Tab", async () => {
    const usuario = userEvent.setup();
    const { campo } = montar(true);
    expect(campo).toHaveAttribute("aria-disabled", "true");

    await usuario.click(campo);
    await usuario.keyboard("{ArrowDown}{Enter}");
    expect(campo).toHaveAttribute("aria-expanded", "false");

    await usuario.click(document.body);
    await usuario.tab();
    expect(screen.getByRole("button", { name: "Fora" })).toHaveFocus();
  });
});
