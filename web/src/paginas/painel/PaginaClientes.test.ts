import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { cliente, rotasDoPainel } from "../../testes/dados.ts";
import { renderizarRota } from "../../testes/renderizar.tsx";
import { respostaDeErro, simularApi, type RotasSimuladas } from "../../testes/simularApi.ts";

const ANA = cliente({ interesses: 2 });
const BRUNO = cliente({
  id: "k2",
  nome: "Bruno Lima",
  telefone: "1933334444",
  email: null,
  origem: null,
  observacoes: null,
  interesses: 1,
  criadoEm: "2026-10-21T01:30:00.000Z",
});

function simularClientes(rotas: RotasSimuladas = {}) {
  const todas = rotasDoPainel({
    "GET /api/dashboard/customers": { clientes: [ANA, BRUNO] },
    ...rotas,
  });
  return { ...simularApi(todas), rotas: todas };
}

function linhas() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((linha) =>
      within(linha)
        .getAllByRole("cell")
        .map((celula) => celula.textContent),
    );
}

function buscasFeitas(chaves: string[]) {
  return chaves.filter((chave) => chave.startsWith("GET /api/dashboard/customers"));
}

describe("PaginaClientes", () => {
  it("lista os clientes com contato, origem, interesses e data de cadastro", async () => {
    simularClientes();

    renderizarRota("/dashboard/customers");

    expect(await screen.findByRole("heading", { level: 1, name: "Clientes" })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Clientes · Painel"));
    expect(await screen.findByText("2 clientes")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((coluna) => coluna.textContent)).toEqual([
      "Nome",
      "Telefone",
      "Origem",
      "Interesses",
      "Cadastro",
    ]);
    expect(linhas()).toEqual([
      ["Ana Souzaana@exemplo.com", "(11) 91234-5678", "Instagram", "2 carros", "20/10/2026"],
      ["Bruno Lima", "(19) 3333-4444", "Não informada", "1 carro", "20/10/2026"],
    ]);
    expect(screen.getByRole("link", { name: "Ana Souza" })).toHaveAttribute(
      "href",
      "/dashboard/customers/k1",
    );
    const whatsapp = screen.getByRole("link", { name: "(19) 3333-4444" });
    expect(whatsapp).toHaveAttribute("href", "https://wa.me/551933334444");
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Novo cliente" })).toHaveAttribute(
      "href",
      "/dashboard/customers/new",
    );
  });

  it("busca no servidor pelo termo digitado, sem os espaços das pontas", async () => {
    const usuario = userEvent.setup();
    const api = simularClientes({
      "GET /api/dashboard/customers?search=ana": { clientes: [ANA] },
    });
    renderizarRota("/dashboard/customers");
    const busca = await screen.findByRole("searchbox", { name: "Buscar clientes" });

    await usuario.type(busca, "  ana ");

    await waitFor(() => expect(linhas()).toHaveLength(1));
    expect(screen.getByRole("link", { name: "Ana Souza" })).toBeInTheDocument();
    expect(screen.getByText("1 cliente")).toBeInTheDocument();
    expect(buscasFeitas(api.chaves()).at(-1)).toBe("GET /api/dashboard/customers?search=ana");
    expect(buscasFeitas(api.chaves()).filter((chave) => /%20|\+/.test(chave))).toEqual([]);

    await usuario.clear(busca);

    await waitFor(() => expect(linhas()).toHaveLength(2));
    expect(screen.getByText("2 clientes")).toBeInTheDocument();
  });

  it("mantém a lista anterior esmaecida enquanto a busca carrega", async () => {
    const usuario = userEvent.setup();
    let responder: (resposta: unknown) => void = () => undefined;
    simularClientes({
      "GET /api/dashboard/customers?search=bruno": () =>
        new Promise((resolver) => {
          responder = resolver;
        }),
    });
    renderizarRota("/dashboard/customers");
    const busca = await screen.findByRole("searchbox", { name: "Buscar clientes" });
    await screen.findByText("2 clientes");

    await usuario.type(busca, "bruno");

    await waitFor(() => expect(screen.getByRole("table").parentElement).toHaveClass("opacity-60"));
    expect(linhas()).toHaveLength(2);

    responder({ clientes: [BRUNO] });

    await waitFor(() => expect(linhas()).toHaveLength(1));
    expect(screen.getByRole("table").parentElement).not.toHaveClass("opacity-60");
    expect(screen.getByText("1 cliente")).toBeInTheDocument();
  });

  it("avisa quando nenhum cliente combina com a busca", async () => {
    const usuario = userEvent.setup();
    simularClientes({ "GET /api/dashboard/customers?search=zeca": { clientes: [] } });
    renderizarRota("/dashboard/customers");
    const busca = await screen.findByRole("searchbox", { name: "Buscar clientes" });

    await usuario.type(busca, "zeca");

    expect(
      await screen.findByRole("heading", { name: "Nenhum cliente encontrado" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhum cliente corresponde a “zeca”.")).toBeInTheDocument();
    expect(screen.getByText("0 clientes")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cadastrar cliente" })).not.toBeInTheDocument();
    expect(busca).toHaveValue("zeca");
  });

  it("convida a cadastrar o primeiro cliente", async () => {
    const usuario = userEvent.setup();
    simularClientes({ "GET /api/dashboard/customers": { clientes: [] } });
    const { router } = renderizarRota("/dashboard/customers");

    expect(
      await screen.findByRole("heading", { name: "Nenhum cliente cadastrado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cadastre quem procurou a loja para acompanhar cada negociação no funil."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByText("0 clientes")).not.toBeInTheDocument();

    await usuario.click(screen.getByRole("link", { name: "Cadastrar cliente" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Novo cliente" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard/customers/new");
  });

  it("mostra o carregamento, avisa a falha sem inventar contagem e tenta de novo", async () => {
    const usuario = userEvent.setup();
    let responder: (resposta: unknown) => void = () => undefined;
    const api = simularClientes({
      "GET /api/dashboard/customers": () =>
        new Promise((resolver) => {
          responder = resolver;
        }),
    });
    renderizarRota("/dashboard/customers");

    expect(await screen.findByRole("heading", { level: 1, name: "Clientes" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando…");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

    responder(respostaDeErro(500, "erro_interno", "Erro interno."));

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno.");
    expect(screen.queryByText("0 clientes")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    api.rotas["GET /api/dashboard/customers"] = { clientes: [ANA, BRUNO] };
    await usuario.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("2 clientes")).toBeInTheDocument();
    expect(linhas()).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
