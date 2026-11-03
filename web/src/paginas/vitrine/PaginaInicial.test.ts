import { screen, waitFor, waitForElementToBeRemoved, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { consultaLojaPublica } from "../../lib/vitrine.ts";
import { carroPublico, LOJA_PUBLICA } from "../../testes/dados.ts";
import { renderizarRota } from "../../testes/renderizar.tsx";
import { respostaDeErro, simularApi, type RotasSimuladas } from "../../testes/simularApi.ts";

const ONIX = carroPublico();
const HB20 = carroPublico({
  slug: "hyundai-hb20-2019-h1",
  marca: "Hyundai",
  modelo: "HB20",
});
const COROLLA = carroPublico({
  slug: "toyota-corolla-2018-t1",
  marca: "Toyota",
  modelo: "Corolla",
  destaque: true,
  status: "vendido",
});
const ARGO = carroPublico({ slug: "fiat-argo-2022-a1", marca: "Fiat", modelo: "Argo" });
const COMPASS = carroPublico({
  slug: "jeep-compass-2023-j1",
  marca: "Jeep",
  modelo: "Compass",
  destaque: true,
});
const POLO = carroPublico({
  slug: "volkswagen-polo-2020-p1",
  marca: "Volkswagen",
  modelo: "Polo",
});
const WHATSAPP = "https://wa.me/5511987654321";

function simularInicio(rotas: RotasSimuladas = {}) {
  return simularApi({
    "GET /api/showroom/store": { loja: LOJA_PUBLICA },
    "GET /api/showroom/cars": { carros: [HB20, ONIX, COROLLA, ARGO, COMPASS, POLO] },
    ...rotas,
  });
}

function titulosEmDestaque() {
  return within(screen.getByRole("region", { name: "Em destaque" }))
    .getAllByRole("heading", { level: 3 })
    .map((titulo) => titulo.textContent);
}

function contagem() {
  return screen.queryByText(/disponíve(l|is) agora$/);
}

describe("PaginaInicial", () => {
  it("apresenta a loja com o botão Ver catálogo, o WhatsApp e os carros disponíveis", async () => {
    simularInicio();

    renderizarRota("/");

    expect(await screen.findByText("Campinas, SP")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Globo Motors" })).toBeInTheDocument();
    expect(screen.getByText("Seminovos com procedência")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver catálogo" })).toHaveAttribute("href", "/catalogo");
    const whatsapp = screen.getByRole("link", { name: "Falar no WhatsApp" });
    expect(whatsapp).toHaveAttribute("href", WHATSAPP);
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(await screen.findByText(/disponíveis agora$/)).toHaveTextContent(
      /^5 veículos disponíveis agora$/,
    );
    expect(screen.getByRole("link", { name: "@globomotors" })).toHaveAttribute(
      "href",
      "https://instagram.com/globomotors",
    );
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      /^Globo Motors · WhatsApp \(11\) 98765-4321 · @globomotors$/,
    );
    await waitFor(() => expect(document.title).toBe("Globo Motors"));
  });

  it("mostra até quatro carros em destaque, com os destaques primeiro e sem os vendidos", async () => {
    simularInicio();

    renderizarRota("/");

    await screen.findByRole("heading", { level: 3, name: "Jeep Compass" });
    expect(titulosEmDestaque()).toEqual([
      "Jeep Compass",
      "Hyundai HB20",
      "Chevrolet Onix",
      "Fiat Argo",
    ]);
    const secao = screen.getByRole("region", { name: "Em destaque" });
    expect(within(secao).getByRole("list")).toHaveClass("grid-cols-2");
    expect(
      within(secao)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "/catalogo",
      "/catalogo/jeep-compass-2023-j1",
      "/catalogo/hyundai-hb20-2019-h1",
      "/catalogo/chevrolet-onix-2021-c1",
      "/catalogo/fiat-argo-2022-a1",
    ]);
    expect(within(secao).getByRole("link", { name: "Ver todos" })).toHaveAttribute(
      "href",
      "/catalogo",
    );
    expect(screen.queryByText(/Toyota|Volkswagen/)).not.toBeInTheDocument();
  });

  it("explica como comprar e leva ao WhatsApp da loja", async () => {
    simularInicio();

    renderizarRota("/");

    const secao = await screen.findByRole("region", { name: "Como comprar" });
    expect(within(secao).getAllByRole("listitem")).toHaveLength(3);
    expect(
      within(secao)
        .getAllByRole("heading", { level: 3 })
        .map((titulo) => titulo.textContent),
    ).toEqual(["Escolha no catálogo", "Chame no WhatsApp", "Feche negócio"]);
    expect(within(secao).getByRole("link", { name: "WhatsApp (11) 98765-4321" })).toHaveAttribute(
      "href",
      WHATSAPP,
    );
  });

  it("não oferece caminho para o painel nem para o login e só consulta a vitrine pública", async () => {
    const api = simularInicio();

    renderizarRota("/");

    await screen.findByRole("heading", { level: 3, name: "Jeep Compass" });
    await screen.findByRole("region", { name: "Como comprar" });
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/catalogo",
      WHATSAPP,
      "/catalogo",
      "/catalogo/jeep-compass-2023-j1",
      "/catalogo/hyundai-hb20-2019-h1",
      "/catalogo/chevrolet-onix-2021-c1",
      "/catalogo/fiat-argo-2022-a1",
      WHATSAPP,
      "https://instagram.com/globomotors",
    ]);
    expect(screen.queryByText(/painel|entrar|login|dashboard/i)).not.toBeInTheDocument();
    expect(api.chaves().every((chave) => chave.startsWith("GET /api/showroom/"))).toBe(true);
  });

  it("abre o catálogo pelo botão Ver catálogo", async () => {
    const usuario = userEvent.setup();
    simularInicio();
    const { router } = renderizarRota("/");

    await usuario.click(await screen.findByRole("link", { name: "Ver catálogo" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Catálogo de veículos" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/catalogo");
  });

  it("abre um carro em destaque e volta ao catálogo, não à página inicial", async () => {
    const usuario = userEvent.setup();
    simularInicio({ "GET /api/showroom/cars/jeep-compass-2023-j1": { carro: COMPASS } });
    const { router } = renderizarRota("/");

    await usuario.click(await screen.findByRole("link", { name: /Jeep Compass/ }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Jeep Compass" }),
    ).toBeInTheDocument();
    await usuario.click(screen.getByRole("link", { name: "Voltar ao catálogo" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Catálogo de veículos" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/catalogo");
    expect(router.state.historyAction).toBe("PUSH");
  });

  it("mostra o carregamento e depois os destaques sem o vendido, mesmo com lugar sobrando", async () => {
    let responder: (resposta: unknown) => void = () => undefined;
    simularInicio({
      "GET /api/showroom/cars": () =>
        new Promise((resolver) => {
          responder = resolver;
        }),
    });

    renderizarRota("/");

    const secao = await screen.findByRole("region", { name: "Em destaque" });
    expect(within(secao).getByRole("status")).toHaveTextContent("Carregando veículos…");
    expect(contagem()).not.toBeInTheDocument();
    responder({ carros: [COROLLA, ONIX] });

    expect(
      await screen.findByRole("heading", { level: 3, name: "Chevrolet Onix" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(titulosEmDestaque()).toEqual(["Chevrolet Onix"]);
    expect(contagem()).toHaveTextContent(/^1 veículo disponível agora$/);
  });

  it.each([
    ["não há carro publicado", { carros: [] }],
    ["os carros não carregam", respostaDeErro(500, "erro_interno", "Erro interno.")],
  ])("esconde os destaques e a contagem quando %s", async (_caso, resposta) => {
    simularInicio({ "GET /api/showroom/cars": resposta });

    renderizarRota("/");

    await waitForElementToBeRemoved(screen.getByRole("status"));
    expect(screen.queryByRole("region", { name: "Em destaque" })).not.toBeInTheDocument();
    expect(contagem()).not.toBeInTheDocument();
    expect(screen.queryByText("Erro interno.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver catálogo" })).toHaveAttribute("href", "/catalogo");
  });

  it("usa os dados padrão da loja quando a configuração não carrega", async () => {
    simularInicio({
      "GET /api/showroom/store": respostaDeErro(500, "erro_interno", "Erro interno."),
    });

    const { queryClient } = renderizarRota("/");

    await waitFor(() =>
      expect(queryClient.getQueryState(consultaLojaPublica.queryKey)?.status).toBe("error"),
    );
    expect(
      await screen.findByRole("heading", { level: 3, name: "Jeep Compass" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Globo Motors" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver catálogo" })).toHaveAttribute("href", "/catalogo");
    expect(screen.queryByRole("link", { name: /WhatsApp|@/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Como comprar" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Instagram|Campinas|Seminovos/)).not.toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent(/^Globo Motors$/);
    await waitFor(() => expect(document.title).toBe("Globo Motors"));
  });
});
