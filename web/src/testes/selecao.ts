import { within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

function listaDe(campo: HTMLElement) {
  const lista = document.getElementById(campo.getAttribute("aria-controls") ?? "");
  if (!lista) throw new Error("A seleção não controla nenhuma lista.");
  return within(lista);
}

export async function escolherOpcao(usuario: UserEvent, campo: HTMLElement, opcao: string) {
  await usuario.click(campo);
  await usuario.click(listaDe(campo).getByRole("option", { name: opcao }));
}

export async function lerOpcoes(usuario: UserEvent, campo: HTMLElement) {
  await usuario.click(campo);
  const opcoes = listaDe(campo)
    .getAllByRole("option")
    .map((opcao) => opcao.textContent);
  await usuario.keyboard("{Escape}");
  return opcoes;
}
