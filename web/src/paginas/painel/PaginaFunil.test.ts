import type { Interesse } from "@globomotors/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { interesse, rotasDoPainel } from "../../testes/dados.ts";
import { renderizarRota } from "../../testes/renderizar.tsx";
import { escolherOpcao, lerOpcoes } from "../../testes/selecao.ts";
import {
  respostaDeErro,
  simularApi,
  type RequisicaoSimulada,
  type RotasSimuladas,
} from "../../testes/simularApi.ts";

type MudancaDeEtapa = Pick<Interesse, "etapa" | "motivoPerda">;

const ANA = interesse();
const BRUNO = interesse({
  id: "i2",
  cliente: { id: "k2", nome: "Bruno Lima", telefone: "1933334444" },
});
const CARLA = interesse({
  id: "i3",
  etapa: "proposta",
  cliente: { id: "k3", nome: "Carla Dias", telefone: "62999990000" },
  carro: {
    id: "c2",
    marca: "Fiat",
    modelo: "Pulse",
    versao: "Drive 1.3",
    anoModelo: 2023,
    status: "reservado",
    capa: "/api/dashboard/photos/f1",
  },
});
const DIEGO = interesse({
  id: "i4",
  etapa: "perdido",
  motivoPerda: "Comprou em outra loja",
  cliente: { id: "k4", nome: "Diego Rocha", telefone: "21987650000" },
  carro: {
    id: "c4",
    marca: "Honda",
    modelo: "Fit",
    versao: null,
    anoModelo: null,
    status: "disponivel",
    capa: null,
  },
});
const TODOS = [ANA, BRUNO, CARLA, DIEGO];
const ETAPAS = [
  "Novo",
  "Em contato",
  "Visita agendada",
  "Proposta",
  "Negociação",
  "Vendido",
  "Perdido",
];

function simularFunil(rotas: RotasSimuladas = {}) {
  const todas = rotasDoPainel({
    "GET /api/dashboard/interests": { interesses: TODOS },
    ...rotas,
  });
  return { ...simularApi(todas), rotas: todas };
}

function simularMudanca(id: string, montar: (atualizado: Interesse) => Interesse[]) {
  const original = TODOS.find((item) => item.id === id);
  if (!original) throw new Error(`Interesse ${id} não existe.`);
  const api = simularFunil({
    [`PATCH /api/dashboard/interests/${id}`]: ({ corpo }: RequisicaoSimulada) => {
      const atualizado = { ...original, ...(corpo as MudancaDeEtapa) };
      api.rotas["GET /api/dashboard/interests"] = { interesses: montar(atualizado) };
      return { interesse: atualizado };
    },
  });
  return api;
}

function quadro() {
  return screen.queryAllByRole("region").map((secao) => [
    within(secao).getByRole("heading", { level: 2 }).textContent,
    ...within(secao)
      .queryAllByRole("article")
      .map((cartao) => within(cartao).getAllByRole("link")[0]?.textContent),
  ]);
}

function chips() {
  return within(screen.getByRole("group", { name: "Filtrar por etapa" }))
    .getAllByRole("button")
    .map((chip) => chip.textContent);
}

function chipEscolhido() {
  return within(screen.getByRole("group", { name: "Filtrar por etapa" })).getByRole("button", {
    pressed: true,
  }).textContent;
}

function cartaoDe(nome: string) {
  const cartao = screen.getByRole("link", { name: nome }).closest("article");
  if (!cartao) throw new Error(`Cartão de ${nome} não encontrado.`);
  return cartao;
}

function etapaDe(nome: string, carro: string) {
  return screen.getByRole("combobox", { name: `Etapa de ${nome}, ${carro}` });
}

async function abrirFunil() {
  const renderizado = renderizarRota("/dashboard/funnel");
  await screen.findByRole("region", { name: /^Novo/ });
  return renderizado;
}

describe("PaginaFunil", () => {
  it("mostra os chips com a contagem de cada etapa e só as etapas que têm interesses", async () => {
    const usuario = userEvent.setup();
    const api = simularFunil();

    await abrirFunil();

    expect(screen.getByRole("heading", { level: 1, name: "Funil de vendas" })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Funil de vendas · Painel"));
    expect(chips()).toEqual([
      "Todas 4",
      "Novo 2",
      "Em contato 0",
      "Visita agendada 0",
      "Proposta 1",
      "Negociação 0",
      "Vendido 0",
      "Perdido 1",
    ]);
    expect(chipEscolhido()).toBe("Todas 4");
    expect(quadro()).toEqual([
      ["Novo 2", "Ana Souza", "Bruno Lima"],
      ["Proposta 1", "Carla Dias"],
      ["Perdido 1", "Diego Rocha"],
    ]);
    expect(api.chaves()).toContain("GET /api/dashboard/interests");
    expect(api.chaves().filter((chave) => chave.includes("interests?"))).toEqual([]);

    const carla = cartaoDe("Carla Dias");
    expect(
      within(carla)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Carla Dias", "/dashboard/customers/k3"],
      ["Fiat Pulse 2023", "/dashboard/cars/c2"],
      ["(62) 99999-0000", "https://wa.me/5562999990000"],
    ]);
    const whatsapp = within(carla).getByRole("link", { name: "(62) 99999-0000" });
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(whatsapp).toHaveAttribute("rel", "noreferrer");
    expect(within(carla).getByRole("presentation")).toHaveAttribute(
      "src",
      "/api/dashboard/photos/f1",
    );
    const etapaDaCarla = etapaDe("Carla Dias", "Fiat Pulse");
    expect(etapaDaCarla).toHaveTextContent("Proposta");
    expect(await lerOpcoes(usuario, etapaDaCarla)).toEqual(ETAPAS);
    expect(within(carla).queryByText(/^Motivo:/)).not.toBeInTheDocument();

    const diego = cartaoDe("Diego Rocha");
    expect(within(diego).getByRole("link", { name: "Honda Fit" })).toHaveAttribute(
      "href",
      "/dashboard/cars/c4",
    );
    expect(within(diego).getByRole("img", { name: "Sem foto" })).toBeInTheDocument();
    expect(within(diego).getByText("Motivo: Comprou em outra loja")).toBeInTheDocument();
    expect(etapaDe("Diego Rocha", "Honda Fit")).toHaveTextContent("Perdido");
    expect(document.body).not.toHaveTextContent("—");
  });

  it("filtra pelos chips e avisa quando a etapa escolhida está vazia", async () => {
    const usuario = userEvent.setup();
    simularFunil();
    await abrirFunil();

    await usuario.click(screen.getByRole("button", { name: "Proposta 1" }));
    expect(chipEscolhido()).toBe("Proposta 1");
    expect(quadro()).toEqual([["Proposta 1", "Carla Dias"]]);

    await usuario.click(screen.getByRole("button", { name: "Em contato 0" }));
    expect(chipEscolhido()).toBe("Em contato 0");
    expect(quadro()).toEqual([["Em contato 0"]]);
    expect(
      within(screen.getByRole("region", { name: "Em contato 0" })).getByText(
        "Nenhum interesse nesta etapa.",
      ),
    ).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Todas 4" }));
    expect(chipEscolhido()).toBe("Todas 4");
    expect(quadro()).toHaveLength(3);
    expect(screen.queryByText("Nenhum interesse nesta etapa.")).not.toBeInTheDocument();
  });

  it("mantém a etapa escolhida ao abrir um cliente e voltar ao funil", async () => {
    const usuario = userEvent.setup();
    simularFunil();
    const { router } = await abrirFunil();

    await usuario.click(screen.getByRole("button", { name: "Perdido 1" }));
    await usuario.click(screen.getByRole("link", { name: "Diego Rocha" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard/customers/k4"));
    await act(() => router.navigate(-1));

    expect(await screen.findByRole("region", { name: "Perdido 1" })).toBeInTheDocument();
    expect(chipEscolhido()).toBe("Perdido 1");
    expect(quadro()).toEqual([["Perdido 1", "Diego Rocha"]]);
  });

  it("move o cartão para a etapa escolhida e atualiza as contagens", async () => {
    const usuario = userEvent.setup();
    const api = simularMudanca("i2", (bruno) => [ANA, bruno, CARLA, DIEGO]);
    await abrirFunil();

    await escolherOpcao(usuario, etapaDe("Bruno Lima", "Chevrolet Onix"), "Visita agendada");

    expect(await screen.findByText("Etapa alterada para Visita agendada.")).toHaveAttribute(
      "role",
      "status",
    );
    await waitFor(() =>
      expect(quadro()).toEqual([
        ["Novo 1", "Ana Souza"],
        ["Visita agendada 1", "Bruno Lima"],
        ["Proposta 1", "Carla Dias"],
        ["Perdido 1", "Diego Rocha"],
      ]),
    );
    expect(chips()).toContain("Visita agendada 1");
    expect(etapaDe("Bruno Lima", "Chevrolet Onix")).toHaveTextContent("Visita agendada");
    expect(api.corpos("PATCH /api/dashboard/interests/i2")).toEqual([
      { etapa: "visita_agendada", motivoPerda: null },
    ]);
  });

  it("tira da etapa escolhida o cartão que mudou de etapa", async () => {
    const usuario = userEvent.setup();
    simularMudanca("i1", (ana) => [ana, BRUNO, CARLA, DIEGO]);
    await abrirFunil();
    await usuario.click(screen.getByRole("button", { name: "Novo 2" }));

    await escolherOpcao(usuario, etapaDe("Ana Souza", "Chevrolet Onix"), "Em contato");

    await waitFor(() => expect(quadro()).toEqual([["Novo 1", "Bruno Lima"]]));
    expect(chipEscolhido()).toBe("Novo 1");
    expect(chips()).toContain("Em contato 1");
  });

  it("não chama a API quando a etapa escolhida é a mesma", async () => {
    const usuario = userEvent.setup();
    const api = simularFunil();
    await abrirFunil();

    await escolherOpcao(usuario, etapaDe("Carla Dias", "Fiat Pulse"), "Proposta");

    expect(api.chaves().filter((chave) => !chave.startsWith("GET"))).toEqual([]);
    expect(screen.queryByLabelText("Motivo da perda")).not.toBeInTheDocument();
  });

  it("só move para Perdido depois de informar o motivo, que passa a aparecer no cartão", async () => {
    const usuario = userEvent.setup();
    const api = simularMudanca("i3", (carla) => [ANA, BRUNO, carla, DIEGO]);
    await abrirFunil();

    await escolherOpcao(usuario, etapaDe("Carla Dias", "Fiat Pulse"), "Perdido");
    await usuario.click(within(cartaoDe("Carla Dias")).getByRole("button", { name: "Cancelar" }));
    expect(etapaDe("Carla Dias", "Fiat Pulse")).toHaveTextContent("Proposta");

    await escolherOpcao(usuario, etapaDe("Carla Dias", "Fiat Pulse"), "Perdido");
    const carla = cartaoDe("Carla Dias");
    const motivo = within(carla).getByLabelText("Motivo da perda");
    expect(motivo).toHaveFocus();
    await usuario.click(within(carla).getByRole("button", { name: "Marcar como perdido" }));

    expect(within(carla).getByText("Informe o motivo da perda.")).toBeInTheDocument();
    expect(api.corpos("PATCH /api/dashboard/interests/i3")).toEqual([]);
    expect(quadro()[1]).toEqual(["Proposta 1", "Carla Dias"]);

    await usuario.type(motivo, "Achou caro");
    await usuario.click(within(carla).getByRole("button", { name: "Marcar como perdido" }));

    expect(await screen.findByText("Etapa alterada para Perdido.")).toHaveAttribute(
      "role",
      "status",
    );
    await waitFor(() =>
      expect(quadro()).toEqual([
        ["Novo 2", "Ana Souza", "Bruno Lima"],
        ["Perdido 2", "Carla Dias", "Diego Rocha"],
      ]),
    );
    expect(within(cartaoDe("Carla Dias")).getByText("Motivo: Achou caro")).toBeInTheDocument();
    expect(api.corpos("PATCH /api/dashboard/interests/i3")).toEqual([
      { etapa: "perdido", motivoPerda: "Achou caro" },
    ]);
  });

  it("reabre um negócio perdido sem levar o motivo da perda", async () => {
    const usuario = userEvent.setup();
    const api = simularMudanca("i4", (diego) => [ANA, BRUNO, CARLA, diego]);
    await abrirFunil();

    await escolherOpcao(usuario, etapaDe("Diego Rocha", "Honda Fit"), "Negociação");

    expect(await screen.findByText("Etapa alterada para Negociação.")).toBeInTheDocument();
    await waitFor(() =>
      expect(quadro()).toEqual([
        ["Novo 2", "Ana Souza", "Bruno Lima"],
        ["Proposta 1", "Carla Dias"],
        ["Negociação 1", "Diego Rocha"],
      ]),
    );
    expect(chips()).toContain("Perdido 0");
    expect(screen.queryByText(/^Motivo:/)).not.toBeInTheDocument();
    expect(api.corpos("PATCH /api/dashboard/interests/i4")).toEqual([
      { etapa: "negociacao", motivoPerda: null },
    ]);
  });

  it("avisa quando o interesse foi removido em outra aba e tira o cartão do quadro", async () => {
    const usuario = userEvent.setup();
    const api = simularFunil({
      "PATCH /api/dashboard/interests/i1": () => {
        api.rotas["GET /api/dashboard/interests"] = { interesses: [BRUNO, CARLA, DIEGO] };
        return respostaDeErro(404, "nao_encontrado", "Interesse não encontrado.");
      },
    });
    await abrirFunil();

    await escolherOpcao(usuario, etapaDe("Ana Souza", "Chevrolet Onix"), "Em contato");

    expect(await screen.findByRole("alert")).toHaveTextContent("Interesse não encontrado.");
    await waitFor(() => expect(quadro()[0]).toEqual(["Novo 1", "Bruno Lima"]));
    expect(chips()).toEqual(expect.arrayContaining(["Todas 3", "Em contato 0"]));
    expect(screen.queryByRole("link", { name: "Ana Souza" })).not.toBeInTheDocument();
  });

  it("convida a registrar o primeiro interesse quando o funil está vazio", async () => {
    simularFunil({ "GET /api/dashboard/interests": { interesses: [] } });

    renderizarRota("/dashboard/funnel");

    expect(
      await screen.findByRole("heading", { name: "Nenhum interesse registrado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Registre o interesse de um cliente na página do carro ou do cliente. Cada interesse vira um cartão aqui, e você avança a etapa conforme a negociação anda.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver carros" })).toHaveAttribute(
      "href",
      "/dashboard/cars",
    );
    expect(screen.getByRole("link", { name: "Ver clientes" })).toHaveAttribute(
      "href",
      "/dashboard/customers",
    );
    expect(screen.queryByRole("group", { name: "Filtrar por etapa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("mostra o carregamento, avisa a falha e tenta de novo", async () => {
    const usuario = userEvent.setup();
    let responder: (resposta: unknown) => void = () => undefined;
    const api = simularFunil({
      "GET /api/dashboard/interests": () =>
        new Promise((resolver) => {
          responder = resolver;
        }),
    });
    renderizarRota("/dashboard/funnel");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Funil de vendas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando…");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();

    responder(respostaDeErro(500, "erro_interno", "Erro interno."));

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno.");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filtrar por etapa" })).not.toBeInTheDocument();

    api.rotas["GET /api/dashboard/interests"] = { interesses: TODOS };
    await usuario.click(screen.getByRole("button", { name: "Tentar de novo" }));

    await screen.findByRole("region", { name: /^Novo/ });
    expect(quadro()).toHaveLength(3);
    expect(chips()).toHaveLength(8);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
