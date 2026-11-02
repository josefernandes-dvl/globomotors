import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOJA_PUBLICA, rotasDoPainel } from "./testes/dados.ts";
import { renderizarRota } from "./testes/renderizar.tsx";
import { respostaDeErro, simularApi } from "./testes/simularApi.ts";

const MODULO_ENTRAR = "./paginas/PaginaEntrar.tsx";

describe("rotas", () => {
  afterEach(() => {
    vi.doUnmock(MODULO_ENTRAR);
  });

  it("abre a página inicial na raiz e o catálogo em /catalogo, sem login", async () => {
    const api = simularApi({
      "GET /api/showroom/store": { loja: LOJA_PUBLICA },
      "GET /api/showroom/cars": { carros: [] },
    });

    const { router } = renderizarRota("/");

    expect(
      await screen.findByRole("heading", { level: 1, name: LOJA_PUBLICA.nome }),
    ).toBeInTheDocument();
    await act(() => router.navigate("/catalogo"));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Catálogo de veículos" }),
    ).toBeInTheDocument();
    expect(api.chaves().every((chave) => chave.startsWith("GET /api/showroom/"))).toBe(true);
  });

  it("mostra página não encontrada com link para o catálogo", async () => {
    renderizarRota("/nao-existe");

    expect(
      await screen.findByRole("heading", { name: "Página não encontrada" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver os carros" })).toHaveAttribute(
      "href",
      "/catalogo",
    );
  });

  it.each([
    "/painel",
    "/entrar",
    "/carros/chevrolet-onix-2021-c1",
    "/painel/clientes",
    "/cars",
    "/cars/chevrolet-onix-2021-c1",
  ])("não atende mais o caminho antigo %s", async (caminho) => {
    const api = simularApi({});

    renderizarRota(caminho);

    expect(
      await screen.findByRole("heading", { name: "Página não encontrada" }),
    ).toBeInTheDocument();
    expect(api.chaves()).toEqual([]);
  });

  it("leva /dashboard para o catálogo de carros", async () => {
    simularApi(rotasDoPainel({ "GET /api/dashboard/cars": { carros: [] } }));

    const { router } = renderizarRota("/dashboard");

    expect(await screen.findByRole("heading", { name: "Carros" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard/cars");
  });

  it("manda quem não entrou para /login, guardando o destino", async () => {
    simularApi({
      "GET /api/auth/me": respostaDeErro(401, "nao_autenticado", "Entre para continuar."),
    });

    const { router } = renderizarRota("/dashboard/customers?search=ana");

    expect(await screen.findByRole("heading", { name: "Painel do vendedor" })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.state).toEqual({ de: "/dashboard/customers?search=ana" });
  });

  it("mostra a página de erro quando o código de uma página não carrega", async () => {
    vi.doMock(MODULO_ENTRAR, () => {
      throw new Error("Failed to fetch dynamically imported module");
    });

    renderizarRota("/login");

    expect(await screen.findByRole("heading", { name: "Algo deu errado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeInTheDocument();
  });
});
