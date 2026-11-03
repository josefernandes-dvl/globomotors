import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { carroPublico, LOJA_PUBLICA } from "../../testes/dados.ts";
import { renderizarRota } from "../../testes/renderizar.tsx";
import { respostaDeErro, simularApi, type RotasSimuladas } from "../../testes/simularApi.ts";

const CAMINHO = "/catalogo/chevrolet-onix-2021-c1";
const ROTA_DO_CARRO = "GET /api/showroom/cars/chevrolet-onix-2021-c1";
const FOTOS = [1, 2, 3].map((numero) => ({
  id: `f${numero}`,
  url: `/api/showroom/photos/f${numero}`,
}));

function simularCarro(rotas: RotasSimuladas = {}) {
  return simularApi({
    "GET /api/showroom/store": { loja: LOJA_PUBLICA },
    [ROTA_DO_CARRO]: { carro: carroPublico({ destaque: true, fotos: FOTOS }) },
    ...rotas,
  });
}

function fotoPrincipal() {
  return screen.getByRole("img", { name: /^Chevrolet Onix/ });
}

describe("PaginaCarro", () => {
  it("mostra o preço, a ficha técnica, o que o carro possui e a descrição", async () => {
    const api = simularCarro();

    renderizarRota(CAMINHO);

    expect(screen.getByRole("status")).toHaveTextContent("Carregando veículo…");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Chevrolet Onix" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Destaque")).toBeInTheDocument();
    expect(screen.getByText("1.0 Turbo LTZ")).toBeInTheDocument();
    expect(screen.getByText("R$ 89.900")).toBeInTheDocument();
    expect(screen.getAllByRole("term").map((termo) => termo.textContent)).toEqual([
      "Ano",
      "Quilometragem",
      "Câmbio",
      "Combustível",
      "Cor",
      "Motor",
      "Carroceria",
      "Portas",
    ]);
    expect(screen.getAllByRole("definition").map((valor) => valor.textContent)).toEqual([
      "2020/2021",
      "42.000 km",
      "Automático",
      "Flex",
      "Prata",
      "1.0 Turbo",
      "Hatch",
      "4",
    ]);
    expect(screen.getByRole("heading", { name: "Possui:" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Ar-condicionado",
      "Multimídia",
    ]);
    expect(screen.getByText("Único dono, revisões na concessionária.")).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Chevrolet Onix 1.0 Turbo LTZ · Globo Motors"));
    expect(api.chaves()).toContain(ROTA_DO_CARRO);
    expect(api.chaves().every((chave) => chave.startsWith("GET /api/showroom/"))).toBe(true);
  });

  it("abre o WhatsApp da loja com a mensagem de interesse no carro", async () => {
    simularCarro();

    renderizarRota(CAMINHO);

    const link = await screen.findByRole("link", { name: "Tenho interesse: chamar no WhatsApp" });
    const url = new URL(link.getAttribute("href") ?? "");
    expect(`${url.origin}${url.pathname}`).toBe("https://wa.me/5511987654321");
    expect(url.searchParams.get("text")).toBe(
      `Olá! Tenho interesse no Chevrolet Onix 1.0 Turbo LTZ 2020/2021, cor Prata. Ainda está disponível?\n${window.location.origin}/catalogo/chevrolet-onix-2021-c1`,
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText("WhatsApp (11) 98765-4321")).toBeInTheDocument();
  });

  it("só leva de volta à vitrine, sem caminho para o painel", async () => {
    const usuario = userEvent.setup();
    simularCarro({ "GET /api/showroom/cars": { carros: [carroPublico()] } });
    const { router } = renderizarRota(CAMINHO);
    await screen.findByRole("heading", { level: 1, name: "Chevrolet Onix" });

    const internos = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href") ?? "")
      .filter((destino) => !destino.startsWith("https://"));
    expect(internos).toEqual(["/", "/catalogo"]);
    expect(screen.getByRole("link", { name: "Globo Motors" })).toHaveAttribute("href", "/");

    await usuario.click(screen.getByRole("link", { name: "Voltar ao catálogo" }));

    expect(router.state.location.pathname).toBe("/catalogo");
    expect(router.state.historyAction).toBe("PUSH");
    expect(
      await screen.findByRole("heading", { level: 2, name: "Chevrolet Onix" }),
    ).toBeInTheDocument();
  });

  it("passa as fotos pelos botões, pelas miniaturas e pelas setas do teclado", async () => {
    const usuario = userEvent.setup();
    simularCarro();
    renderizarRota(CAMINHO);

    expect(await screen.findByRole("img", { name: "Chevrolet Onix, foto 1 de 3" })).toHaveAttribute(
      "src",
      "/api/showroom/photos/f1",
    );
    expect(screen.getByRole("button", { name: "Ver foto 1" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await usuario.click(screen.getByRole("button", { name: "Próxima foto" }));
    expect(fotoPrincipal()).toHaveAccessibleName("Chevrolet Onix, foto 2 de 3");
    expect(fotoPrincipal()).toHaveAttribute("src", "/api/showroom/photos/f2");
    expect(screen.getByRole("button", { name: "Ver foto 2" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "Ver foto 1" })).not.toHaveAttribute("aria-current");

    await usuario.click(screen.getByRole("button", { name: "Foto anterior" }));
    await usuario.click(screen.getByRole("button", { name: "Foto anterior" }));
    expect(fotoPrincipal()).toHaveAccessibleName("Chevrolet Onix, foto 3 de 3");

    await usuario.keyboard("{ArrowRight}");
    expect(fotoPrincipal()).toHaveAccessibleName("Chevrolet Onix, foto 1 de 3");

    await usuario.keyboard("{ArrowLeft}");
    expect(fotoPrincipal()).toHaveAccessibleName("Chevrolet Onix, foto 3 de 3");

    await usuario.click(screen.getByRole("button", { name: "Ver foto 2" }));
    expect(fotoPrincipal()).toHaveAttribute("src", "/api/showroom/photos/f2");
  });

  it("mostra a foto única sem navegação, também em tela cheia", async () => {
    const usuario = userEvent.setup();
    simularCarro({ [ROTA_DO_CARRO]: { carro: carroPublico({ fotos: FOTOS.slice(0, 1) }) } });

    renderizarRota(CAMINHO);

    expect(await screen.findByRole("img", { name: "Chevrolet Onix" })).toHaveAttribute(
      "src",
      "/api/showroom/photos/f1",
    );
    expect(screen.getByRole("button")).toHaveAccessibleName("Ver foto em tela cheia");

    await usuario.click(screen.getByRole("button"));

    const dialogo = screen.getByRole("dialog", { name: "Foto em tela cheia" });
    expect(within(dialogo).getByRole("img", { name: "Chevrolet Onix" })).toHaveAttribute(
      "src",
      "/api/showroom/photos/f1",
    );
    expect(within(dialogo).getByRole("button")).toHaveAccessibleName("Fechar");
    expect(dialogo.textContent).toBe("");

    await usuario.tab();
    expect(within(dialogo).getByRole("button")).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(within(dialogo).getByRole("button")).toHaveFocus();
  });

  it("abre a foto atual em tela cheia, passa as fotos e devolve o foco ao fechar", async () => {
    const usuario = userEvent.setup();
    simularCarro();
    renderizarRota(CAMINHO);
    await screen.findByRole("img", { name: "Chevrolet Onix, foto 1 de 3" });
    await usuario.click(screen.getByRole("button", { name: "Próxima foto" }));
    const abrir = screen.getByRole("button", { name: "Ver foto em tela cheia" });

    await usuario.click(abrir);

    const dialogo = screen.getByRole("dialog", { name: "Foto em tela cheia" });
    const foto = () => within(dialogo).getByRole("img");
    expect(foto()).toHaveAccessibleName("Chevrolet Onix, foto 2 de 3");
    expect(foto()).toHaveAttribute("src", "/api/showroom/photos/f2");
    expect(dialogo).toHaveTextContent("2 de 3");
    expect(within(dialogo).getByRole("button", { name: "Fechar" })).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe("hidden");

    await usuario.click(within(dialogo).getByRole("button", { name: "Próxima foto" }));
    expect(foto()).toHaveAccessibleName("Chevrolet Onix, foto 3 de 3");
    expect(dialogo).toHaveTextContent("3 de 3");

    await usuario.keyboard("{ArrowRight}");
    expect(foto()).toHaveAttribute("src", "/api/showroom/photos/f1");
    expect(dialogo).toHaveTextContent("1 de 3");

    await usuario.click(within(dialogo).getByRole("button", { name: "Foto anterior" }));
    expect(foto()).toHaveAccessibleName("Chevrolet Onix, foto 3 de 3");

    await usuario.click(within(dialogo).getByRole("button", { name: "Fechar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe("");
    expect(fotoPrincipal()).toHaveAccessibleName("Chevrolet Onix, foto 3 de 3");
    expect(screen.getByRole("button", { name: "Ver foto 3" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("prende o foco na tela cheia e fecha com Esc", async () => {
    const usuario = userEvent.setup();
    simularCarro();
    renderizarRota(CAMINHO);
    await usuario.click(await screen.findByRole("button", { name: "Ver foto em tela cheia" }));
    const dialogo = screen.getByRole("dialog", { name: "Foto em tela cheia" });
    const fechar = within(dialogo).getByRole("button", { name: "Fechar" });
    const anterior = within(dialogo).getByRole("button", { name: "Foto anterior" });
    const proxima = within(dialogo).getByRole("button", { name: "Próxima foto" });

    await usuario.tab();
    expect(anterior).toHaveFocus();
    await usuario.tab();
    expect(proxima).toHaveFocus();
    await usuario.tab();
    expect(fechar).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(proxima).toHaveFocus();

    await usuario.click(within(dialogo).getByRole("img"));
    expect(dialogo).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(proxima).toHaveFocus();

    await usuario.click(within(dialogo).getByRole("img"));
    await usuario.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver foto em tela cheia" })).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("mostra o carro vendido sem preço, sem foto e sem o botão de interesse", async () => {
    simularCarro({
      [ROTA_DO_CARRO]: { carro: carroPublico({ status: "vendido", preco: null }) },
    });

    renderizarRota(CAMINHO);

    expect(await screen.findByText("Vendido")).toBeInTheDocument();
    await screen.findByText(/^Globo Motors · WhatsApp/);
    expect(screen.getByText("Consulte")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Sem foto" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver foto em tela cheia" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.queryByText("WhatsApp (11) 98765-4321")).not.toBeInTheDocument();
  });

  it("esconde o botão de interesse quando a loja não tem WhatsApp", async () => {
    simularCarro({ "GET /api/showroom/store": { loja: { ...LOJA_PUBLICA, whatsapp: null } } });

    renderizarRota(CAMINHO);

    expect(await screen.findByText("Globo Motors · @globomotors")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Chevrolet Onix" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
  });

  it("mostra só o que o carro tem quando faltam dados opcionais", async () => {
    simularCarro({
      [ROTA_DO_CARRO]: {
        carro: carroPublico({
          versao: null,
          anoFabricacao: null,
          anoModelo: null,
          km: null,
          cambio: null,
          combustivel: null,
          carroceria: null,
          cor: null,
          motor: null,
          portas: null,
          opcionais: [],
          descricao: null,
        }),
      },
    });

    renderizarRota(CAMINHO);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Chevrolet Onix" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("term")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Possui:" })).not.toBeInTheDocument();
    expect(screen.queryByText("Único dono, revisões na concessionária.")).not.toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Chevrolet Onix · Globo Motors"));
  });

  it("avisa quando o carro não está mais na vitrine", async () => {
    simularCarro({
      [ROTA_DO_CARRO]: respostaDeErro(404, "nao_encontrado", "Carro não encontrado."),
    });

    renderizarRota(CAMINHO);

    expect(
      await screen.findByRole("heading", { name: "Veículo não encontrado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ele pode ter sido vendido ou retirado do catálogo."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver os veículos disponíveis" })).toHaveAttribute(
      "href",
      "/catalogo",
    );
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });

  it("avisa as outras falhas e tenta de novo", async () => {
    const usuario = userEvent.setup();
    const rotas: RotasSimuladas = {
      "GET /api/showroom/store": { loja: LOJA_PUBLICA },
      [ROTA_DO_CARRO]: respostaDeErro(500, "erro_interno", "Erro interno."),
    };
    simularApi(rotas);

    renderizarRota(CAMINHO);

    expect(await screen.findByText("Não foi possível carregar este veículo.")).toBeInTheDocument();
    expect(screen.getByText("Erro interno.")).toBeInTheDocument();

    rotas[ROTA_DO_CARRO] = { carro: carroPublico() };
    await usuario.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Chevrolet Onix" }),
    ).toBeInTheDocument();
  });
});
