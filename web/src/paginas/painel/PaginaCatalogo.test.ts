import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { jsPDF } from "jspdf";
import { describe, expect, it, vi } from "vitest";
import { gerarCatalogoPdf } from "../../lib/pdf.ts";
import { carroPainel, clienteComDesejos, LOJA, rotasDoPainel } from "../../testes/dados.ts";
import { renderizarRota } from "../../testes/renderizar.tsx";
import { escolherOpcao, lerOpcoes } from "../../testes/selecao.ts";
import { respostaDeErro, simularApi, type RotasSimuladas } from "../../testes/simularApi.ts";

vi.mock("../../lib/pdf.ts", () => ({ gerarCatalogoPdf: vi.fn() }));

const ONIX = carroPainel();
const HB20 = carroPainel({
  id: "c2",
  slug: "hyundai-hb20-2019-h1",
  marca: "Hyundai",
  modelo: "HB20",
  versao: "Comfort",
  anoFabricacao: 2019,
  anoModelo: 2019,
  km: 80_000,
  cambio: "Manual",
  cor: "Branco",
  status: "reservado",
  destaque: true,
  fotos: [
    { id: "f1", url: "/api/dashboard/photos/f1" },
    { id: "f2", url: "/api/dashboard/photos/f2" },
  ],
  precoVenda: 5_500_000,
  margem: 400_000,
  placa: "HBZ2E34",
  diasEmEstoque: 1,
  interessados: 2,
  vendedorNome: "Marcos Pereira",
  vendedorTelefone: "11977776666",
});
const COMPASS = carroPainel({
  id: "c3",
  slug: "jeep-compass-2023-j1",
  marca: "Jeep",
  modelo: "Compass",
  versao: "Longitude",
  anoFabricacao: 2022,
  anoModelo: 2023,
  km: 15_000,
  cor: "Preto",
  status: "vendido",
  precoVenda: 14_500_000,
  margem: 1_800_000,
  placa: "JEP3F45",
  interessados: 1,
  vendidoEm: "2026-10-25T18:00:00.000Z",
});
const KWID = carroPainel({
  id: "c4",
  slug: "renault-kwid-2020-r1",
  marca: "Renault",
  modelo: "Kwid",
  versao: null,
  anoFabricacao: 2020,
  anoModelo: 2020,
  km: null,
  cambio: null,
  status: "rascunho",
  precoVenda: null,
  margem: null,
  placa: null,
  diasEmEstoque: 0,
  vendedorNome: null,
  vendedorTelefone: null,
});
const CARROS = [ONIX, HB20, COMPASS, KWID];
const FORA_DA_SELECAO = { ignore: "[role=combobox] *, [role=option]" };

function simularCatalogo(rotas: RotasSimuladas = {}) {
  const todas = rotasDoPainel({
    "GET /api/dashboard/store": { loja: { ...LOJA, nome: "Auto Center Campinas" } },
    "GET /api/dashboard/cars": { carros: CARROS },
    ...rotas,
  });
  return { ...simularApi(todas), rotas: todas };
}

async function abrirCatalogo() {
  renderizarRota("/dashboard/cars");
  await screen.findByText("Auto Center Campinas");
  return screen.findByRole("article", { name: "Chevrolet Onix" });
}

function titulosDosCarros() {
  return screen.queryAllByRole("heading", { level: 2 }).map((titulo) => titulo.textContent);
}

function numeros() {
  const valores = screen.getAllByRole("definition").map((valor) => valor.textContent);
  return Object.fromEntries(
    screen.getAllByRole("term").map((termo, indice) => [termo.textContent, valores[indice]]),
  );
}

function cartao(titulo: string) {
  return screen.getByRole("article", { name: titulo });
}

describe("PaginaCatalogo", () => {
  it("mostra os números do estoque e cada carro com os dados internos, dois por linha", async () => {
    const usuario = userEvent.setup();
    simularCatalogo();

    const onix = await abrirCatalogo();

    expect(screen.getByRole("heading", { level: 1, name: "Veículos" })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Veículos · Painel"));
    expect(numeros()).toEqual({
      "No catálogo": "4",
      Disponíveis: "1",
      Reservados: "1",
      Vendidos: "1",
      Rascunhos: "1",
      "Valor em estoque": "R$\u00a0144.900",
    });
    expect(titulosDosCarros()).toEqual([
      "Chevrolet Onix",
      "Hyundai HB20",
      "Jeep Compass",
      "Renault Kwid",
    ]);
    expect(onix.closest("ul")).toHaveClass("grid-cols-2");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();

    expect(within(onix).getByText("Disponível", FORA_DA_SELECAO)).toBeInTheDocument();
    expect(within(onix).getByRole("img", { name: "Sem foto" })).toBeInTheDocument();
    expect(within(onix).queryByText("Destaque")).not.toBeInTheDocument();
    expect(within(onix).queryByText("fotos")).not.toBeInTheDocument();
    expect(within(onix).getByText("2020/2021")).toBeInTheDocument();
    expect(within(onix).getByText("1.0 Turbo LTZ")).toBeInTheDocument();
    expect(within(onix).getByText("42.000 km · Automático")).toBeInTheDocument();
    expect(within(onix).getByText("R$ 89.900")).toBeInTheDocument();
    expect(within(onix).getByText("Vendedor: Auto Lima Multimarcas")).toBeInTheDocument();
    expect(
      within(onix).getByText("ABC1D23 · Margem R$ 12.400 · 29 dias em estoque"),
    ).toBeInTheDocument();
    const status = within(onix).getByRole("combobox", { name: "Status" });
    expect(status).toHaveTextContent("Disponível");
    expect(await lerOpcoes(usuario, status)).toEqual([
      "Rascunho",
      "Disponível",
      "Reservado",
      "Vendido",
    ]);
    expect(within(onix).getByRole("link", { name: "Editar" })).toHaveAttribute(
      "href",
      "/dashboard/cars/c1",
    );
    expect(within(onix).getByRole("button", { name: "Ficha" })).toHaveAttribute(
      "title",
      "Copiar ficha para WhatsApp",
    );
    expect(within(onix).getByRole("button", { name: "Excluir" })).toBeInTheDocument();

    const hb20 = cartao("Hyundai HB20");
    expect(within(hb20).getByText("Reservado", FORA_DA_SELECAO)).toBeInTheDocument();
    expect(within(hb20).getByText("Destaque")).toBeInTheDocument();
    expect(within(hb20).getByText("fotos").parentElement).toHaveTextContent(/^2 fotos$/);
    expect(within(hb20).getByRole("presentation")).toHaveAttribute(
      "src",
      "/api/dashboard/photos/f1",
    );
    expect(within(hb20).getByText("2019")).toBeInTheDocument();
    expect(within(hb20).getByText("Vendedor: Marcos Pereira")).toBeInTheDocument();
    expect(
      within(hb20).getByText("HBZ2E34 · Margem R$ 4.000 · 1 dia em estoque · 2 interessados"),
    ).toBeInTheDocument();

    expect(
      within(cartao("Jeep Compass")).getByText("JEP3F45 · Margem R$ 18.000 · 1 interessado"),
    ).toBeInTheDocument();

    const kwid = cartao("Renault Kwid");
    expect(within(kwid).getByText("Rascunho", FORA_DA_SELECAO)).toBeInTheDocument();
    expect(within(kwid).getByText("Sem preço")).toBeInTheDocument();
    expect(within(kwid).getByText("2020")).toBeInTheDocument();
    expect(within(kwid).getByText("0 dias em estoque")).toBeInTheDocument();
    expect(within(kwid).queryByText(/Vendedor/)).not.toBeInTheDocument();
    expect(within(kwid).queryByText(/km|·/)).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Adicionar veículo" })).toHaveAttribute(
      "href",
      "/dashboard/cars/new",
    );
    expect(document.body).not.toHaveTextContent("—");
  });

  it("mostra R$ 0 em estoque, sem traço, quando todos os carros foram vendidos", async () => {
    simularCatalogo({ "GET /api/dashboard/cars": { carros: [COMPASS] } });

    renderizarRota("/dashboard/cars");

    await screen.findByRole("article", { name: "Jeep Compass" });
    expect(numeros()).toMatchObject({ Vendidos: "1", "Valor em estoque": "R$\u00a00" });
    expect(document.body).not.toHaveTextContent("—");
  });

  it("busca pela placa e pelo vendedor e filtra por marca e status, avisando quando nada combina", async () => {
    const usuario = userEvent.setup();
    simularCatalogo();
    await abrirCatalogo();
    const busca = screen.getByRole("searchbox", { name: "Buscar no catálogo" });
    const marca = screen.getByRole("combobox", { name: "Filtrar por marca" });
    const status = screen.getByRole("combobox", { name: "Filtrar por status" });
    expect(busca).toHaveAttribute("placeholder", "Buscar por marca, modelo, placa, vendedor…");
    expect(marca).toHaveTextContent("Todas as marcas");
    expect(status).toHaveTextContent("Todos os status");

    await usuario.type(busca, "hbz2");
    expect(titulosDosCarros()).toEqual(["Hyundai HB20"]);

    await usuario.clear(busca);
    await usuario.type(busca, "lima");
    expect(titulosDosCarros()).toEqual(["Chevrolet Onix", "Jeep Compass"]);

    await usuario.clear(busca);
    await usuario.type(busca, "marcos");
    expect(titulosDosCarros()).toEqual(["Hyundai HB20"]);

    await usuario.clear(busca);
    expect(await lerOpcoes(usuario, marca)).toEqual([
      "Todas as marcas",
      "Chevrolet",
      "Hyundai",
      "Jeep",
      "Renault",
    ]);
    expect(await lerOpcoes(usuario, status)).toEqual([
      "Todos os status",
      "Rascunho",
      "Disponível",
      "Reservado",
      "Vendido",
    ]);
    await escolherOpcao(usuario, status, "Vendido");
    expect(status).toHaveTextContent("Vendido");
    expect(titulosDosCarros()).toEqual(["Jeep Compass"]);
    expect(numeros()).toMatchObject({ "No catálogo": "4" });

    await escolherOpcao(usuario, marca, "Chevrolet");
    expect(screen.getByRole("heading", { level: 2, name: "Nada encontrado" })).toBeInTheDocument();
    expect(screen.getByText("Nenhum veículo corresponde aos filtros.")).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(titulosDosCarros()).toHaveLength(4);
    expect(marca).toHaveTextContent("Todas as marcas");
    expect(status).toHaveTextContent("Todos os status");
    expect(busca).toHaveValue("");
  });

  it("ordena por preço, ano e quilometragem, deixando quem não tem o dado no fim", async () => {
    const usuario = userEvent.setup();
    simularCatalogo();
    await abrirCatalogo();
    const ordem = screen.getByRole("combobox", { name: "Ordenar por" });
    expect(ordem).toHaveTextContent("Mais recentes");
    expect(await lerOpcoes(usuario, ordem)).toEqual([
      "Mais recentes",
      "Menor preço",
      "Maior preço",
      "Mais novos",
      "Menor km",
    ]);

    await escolherOpcao(usuario, ordem, "Menor preço");
    expect(titulosDosCarros()).toEqual([
      "Hyundai HB20",
      "Chevrolet Onix",
      "Jeep Compass",
      "Renault Kwid",
    ]);

    await escolherOpcao(usuario, ordem, "Maior preço");
    expect(titulosDosCarros()).toEqual([
      "Jeep Compass",
      "Chevrolet Onix",
      "Hyundai HB20",
      "Renault Kwid",
    ]);

    await escolherOpcao(usuario, ordem, "Mais novos");
    expect(titulosDosCarros()).toEqual([
      "Jeep Compass",
      "Chevrolet Onix",
      "Renault Kwid",
      "Hyundai HB20",
    ]);

    await escolherOpcao(usuario, ordem, "Menor km");
    expect(titulosDosCarros()).toEqual([
      "Jeep Compass",
      "Chevrolet Onix",
      "Hyundai HB20",
      "Renault Kwid",
    ]);
    expect(ordem).toHaveTextContent("Menor km");
  });

  it("separa scooters, motos elétricas e patinetes em abas e os deixa sempre depois dos carros", async () => {
    const usuario = userEvent.setup();
    const pcx = carroPainel({
      id: "c5",
      slug: "honda-pcx-160-2025-p1",
      marca: "Honda",
      modelo: "PCX 160",
      carroceria: "Scooter",
      precoVenda: 2_000_000,
      placa: "PCX1A23",
    });
    const voltz = carroPainel({
      id: "c6",
      slug: "voltz-evs-2025-v1",
      marca: "Voltz",
      modelo: "EVS",
      carroceria: "Moto elétrica",
      combustivel: "Elétrico",
      status: "rascunho",
      precoVenda: 1_800_000,
      placa: "VTZ2B34",
    });
    const segway = carroPainel({
      id: "c7",
      slug: "segway-ninebot-2025-s1",
      marca: "Segway",
      modelo: "Ninebot",
      carroceria: "Patinete",
      combustivel: "Elétrico",
      cambio: null,
      precoVenda: 400_000,
      placa: null,
    });
    simularCatalogo({
      "GET /api/dashboard/cars": { carros: [pcx, ONIX, voltz, HB20, segway, COMPASS, KWID] },
    });
    await abrirCatalogo();

    const abas = within(screen.getByRole("tablist", { name: "Tipos de veículo" })).getAllByRole(
      "tab",
    );
    expect(abas.map((aba) => aba.textContent)).toEqual([
      "Todos",
      "Carros",
      "Scooters",
      "Motos elétricas",
      "Patinetes",
    ]);
    expect(screen.getByRole("tab", { name: "Todos" })).toHaveAttribute("aria-selected", "true");
    expect(numeros()["No catálogo"]).toBe("7");
    expect(titulosDosCarros()).toEqual([
      "Chevrolet Onix",
      "Hyundai HB20",
      "Jeep Compass",
      "Renault Kwid",
      "Honda PCX 160",
      "Voltz EVS",
      "Segway Ninebot",
    ]);

    const ordem = screen.getByRole("combobox", { name: "Ordenar por" });
    await escolherOpcao(usuario, ordem, "Menor preço");
    expect(titulosDosCarros()).toEqual([
      "Hyundai HB20",
      "Chevrolet Onix",
      "Jeep Compass",
      "Renault Kwid",
      "Segway Ninebot",
      "Voltz EVS",
      "Honda PCX 160",
    ]);

    const marca = screen.getByRole("combobox", { name: "Filtrar por marca" });
    await escolherOpcao(usuario, marca, "Honda");
    expect(titulosDosCarros()).toEqual(["Honda PCX 160"]);

    await usuario.click(screen.getByRole("tab", { name: "Patinetes" }));
    expect(screen.getByRole("tab", { name: "Patinetes" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Patinetes" })).toContainElement(marca);
    expect(titulosDosCarros()).toEqual(["Segway Ninebot"]);
    expect(marca).toHaveTextContent("Todas as marcas");
    expect(await lerOpcoes(usuario, marca)).toEqual(["Todas as marcas", "Segway"]);
    expect(ordem).toHaveTextContent("Menor preço");
    expect(numeros()["No catálogo"]).toBe("7");

    await usuario.click(screen.getByRole("tab", { name: "Motos elétricas" }));
    expect(titulosDosCarros()).toEqual(["Voltz EVS"]);
    expect(await lerOpcoes(usuario, marca)).toEqual(["Todas as marcas", "Voltz"]);
  });

  it("separa carros e motos em abas, com as scooters fora da aba Motos", async () => {
    const usuario = userEvent.setup();
    const cg = carroPainel({
      id: "c5",
      slug: "honda-cg-160-2023-h2",
      marca: "Honda",
      modelo: "CG 160",
      carroceria: "Moto",
    });
    const pcx = carroPainel({
      id: "c6",
      slug: "honda-pcx-160-2025-p1",
      marca: "Honda",
      modelo: "PCX 160",
      carroceria: "Scooter",
    });
    const uno = carroPainel({
      id: "c7",
      slug: "fiat-uno-2015-f1",
      marca: "Fiat",
      modelo: "Uno",
      carroceria: null,
    });
    simularCatalogo({ "GET /api/dashboard/cars": { carros: [cg, ONIX, pcx, uno, COMPASS] } });
    await abrirCatalogo();

    const abas = within(screen.getByRole("tablist", { name: "Tipos de veículo" })).getAllByRole(
      "tab",
    );
    expect(abas.map((aba) => aba.textContent)).toEqual(["Todos", "Carros", "Motos", "Scooters"]);
    const marca = screen.getByRole("combobox", { name: "Filtrar por marca" });

    await usuario.click(screen.getByRole("tab", { name: "Motos" }));
    expect(screen.getByRole("tab", { name: "Motos" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Motos" })).toContainElement(marca);
    expect(titulosDosCarros()).toEqual(["Honda CG 160"]);
    expect(await lerOpcoes(usuario, marca)).toEqual(["Todas as marcas", "Honda"]);

    await usuario.click(screen.getByRole("tab", { name: "Carros" }));
    expect(titulosDosCarros()).toEqual(["Chevrolet Onix", "Fiat Uno", "Jeep Compass"]);
    expect(await lerOpcoes(usuario, marca)).toEqual([
      "Todas as marcas",
      "Chevrolet",
      "Fiat",
      "Jeep",
    ]);
    expect(numeros()["No catálogo"]).toBe("5");
  });

  it("muda o status na hora, avisa quando a API confirma e atualiza os números", async () => {
    const usuario = userEvent.setup();
    let responder: (resposta: unknown) => void = () => undefined;
    const { rotas, corpos } = simularCatalogo({
      "PATCH /api/dashboard/cars/c1/status": () =>
        new Promise((resolver) => {
          responder = resolver;
        }),
    });
    const onix = await abrirCatalogo();
    const status = within(onix).getByRole("combobox", { name: "Status" });

    await escolherOpcao(usuario, status, "Reservado");

    await waitFor(() => expect(numeros()).toMatchObject({ Disponíveis: "0", Reservados: "2" }));
    expect(status).toHaveTextContent("Reservado");
    expect(within(onix).getByText("Reservado", FORA_DA_SELECAO)).toBeInTheDocument();
    expect(corpos("PATCH /api/dashboard/cars/c1/status")).toEqual([{ status: "reservado" }]);

    const reservado = { ...ONIX, status: "reservado" as const };
    rotas["GET /api/dashboard/cars"] = { carros: [reservado, HB20, COMPASS, KWID] };
    responder({ carro: reservado, possiveisInteressados: 0 });

    expect(await screen.findByRole("status")).toHaveTextContent("Status alterado para Reservado.");
    expect(status).toHaveTextContent("Reservado");
  });

  it("avisa quantos clientes têm possível interesse quando o veículo entra no catálogo", async () => {
    const usuario = userEvent.setup();
    const { rotas, corpos } = simularCatalogo({
      "PATCH /api/dashboard/cars/c4/status": () => {
        const publicado = { ...KWID, status: "disponivel" as const };
        rotas["GET /api/dashboard/cars"] = { carros: [ONIX, HB20, COMPASS, publicado] };
        rotas["GET /api/dashboard/wishes"] = {
          clientes: [
            clienteComDesejos({ possivelDesde: "2026-11-04T12:00:00.000Z" }),
            clienteComDesejos({
              cliente: { id: "k2", nome: "Bruno Lima", telefone: "19933334444" },
              possivelDesde: "2026-11-04T12:00:00.000Z",
            }),
          ],
        };
        return { carro: publicado, possiveisInteressados: 2 };
      },
    });
    await abrirCatalogo();

    await escolherOpcao(
      usuario,
      within(cartao("Renault Kwid")).getByRole("combobox", { name: "Status" }),
      "Disponível",
    );

    expect(
      await screen.findByText(
        "2 clientes têm possível interesse no veículo Renault Kwid. Veja em Interesses.",
      ),
    ).toHaveAttribute("role", "status");
    expect(screen.getByText("Status alterado para Disponível.")).toHaveAttribute("role", "status");
    expect(corpos("PATCH /api/dashboard/cars/c4/status")).toEqual([{ status: "disponivel" }]);
    expect(
      await screen.findByRole("link", { name: "Interesses (2 clientes com possível interesse)" }),
    ).toHaveAttribute("href", "/dashboard/wishlist");
  });

  it("não chama a API quando o status escolhido é o mesmo", async () => {
    const usuario = userEvent.setup();
    const { chaves } = simularCatalogo();
    const onix = await abrirCatalogo();

    await escolherOpcao(
      usuario,
      within(onix).getByRole("combobox", { name: "Status" }),
      "Disponível",
    );

    expect(chaves().filter((chave) => !chave.startsWith("GET"))).toEqual([]);
  });

  it("desfaz a mudança de status e avisa quando a API recusa", async () => {
    const usuario = userEvent.setup();
    simularCatalogo({
      "PATCH /api/dashboard/cars/c1/status": respostaDeErro(
        404,
        "nao_encontrado",
        "Veículo não encontrado.",
      ),
    });
    const onix = await abrirCatalogo();
    const status = within(onix).getByRole("combobox", { name: "Status" });

    await escolherOpcao(usuario, status, "Vendido");

    expect(await screen.findByRole("alert")).toHaveTextContent("Veículo não encontrado.");
    expect(status).toHaveTextContent("Disponível");
    expect(numeros()).toMatchObject({ Disponíveis: "1", Vendidos: "1" });
  });

  it("copia a ficha com o link do catálogo só para carro disponível e sem o vendedor", async () => {
    const usuario = userEvent.setup();
    simularCatalogo();
    const onix = await abrirCatalogo();

    await usuario.click(within(onix).getByRole("button", { name: "Ficha" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Ficha copiada. É só colar no WhatsApp.",
    );
    const ficha = await navigator.clipboard.readText();
    expect(ficha).toContain("*Chevrolet Onix 1.0 Turbo LTZ*");
    expect(ficha).toContain(`${window.location.origin}/catalogo/chevrolet-onix-2021-c1`);
    expect(ficha.split("\n").at(-1)).toBe("Auto Center Campinas · WhatsApp (11) 98765-4321");
    expect(ficha).not.toContain("—");
    expect(ficha).not.toContain("ABC1D23");
    expect(ficha).not.toMatch(/Auto Lima|62988887777|\(62\)/);

    for (const titulo of ["Hyundai HB20", "Jeep Compass", "Renault Kwid"]) {
      await usuario.click(within(cartao(titulo)).getByRole("button", { name: "Ficha" }));
      const semLink = await navigator.clipboard.readText();
      expect(semLink).toContain(`*${titulo}`);
      expect(semLink).not.toContain("/catalogo/");
    }
  });

  it("mostra a ficha para copiar à mão quando o navegador não deixa copiar", async () => {
    const usuario = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Permissão negada"));
    simularCatalogo();
    const onix = await abrirCatalogo();

    await usuario.click(within(onix).getByRole("button", { name: "Ficha" }));

    const dialogo = await screen.findByRole("dialog", { name: "Ficha do veículo" });
    expect(
      within(dialogo).getByText(
        "Não foi possível copiar automaticamente. Selecione e copie o texto abaixo:",
      ),
    ).toBeInTheDocument();
    const texto = within(dialogo).getByRole("textbox", { name: "Texto da ficha" });
    expect(texto).toHaveFocus();
    expect((texto as HTMLTextAreaElement).value).toContain("*Chevrolet Onix 1.0 Turbo LTZ*");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await usuario.click(within(onix).getByRole("button", { name: "Ficha" }));
    await usuario.click(await screen.findByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("pede confirmação antes de excluir e tira o carro da lista", async () => {
    const usuario = userEvent.setup();
    const { rotas, chaves } = simularCatalogo({
      "DELETE /api/dashboard/cars/c1": () => {
        rotas["GET /api/dashboard/cars"] = { carros: [HB20, COMPASS, KWID] };
        return new Response(null, { status: 204 });
      },
    });
    const onix = await abrirCatalogo();

    await usuario.click(within(onix).getByRole("button", { name: "Excluir" }));
    const confirmacao = within(onix).getByRole("group", { name: "Excluir este veículo?" });
    await usuario.click(within(confirmacao).getByRole("button", { name: "Não" }));
    expect(within(onix).queryByRole("group")).not.toBeInTheDocument();
    expect(chaves()).not.toContain("DELETE /api/dashboard/cars/c1");

    await usuario.click(within(onix).getByRole("button", { name: "Excluir" }));
    await usuario.click(within(onix).getByRole("button", { name: "Sim" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Veículo excluído do catálogo.");
    expect(chaves()).toContain("DELETE /api/dashboard/cars/c1");
    expect(titulosDosCarros()).toEqual(["Hyundai HB20", "Jeep Compass", "Renault Kwid"]);
    await waitFor(() => expect(numeros()).toMatchObject({ "No catálogo": "3" }));
  });

  it("avisa quando não consegue excluir e mantém o carro", async () => {
    const usuario = userEvent.setup();
    simularCatalogo({
      "DELETE /api/dashboard/cars/c1": respostaDeErro(500, "erro_interno", "Erro interno."),
    });
    const onix = await abrirCatalogo();

    await usuario.click(within(onix).getByRole("button", { name: "Excluir" }));
    await usuario.click(within(onix).getByRole("button", { name: "Sim" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno.");
    expect(titulosDosCarros()).toHaveLength(4);
  });

  it("gera o PDF do catálogo e salva com o nome do arquivo", async () => {
    const usuario = userEvent.setup();
    const salvar = vi.fn();
    let concluir: () => void = () => undefined;
    vi.mocked(gerarCatalogoPdf).mockImplementation(
      () =>
        new Promise((resolver) => {
          concluir = () =>
            resolver({
              documento: { save: salvar } as unknown as jsPDF,
              nomeDoArquivo: "catalogo-auto-center-campinas-2026-10-30.pdf",
            });
        }),
    );
    simularCatalogo();
    await abrirCatalogo();

    await usuario.click(screen.getByRole("button", { name: "Baixar PDF" }));

    expect(await screen.findByRole("button", { name: "Gerando PDF…" })).toBeDisabled();
    concluir();
    await waitFor(() =>
      expect(salvar).toHaveBeenCalledWith("catalogo-auto-center-campinas-2026-10-30.pdf"),
    );
    expect(await screen.findByRole("button", { name: "Baixar PDF" })).toBeEnabled();
  });

  it("avisa quando o PDF não pode ser gerado", async () => {
    const usuario = userEvent.setup();
    vi.mocked(gerarCatalogoPdf).mockRejectedValue(
      new Error("Não há veículos publicados no catálogo para exportar."),
    );
    simularCatalogo();
    await abrirCatalogo();

    await usuario.click(screen.getByRole("button", { name: "Baixar PDF" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não há veículos publicados no catálogo para exportar.",
    );
    expect(screen.getByRole("button", { name: "Baixar PDF" })).toBeEnabled();
  });

  it("convida a cadastrar o primeiro carro quando o catálogo está vazio", async () => {
    simularCatalogo({ "GET /api/dashboard/cars": { carros: [] } });

    renderizarRota("/dashboard/cars");

    expect(
      await screen.findByRole("heading", { name: "Seu catálogo está vazio" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cadastre o primeiro veículo. Ele entra como rascunho e só vai para o catálogo quando você publicar.",
      ),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: "Adicionar veículo" })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/dashboard/cars/new", "/dashboard/cars/new"]);
    expect(screen.queryByRole("term")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("mostra o carregamento, avisa a falha e tenta de novo", async () => {
    const usuario = userEvent.setup();
    let responder: (resposta: unknown) => void = () => undefined;
    const { rotas } = simularCatalogo({
      "GET /api/dashboard/cars": () =>
        new Promise((resolver) => {
          responder = resolver;
        }),
    });

    renderizarRota("/dashboard/cars");

    await screen.findByRole("heading", { level: 1, name: "Veículos" });
    expect(screen.getByRole("status")).toHaveTextContent("Carregando…");
    responder(respostaDeErro(500, "erro_interno", "Erro interno."));
    expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno.");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

    rotas["GET /api/dashboard/cars"] = { carros: [ONIX] };
    await usuario.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("article", { name: "Chevrolet Onix" })).toBeInTheDocument();
    expect(numeros()).toMatchObject({ "No catálogo": "1" });
  });
});
