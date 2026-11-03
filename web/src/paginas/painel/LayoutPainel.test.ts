import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LOJA, rotasDoPainel, USUARIO } from "../../testes/dados.ts";
import { renderizarRota } from "../../testes/renderizar.tsx";
import { respostaDeErro, simularApi, type RotasSimuladas } from "../../testes/simularApi.ts";

function simularPainel(rotas: RotasSimuladas = {}) {
  return simularApi(
    rotasDoPainel({
      "GET /api/dashboard/store": { loja: { ...LOJA, nome: "Auto Center Campinas" } },
      "GET /api/dashboard/cars": { carros: [] },
      "GET /api/dashboard/customers": { clientes: [] },
      ...rotas,
    }),
  );
}

describe("LayoutPainel", () => {
  it("mostra a loja, as seções do painel e o vendedor que entrou", async () => {
    simularPainel();

    renderizarRota("/dashboard/cars");

    const marca = (await screen.findByText("Auto Center Campinas")).closest("a");
    expect(marca).toHaveAttribute("href", "/dashboard/cars");
    expect(marca).toHaveTextContent("Gestão do catálogo");
    const secoes = screen.getByRole("navigation", { name: "Seções do painel" });
    expect(
      within(secoes)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Carros", "/dashboard/cars"],
      ["Clientes", "/dashboard/customers"],
      ["Funil", "/dashboard/funnel"],
      ["Loja", "/dashboard/store"],
    ]);
    expect(within(secoes).getByRole("link", { name: "Carros" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Ver catálogo" })).toHaveAttribute("href", "/catalogo");
    expect(screen.getByRole("link", { name: "Ver catálogo" })).toHaveAttribute("target", "_blank");
    expect(screen.getByText(USUARIO.nome)).toBeInTheDocument();
  });

  it("troca de seção pelo menu", async () => {
    const usuario = userEvent.setup();
    simularPainel();
    const { router } = renderizarRota("/dashboard/cars");
    const secoes = await screen.findByRole("navigation", { name: "Seções do painel" });

    await usuario.click(within(secoes).getByRole("link", { name: "Clientes" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Clientes" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard/customers");
    expect(within(secoes).getByRole("link", { name: "Clientes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(secoes).getByRole("link", { name: "Carros" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("usa o nome padrão quando a configuração da loja não carrega", async () => {
    simularPainel({
      "GET /api/dashboard/store": respostaDeErro(500, "erro_interno", "Erro interno."),
    });

    renderizarRota("/dashboard/customers");

    expect(await screen.findByRole("heading", { level: 1, name: "Clientes" })).toBeInTheDocument();
    expect(screen.getByText("Globo Motors").closest("a")).toHaveAttribute(
      "href",
      "/dashboard/cars",
    );
  });

  it("sai, limpa os dados do painel e volta para o login", async () => {
    const usuario = userEvent.setup();
    const api = simularPainel({ "POST /api/auth/logout": new Response(null, { status: 204 }) });
    const { router, queryClient } = renderizarRota("/dashboard/cars");
    await screen.findByRole("heading", { level: 1, name: "Carros" });

    await usuario.click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("heading", { name: "Painel do vendedor" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(api.chaves().at(-1)).toBe("POST /api/auth/logout");
    expect(queryClient.getQueryData(["sessao"])).toBeNull();
    expect(queryClient.getQueriesData({ queryKey: ["painel"] })).toEqual([]);
  });

  it("manda para o login e limpa os dados do painel quando a sessão expira", async () => {
    simularPainel({
      "GET /api/dashboard/cars": respostaDeErro(401, "nao_autenticado", "Entre para continuar."),
    });

    const { router, queryClient } = renderizarRota("/dashboard/cars");

    expect(await screen.findByRole("heading", { name: "Painel do vendedor" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.state).toEqual({ de: "/dashboard/cars" });
    expect(queryClient.getQueriesData({ queryKey: ["painel"] })).toEqual([]);
  });

  it("avisa quando não consegue sair e continua no painel", async () => {
    const usuario = userEvent.setup();
    simularPainel({
      "POST /api/auth/logout": respostaDeErro(500, "erro_interno", "Erro interno."),
    });
    const { router } = renderizarRota("/dashboard/cars");
    await screen.findByRole("heading", { level: 1, name: "Carros" });

    await usuario.click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno.");
    expect(router.state.location.pathname).toBe("/dashboard/cars");
    expect(screen.getByRole("button", { name: "Sair" })).toBeEnabled();
  });

  it("avisa quando não consegue verificar a sessão e tenta de novo", async () => {
    const usuario = userEvent.setup();
    const rotas = rotasDoPainel({
      "GET /api/auth/me": respostaDeErro(500, "erro_interno", "Erro interno."),
      "GET /api/dashboard/cars": { carros: [] },
    });
    simularApi(rotas);
    renderizarRota("/dashboard/cars");

    expect(
      await screen.findByRole("heading", { name: "Não foi possível abrir o painel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Erro interno.")).toBeInTheDocument();

    rotas["GET /api/auth/me"] = { usuario: USUARIO };
    await usuario.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText(USUARIO.nome)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Carros" })).toBeInTheDocument();
  });
});
