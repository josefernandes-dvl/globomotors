import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { carroPublico, LOJA_PUBLICA } from "../../testes/dados.ts";
import { renderizarRota } from "../../testes/renderizar.tsx";
import { escolherOpcao, lerOpcoes } from "../../testes/selecao.ts";
import { respostaDeErro, simularApi, type RotasSimuladas } from "../../testes/simularApi.ts";

const ONIX = carroPublico();
const HB20 = carroPublico({
  slug: "hyundai-hb20-2019-h1",
  marca: "Hyundai",
  modelo: "HB20",
  versao: "Comfort",
  anoFabricacao: 2019,
  anoModelo: 2019,
  km: 80_000,
  cambio: "Manual",
  cor: "Branco",
  opcionais: [],
  fotos: [{ id: "f1", url: "/api/showroom/photos/f1" }],
  preco: 5_500_000,
  status: "reservado",
});
const COMPASS = carroPublico({
  slug: "jeep-compass-2023-j1",
  marca: "Jeep",
  modelo: "Compass",
  versao: "Longitude",
  anoFabricacao: 2022,
  anoModelo: 2023,
  km: 15_000,
  combustivel: "Diesel",
  carroceria: "SUV",
  cor: "Preto",
  motor: "1.3 Turbo",
  destaque: true,
  preco: null,
});

function simularVitrine(rotas: RotasSimuladas = {}) {
  return simularApi({
    "GET /api/showroom/store": { loja: LOJA_PUBLICA },
    "GET /api/showroom/cars": { carros: [ONIX, HB20, COMPASS] },
    ...rotas,
  });
}

async function abrirVitrine(rotas?: RotasSimuladas) {
  const usuario = userEvent.setup();
  const api = simularVitrine(rotas);
  const tela = renderizarRota("/catalogo");
  await screen.findByRole("heading", { name: "Jeep Compass" });
  return { usuario, api, ...tela };
}

function titulosDosCarros() {
  return screen.queryAllByRole("heading", { level: 2 }).map((titulo) => titulo.textContent);
}

function grupo(nome: string) {
  return screen.getByRole("group", { name: nome });
}

function opcoesDoGrupo(nome: string) {
  return within(grupo(nome))
    .getAllByRole("button")
    .map((botao) => botao.textContent);
}

describe("PaginaVitrine", () => {
  it("mostra o catálogo com os destaques primeiro e os reservados no fim", async () => {
    await abrirVitrine();

    expect(titulosDosCarros()).toEqual(["Jeep Compass", "Chevrolet Onix", "Hyundai HB20"]);
    expect(
      screen.getByRole("heading", { level: 1, name: "Catálogo de veículos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("veículos disponíveis")).toHaveTextContent("2 veículos disponíveis");
    expect(screen.getByText("Campinas, SP")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Globo Motors" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/5511987654321",
    );
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      /^Globo Motors · WhatsApp \(11\) 98765-4321 · @globomotors$/,
    );
    expect(screen.queryByText(/sujeitas a altera/)).not.toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Catálogo de veículos · Globo Motors"));
  });

  it("mostra os carros em duas colunas, com etiqueta, anos, versão, km, câmbio e chamada", async () => {
    await abrirVitrine();

    expect(screen.getByRole("list")).toHaveClass("grid-cols-2");

    const compass = screen.getByRole("link", { name: /Jeep Compass/ });
    expect(compass).toHaveAttribute("href", "/catalogo/jeep-compass-2023-j1");
    expect(within(compass).getByText("Destaque")).toBeInTheDocument();
    expect(within(compass).getByRole("img", { name: "Sem foto" })).toBeInTheDocument();
    expect(within(compass).getByText("2022/2023")).toBeInTheDocument();
    expect(within(compass).getByText("Longitude")).toBeInTheDocument();
    expect(within(compass).getByText("15.000 km · Automático")).toBeInTheDocument();
    expect(within(compass).getByText("Ver detalhes →").textContent).toBe("Ver detalhes\u00a0→");

    const onix = screen.getByRole("link", { name: /Chevrolet Onix/ });
    expect(within(onix).queryByText(/^(Destaque|Reservado|Vendido)$/)).not.toBeInTheDocument();
    expect(within(onix).getByText("42.000 km · Automático")).toBeInTheDocument();
    expect(within(onix).getByText("Ver detalhes e preço →").textContent).toBe(
      "Ver detalhes e preço\u00a0→",
    );
    expect(within(onix).queryByText(/R\$/)).not.toBeInTheDocument();

    const hb20 = screen.getByRole("link", { name: /Hyundai HB20/ });
    expect(within(hb20).getByText("Reservado")).toBeInTheDocument();
    expect(within(hb20).getByText("80.000 km · Manual")).toBeInTheDocument();
    expect(within(hb20).getByRole("presentation")).toHaveAttribute(
      "src",
      "/api/showroom/photos/f1",
    );
  });

  it("não oferece caminho para o painel nem para o login e só consulta a vitrine pública", async () => {
    const { api } = await abrirVitrine();

    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "https://wa.me/5511987654321",
      "/catalogo/jeep-compass-2023-j1",
      "/catalogo/chevrolet-onix-2021-c1",
      "/catalogo/hyundai-hb20-2019-h1",
    ]);
    expect(screen.queryByText(/painel|entrar|login|dashboard/i)).not.toBeInTheDocument();
    expect(api.chaves().every((chave) => chave.startsWith("GET /api/showroom/"))).toBe(true);
  });

  it("ordena por preço, ano e km, com os carros sem preço sempre no fim", async () => {
    const { usuario } = await abrirVitrine();
    const ordem = screen.getByRole("combobox", { name: "Ordenar por" });
    expect(ordem).toHaveTextContent("Destaques");
    expect(await lerOpcoes(usuario, ordem)).toEqual([
      "Destaques",
      "Menor preço",
      "Maior preço",
      "Mais novos",
      "Menor km",
    ]);

    await escolherOpcao(usuario, ordem, "Menor preço");
    expect(ordem).toHaveTextContent("Menor preço");
    expect(titulosDosCarros()).toEqual(["Hyundai HB20", "Chevrolet Onix", "Jeep Compass"]);

    await escolherOpcao(usuario, ordem, "Mais novos");
    expect(titulosDosCarros()).toEqual(["Jeep Compass", "Chevrolet Onix", "Hyundai HB20"]);

    await escolherOpcao(usuario, ordem, "Maior preço");
    expect(titulosDosCarros()).toEqual(["Chevrolet Onix", "Hyundai HB20", "Jeep Compass"]);

    await escolherOpcao(usuario, ordem, "Menor km");
    expect(titulosDosCarros()).toEqual(["Jeep Compass", "Chevrolet Onix", "Hyundai HB20"]);
  });

  it("busca sem diferenciar acentos, filtra por marca e limpa tudo quando nada aparece", async () => {
    const { usuario } = await abrirVitrine();
    const busca = screen.getByRole("searchbox", { name: "Buscar veículos" });
    expect(busca).toHaveAttribute("placeholder", "O que você procura?");

    await usuario.type(busca, "automatico");
    expect(titulosDosCarros()).toEqual(["Jeep Compass", "Chevrolet Onix"]);

    await usuario.clear(busca);
    const marcas = grupo("Filtrar por marca");
    expect(opcoesDoGrupo("Filtrar por marca")).toEqual(["Todas", "Chevrolet", "Hyundai", "Jeep"]);
    expect(within(marcas).getByRole("button", { name: "Todas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await usuario.click(within(marcas).getByRole("button", { name: "Hyundai" }));
    expect(titulosDosCarros()).toEqual(["Hyundai HB20"]);
    expect(within(marcas).getByRole("button", { name: "Hyundai" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(marcas).getByRole("button", { name: "Todas" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
    expect(screen.getByText("veículos disponíveis")).toHaveTextContent("2 veículos disponíveis");

    await usuario.type(busca, "ferrari");
    expect(screen.getByText("Nenhum veículo encontrado.")).toBeInTheDocument();
    expect(screen.getByText("Tente outra busca ou mude os filtros.")).toBeInTheDocument();
    expect(titulosDosCarros()).toEqual([]);

    await usuario.click(screen.getByRole("button", { name: "Limpar busca e filtros" }));
    expect(busca).toHaveValue("");
    expect(within(marcas).getByRole("button", { name: "Todas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(titulosDosCarros()).toEqual(["Jeep Compass", "Chevrolet Onix", "Hyundai HB20"]);
  });

  it("filtra por carroceria, câmbio e combustível, somando dentro do grupo e cruzando entre grupos", async () => {
    const { usuario } = await abrirVitrine();
    const filtros = screen.getByRole("button", { name: "Filtros" });
    expect(filtros).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Carroceria" })).not.toBeInTheDocument();

    await usuario.click(filtros);
    expect(filtros).toHaveAttribute("aria-expanded", "true");
    expect(opcoesDoGrupo("Carroceria")).toEqual(["Hatch", "SUV"]);
    expect(opcoesDoGrupo("Câmbio")).toEqual(["Manual", "Automático"]);
    expect(opcoesDoGrupo("Combustível")).toEqual(["Flex", "Diesel"]);
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ver 3 veículos" })).toBeInTheDocument();

    const hatch = within(grupo("Carroceria")).getByRole("button", { name: "Hatch" });
    expect(hatch).toHaveAttribute("aria-pressed", "false");
    await usuario.click(hatch);
    expect(hatch).toHaveAttribute("aria-pressed", "true");
    expect(titulosDosCarros()).toEqual(["Chevrolet Onix", "Hyundai HB20"]);
    expect(screen.getByRole("button", { name: "Filtros, 1 ativo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver 2 veículos" })).toBeInTheDocument();

    await usuario.click(within(grupo("Câmbio")).getByRole("button", { name: "Manual" }));
    expect(titulosDosCarros()).toEqual(["Hyundai HB20"]);
    expect(screen.getByRole("button", { name: "Filtros, 2 ativos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver 1 veículo" })).toBeInTheDocument();

    await usuario.click(within(grupo("Câmbio")).getByRole("button", { name: "Automático" }));
    expect(titulosDosCarros()).toEqual(["Chevrolet Onix", "Hyundai HB20"]);

    const diesel = within(grupo("Combustível")).getByRole("button", { name: "Diesel" });
    await usuario.click(diesel);
    expect(screen.getByText("Nenhum veículo encontrado.")).toBeInTheDocument();
    await usuario.click(diesel);
    expect(diesel).toHaveAttribute("aria-pressed", "false");
    expect(titulosDosCarros()).toEqual(["Chevrolet Onix", "Hyundai HB20"]);

    await usuario.click(screen.getByRole("button", { name: "Ver 2 veículos" }));
    expect(screen.getByRole("button", { name: "Filtros, 3 ativos" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("group", { name: "Carroceria" })).not.toBeInTheDocument();

    const marcas = grupo("Filtrar por marca");
    await usuario.click(within(marcas).getByRole("button", { name: "Hyundai" }));
    await usuario.click(screen.getByRole("button", { name: "Filtros, 3 ativos" }));
    await usuario.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
    expect(within(grupo("Carroceria")).getByRole("button", { name: "Hatch" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(within(marcas).getByRole("button", { name: "Hyundai" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(titulosDosCarros()).toEqual(["Hyundai HB20"]);
  });

  it("filtra por preço máximo, ano mínimo e km máximo com limites que separam os carros", async () => {
    const { usuario } = await abrirVitrine();
    await usuario.click(screen.getByRole("button", { name: "Filtros" }));
    const preco = screen.getByRole("combobox", { name: "Preço" });
    const ano = screen.getByRole("combobox", { name: "Ano" });
    const km = screen.getByRole("combobox", { name: "Quilometragem" });

    expect(await lerOpcoes(usuario, preco)).toEqual(["Qualquer preço", "Até R$\u00a070.000"]);
    expect(await lerOpcoes(usuario, ano)).toEqual([
      "Qualquer ano",
      "A partir de 2023",
      "A partir de 2021",
    ]);
    expect(await lerOpcoes(usuario, km)).toEqual(["Qualquer km", "Até 30.000 km", "Até 50.000 km"]);

    await escolherOpcao(usuario, preco, "Até R$\u00a070.000");
    expect(preco.textContent).toBe("Até R$\u00a070.000");
    expect(titulosDosCarros()).toEqual(["Hyundai HB20"]);
    expect(screen.getByRole("button", { name: "Filtros, 1 ativo" })).toBeInTheDocument();

    await escolherOpcao(usuario, preco, "Qualquer preço");
    expect(titulosDosCarros()).toEqual(["Jeep Compass", "Chevrolet Onix", "Hyundai HB20"]);
    expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();

    await escolherOpcao(usuario, ano, "A partir de 2021");
    expect(titulosDosCarros()).toEqual(["Jeep Compass", "Chevrolet Onix"]);

    await escolherOpcao(usuario, km, "Até 30.000 km");
    expect(titulosDosCarros()).toEqual(["Jeep Compass"]);
    expect(screen.getByRole("button", { name: "Filtros, 2 ativos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver 1 veículo" })).toBeInTheDocument();
  });

  it("esconde os filtros que não separam nenhum carro", async () => {
    const usuario = userEvent.setup();
    simularVitrine({
      "GET /api/showroom/cars": {
        carros: [
          ONIX,
          carroPublico({
            slug: "chevrolet-onix-2019-c2",
            anoFabricacao: 2019,
            anoModelo: 2019,
            km: 90_000,
            preco: 6_000_000,
          }),
        ],
      },
    });
    renderizarRota("/catalogo");
    await screen.findAllByRole("heading", { name: "Chevrolet Onix" });

    expect(screen.queryByRole("group", { name: "Filtrar por marca" })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Filtros" }));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("combobox").map((campo) => campo.getAttribute("aria-label")),
    ).toEqual(["Ordenar por", "Preço", "Ano", "Quilometragem"]);
    expect(
      await lerOpcoes(usuario, screen.getByRole("combobox", { name: "Quilometragem" })),
    ).toEqual(["Qualquer km", "Até 50.000 km", "Até 80.000 km"]);
  });

  it("com um carro só, não mostra filtros e o cartão omite o que não foi informado", async () => {
    simularVitrine({
      "GET /api/showroom/cars": {
        carros: [
          carroPublico({
            versao: null,
            anoFabricacao: null,
            anoModelo: null,
            km: null,
            cambio: null,
          }),
        ],
      },
    });

    renderizarRota("/catalogo");

    const onix = await screen.findByRole("link", { name: /Chevrolet Onix/ });
    expect(onix).toHaveTextContent(/^Chevrolet OnixVer detalhes e preço →$/);
    expect(screen.queryByRole("button", { name: /Filtros/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filtrar por marca" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ordenar por" })).toBeInTheDocument();
    expect(screen.getByText("veículo disponível")).toHaveTextContent("1 veículo disponível");
  });

  it("mantém busca, filtros e ordem ao voltar de um carro e recomeça numa nova visita", async () => {
    const { usuario, router } = await abrirVitrine({
      "GET /api/showroom/cars/chevrolet-onix-2021-c1": { carro: ONIX },
    });
    await escolherOpcao(
      usuario,
      screen.getByRole("combobox", { name: "Ordenar por" }),
      "Maior preço",
    );
    await usuario.click(screen.getByRole("button", { name: "Filtros" }));
    await usuario.click(screen.getByRole("button", { name: "Hatch" }));
    await usuario.type(screen.getByRole("searchbox", { name: "Buscar veículos" }), "flex");
    expect(titulosDosCarros()).toEqual(["Chevrolet Onix", "Hyundai HB20"]);

    await usuario.click(screen.getByRole("link", { name: /Chevrolet Onix/ }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Chevrolet Onix" }),
    ).toBeInTheDocument();
    await usuario.click(screen.getByRole("link", { name: "Voltar ao catálogo" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Catálogo de veículos" }),
    ).toBeInTheDocument();
    expect(router.state.historyAction).toBe("POP");
    expect(screen.getByRole("searchbox", { name: "Buscar veículos" })).toHaveValue("flex");
    expect(screen.getByRole("combobox", { name: "Ordenar por" })).toHaveTextContent("Maior preço");
    expect(screen.getByRole("button", { name: "Filtros, 1 ativo" })).toBeInTheDocument();
    expect(titulosDosCarros()).toEqual(["Chevrolet Onix", "Hyundai HB20"]);

    await act(() => router.navigate("/"));
    await usuario.click(await screen.findByRole("link", { name: "Ver catálogo" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Catálogo de veículos" }),
    ).toBeInTheDocument();
    expect(router.state.historyAction).toBe("PUSH");
    expect(screen.getByRole("searchbox", { name: "Buscar veículos" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Ordenar por" })).toHaveTextContent("Destaques");
    expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
    expect(titulosDosCarros()).toEqual(["Jeep Compass", "Chevrolet Onix", "Hyundai HB20"]);
  });

  it("mostra o carregamento e avisa quando ainda não há carro publicado", async () => {
    let responder: (resposta: unknown) => void = () => undefined;
    simularVitrine({
      "GET /api/showroom/cars": () =>
        new Promise((resolver) => {
          responder = resolver;
        }),
    });

    renderizarRota("/catalogo");

    expect(await screen.findByRole("status")).toHaveTextContent("Carregando veículos…");
    expect(screen.queryByText(/disponíve(l|is)$/)).not.toBeInTheDocument();
    responder({ carros: [] });
    expect(await screen.findByText("Em breve, novos veículos por aqui.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("veículos disponíveis")).toHaveTextContent("0 veículos disponíveis");
    expect(screen.queryByRole("button", { name: /Filtros/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filtrar por marca" })).not.toBeInTheDocument();
  });

  it("avisa a falha ao carregar os carros e tenta de novo", async () => {
    const usuario = userEvent.setup();
    const rotas: RotasSimuladas = {
      "GET /api/showroom/store": { loja: LOJA_PUBLICA },
      "GET /api/showroom/cars": respostaDeErro(500, "erro_interno", "Erro interno."),
    };
    simularApi(rotas);

    renderizarRota("/catalogo");

    expect(await screen.findByText("Não foi possível carregar os veículos.")).toBeInTheDocument();
    expect(screen.getByText("Erro interno.")).toBeInTheDocument();
    expect(screen.queryByText(/disponíve(l|is)$/)).not.toBeInTheDocument();

    rotas["GET /api/showroom/cars"] = { carros: [ONIX] };
    await usuario.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("heading", { name: "Chevrolet Onix" })).toBeInTheDocument();
    expect(screen.getByText("veículo disponível")).toHaveTextContent("1 veículo disponível");
  });

  it("usa os dados padrão da loja quando a configuração não carrega", async () => {
    simularVitrine({
      "GET /api/showroom/store": respostaDeErro(500, "erro_interno", "Erro interno."),
    });

    renderizarRota("/catalogo");

    expect(await screen.findByRole("heading", { name: "Jeep Compass" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Globo Motors" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "WhatsApp" })).not.toBeInTheDocument();
    expect(screen.queryByText("·")).not.toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent(/^Globo Motors$/);
    await waitFor(() => expect(document.title).toBe("Catálogo de veículos · Globo Motors"));
  });
});
