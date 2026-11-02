import type { EtapaFunil } from "@globomotors/shared";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { carroPainel, cliente, interesse, rotasDoPainel } from "../../testes/dados.ts";
import { renderizarRota } from "../../testes/renderizar.tsx";
import { escolherOpcao, lerOpcoes } from "../../testes/selecao.ts";
import {
  respostaDeErro,
  simularApi,
  type RequisicaoSimulada,
  type RotasSimuladas,
} from "../../testes/simularApi.ts";

const ANA = cliente();
const PULSE = carroPainel({
  id: "c2",
  slug: "fiat-pulse-2023-c2",
  marca: "Fiat",
  modelo: "Pulse",
  versao: "Drive 1.3",
  anoFabricacao: 2022,
  anoModelo: 2023,
  status: "reservado",
});
const GOL = carroPainel({ id: "c3", marca: "Volkswagen", modelo: "Gol", status: "vendido" });
const FIT = carroPainel({
  id: "c4",
  marca: "Honda",
  modelo: "Fit",
  versao: null,
  anoFabricacao: 2019,
  anoModelo: 2019,
  status: "rascunho",
});
const ETAPA_DA_ANA = { name: "Etapa de Ana Souza, Chevrolet Onix" };

function simularCliente(rotas: RotasSimuladas = {}) {
  const todas = rotasDoPainel({
    "GET /api/dashboard/customers": { clientes: [ANA] },
    "GET /api/dashboard/customers/k1": { cliente: ANA },
    "GET /api/dashboard/interests?customerId=k1": { interesses: [interesse()] },
    "GET /api/dashboard/cars": { carros: [carroPainel(), PULSE, GOL, FIT] },
    ...rotas,
  });
  return { ...simularApi(todas), rotas: todas };
}

function formulario() {
  return screen.getByLabelText("Nome *").closest("form");
}

function opcoes(selecao: HTMLElement) {
  return within(selecao)
    .getAllByRole("option")
    .map((opcao) => opcao.textContent);
}

function alteracoes(chaves: string[]) {
  return chaves.filter((chave) => !chave.startsWith("GET"));
}

async function preencher(usuario: UserEvent, campos: Record<string, string>) {
  for (const [rotulo, texto] of Object.entries(campos)) {
    await usuario.clear(screen.getByLabelText(rotulo));
    if (texto) await usuario.paste(texto);
  }
}

async function abrirInteresses() {
  const regiao = await screen.findByRole("region", { name: "Carros de interesse" });
  const escolha = await within(regiao).findByLabelText("Carro");
  await waitFor(() => expect(escolha).toBeEnabled());
  return { regiao, escolha };
}

describe("PaginaCliente", () => {
  describe("novo cliente", () => {
    it("abre vazio e valida nome, telefone e e-mail antes de cadastrar", async () => {
      const usuario = userEvent.setup();
      const api = simularCliente();
      renderizarRota("/dashboard/customers/new");

      expect(
        await screen.findByRole("heading", { level: 1, name: "Novo cliente" }),
      ).toBeInTheDocument();
      await waitFor(() => expect(document.title).toBe("Novo cliente · Painel"));
      expect(formulario()).toHaveFormValues({
        nome: "",
        telefone: "",
        email: "",
        origem: "",
        observacoes: "",
      });
      expect(opcoes(screen.getByLabelText("Como conheceu a loja"))).toEqual([
        "Selecione",
        "Indicação",
        "Instagram",
        "Marketplace",
        "Vitrine",
        "WhatsApp",
        "Visita à loja",
        "Outro",
      ]);
      expect(
        screen.getByText(
          "Depois de cadastrar o cliente, você pode registrar os carros de interesse dele.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Excluir cliente" })).not.toBeInTheDocument();
      expect(screen.queryByText(/^Cadastrado em/)).not.toBeInTheDocument();

      await usuario.click(screen.getByRole("button", { name: "Cadastrar cliente" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Confira os campos destacados.");
      expect(screen.getByLabelText("Nome *")).toHaveAccessibleDescription("Informe o nome.");
      expect(screen.getByLabelText("Telefone (WhatsApp) *")).toHaveAccessibleDescription(
        "Informe o telefone.",
      );
      expect(screen.getByLabelText("E-mail")).not.toHaveAttribute("aria-invalid");

      await preencher(usuario, {
        "Nome *": "   ",
        "Telefone (WhatsApp) *": "(11) 1234-567",
        "E-mail": "ana@",
      });
      await usuario.click(screen.getByRole("button", { name: "Cadastrar cliente" }));

      expect(screen.getByLabelText("Nome *")).toHaveAccessibleDescription("Informe o nome.");
      expect(screen.getByLabelText("Telefone (WhatsApp) *")).toHaveAccessibleDescription(
        "Telefone inválido: informe DDD e número, como (62) 99999-0000.",
      );
      expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription("E-mail inválido.");
      expect(alteracoes(api.chaves())).toEqual([]);
    });

    it("cadastra com os dados normalizados e abre a ficha do cliente", async () => {
      const usuario = userEvent.setup();
      let responder: (resposta: unknown) => void = () => undefined;
      const carla = cliente({
        id: "k9",
        nome: "Carla Dias",
        telefone: "62999990000",
        email: "carla@exemplo.com",
        origem: "indicacao",
        observacoes: "Quer SUV até R$ 120 mil",
        criadoEm: "2026-10-30T15:00:00.000Z",
        atualizadoEm: "2026-10-30T15:00:00.000Z",
      });
      const api = simularCliente({
        "POST /api/dashboard/customers": () =>
          new Promise((resolver) => {
            responder = resolver;
          }),
        "GET /api/dashboard/customers/k9": { cliente: carla },
        "GET /api/dashboard/interests?customerId=k9": { interesses: [] },
      });
      const { router } = renderizarRota("/dashboard/customers/new");
      await screen.findByLabelText("Nome *");

      await preencher(usuario, {
        "Nome *": "  Carla Dias ",
        "Telefone (WhatsApp) *": "+55 (62) 99999-0000",
        "E-mail": " Carla@Exemplo.COM ",
        Observações: "Quer SUV até R$ 120 mil",
      });
      await usuario.selectOptions(screen.getByLabelText("Como conheceu a loja"), "Indicação");
      await usuario.click(screen.getByRole("button", { name: "Cadastrar cliente" }));

      expect(await screen.findByRole("button", { name: "Salvando…" })).toBeDisabled();
      expect(api.corpos("POST /api/dashboard/customers")).toEqual([
        {
          nome: "Carla Dias",
          telefone: "62999990000",
          email: "carla@exemplo.com",
          origem: "indicacao",
          observacoes: "Quer SUV até R$ 120 mil",
        },
      ]);

      responder({ cliente: carla });

      expect(await screen.findByText("Cliente cadastrado.")).toHaveAttribute("role", "status");
      expect(
        await screen.findByRole("heading", { level: 1, name: "Carla Dias" }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/dashboard/customers/k9");
      expect(router.state.historyAction).toBe("REPLACE");
      expect(screen.getByLabelText("Telefone (WhatsApp) *")).toHaveValue("(62) 99999-0000");
      expect(screen.getByText("Cadastrado em 30/10/2026")).toBeInTheDocument();
      expect(
        await screen.findByText("Este cliente ainda não tem carro de interesse."),
      ).toBeInTheDocument();
      expect(alteracoes(api.chaves())).toEqual(["POST /api/dashboard/customers"]);
    });

    it("marca o telefone já cadastrado e continua no formulário", async () => {
      const usuario = userEvent.setup();
      simularCliente({
        "POST /api/dashboard/customers": respostaDeErro(
          409,
          "conflito",
          "Já existe um cliente com este telefone.",
          [{ campo: "telefone", mensagem: "Já existe um cliente com este telefone." }],
        ),
      });
      const { router } = renderizarRota("/dashboard/customers/new");
      await screen.findByLabelText("Nome *");

      await preencher(usuario, {
        "Nome *": "Ana Souza",
        "Telefone (WhatsApp) *": "(11) 91234-5678",
      });
      await usuario.click(screen.getByRole("button", { name: "Cadastrar cliente" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Já existe um cliente com este telefone.",
      );
      const telefone = screen.getByLabelText("Telefone (WhatsApp) *");
      expect(telefone).toHaveAttribute("aria-invalid", "true");
      expect(telefone).toHaveAccessibleDescription("Já existe um cliente com este telefone.");
      expect(screen.getByLabelText("Nome *")).not.toHaveAttribute("aria-invalid");
      expect(screen.getByRole("button", { name: "Cadastrar cliente" })).toBeEnabled();
      expect(router.state.location.pathname).toBe("/dashboard/customers/new");
    });
  });

  describe("ficha do cliente", () => {
    it("carrega os dados, os carros de interesse e as opções de carro", async () => {
      simularCliente();

      renderizarRota("/dashboard/customers/k1");

      expect(
        await screen.findByRole("heading", { level: 1, name: "Ana Souza" }),
      ).toBeInTheDocument();
      await waitFor(() => expect(document.title).toBe("Ana Souza · Painel"));
      expect(formulario()).toHaveFormValues({
        nome: "Ana Souza",
        telefone: "(11) 91234-5678",
        email: "ana@exemplo.com",
        origem: "instagram",
        observacoes: "Procura hatch automático",
      });
      expect(screen.getByText("Cadastrado em 20/10/2026")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Excluir cliente" })).toBeEnabled();

      const { regiao, escolha } = await abrirInteresses();
      expect(within(regiao).getByRole("link", { name: "Chevrolet Onix 2021" })).toHaveAttribute(
        "href",
        "/dashboard/cars/c1",
      );
      expect(within(regiao).getByText("1.0 Turbo LTZ · Disponível")).toBeInTheDocument();
      expect(within(regiao).getByRole("combobox", ETAPA_DA_ANA)).toHaveTextContent("Novo");
      expect(opcoes(escolha)).toEqual([
        "Escolha um carro",
        "Fiat Pulse Drive 1.3 2022/2023 · Reservado",
        "Honda Fit 2019 · Rascunho",
      ]);
      expect(within(regiao).getByRole("button", { name: "Registrar interesse" })).toBeDisabled();
    });

    it("salva as alterações, limpa os campos opcionais e continua na ficha", async () => {
      const usuario = userEvent.setup();
      const atualizado = cliente({
        nome: "Ana Souza Lima",
        telefone: "11955554444",
        email: null,
        origem: null,
        observacoes: null,
        atualizadoEm: "2026-10-30T15:00:00.000Z",
      });
      const api = simularCliente({
        "PUT /api/dashboard/customers/k1": () => {
          api.rotas["GET /api/dashboard/customers/k1"] = { cliente: atualizado };
          return { cliente: atualizado };
        },
      });
      const { router } = renderizarRota("/dashboard/customers/k1");
      await screen.findByRole("heading", { level: 1, name: "Ana Souza" });

      await preencher(usuario, {
        "Nome *": "Ana Souza Lima",
        "Telefone (WhatsApp) *": "11 95555-4444",
        "E-mail": "",
        Observações: "  ",
      });
      await usuario.selectOptions(screen.getByLabelText("Como conheceu a loja"), "Selecione");
      await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));

      expect(await screen.findByText("Alterações salvas.")).toHaveAttribute("role", "status");
      expect(api.corpos("PUT /api/dashboard/customers/k1")).toEqual([
        {
          nome: "Ana Souza Lima",
          telefone: "11955554444",
          email: null,
          origem: null,
          observacoes: null,
        },
      ]);
      expect(
        await screen.findByRole("heading", { level: 1, name: "Ana Souza Lima" }),
      ).toBeInTheDocument();
      expect(formulario()).toHaveFormValues({
        nome: "Ana Souza Lima",
        telefone: "(11) 95555-4444",
        email: "",
        origem: "",
        observacoes: "",
      });
      expect(router.state.location.pathname).toBe("/dashboard/customers/k1");
      expect(alteracoes(api.chaves())).toEqual(["PUT /api/dashboard/customers/k1"]);
    });

    it("exclui o cliente só depois da confirmação, volta para a lista e não reabre a ficha excluída", async () => {
      const usuario = userEvent.setup();
      let responder: (resposta: unknown) => void = () => undefined;
      const api = simularCliente({
        "DELETE /api/dashboard/customers/k1": () => {
          api.rotas["GET /api/dashboard/customers"] = { clientes: [] };
          api.rotas["GET /api/dashboard/customers/k1"] = () =>
            new Promise((resolver) => {
              responder = resolver;
            });
          return new Response(null, { status: 204 });
        },
      });
      const { router } = renderizarRota("/dashboard/customers/k1");
      const confirmacao = () => screen.getByRole("group", { name: "Excluir este cliente?" });

      await usuario.click(await screen.findByRole("button", { name: "Excluir cliente" }));
      await usuario.click(within(confirmacao()).getByRole("button", { name: "Não" }));

      expect(
        screen.queryByRole("group", { name: "Excluir este cliente?" }),
      ).not.toBeInTheDocument();
      expect(alteracoes(api.chaves())).toEqual([]);

      await usuario.click(screen.getByRole("button", { name: "Excluir cliente" }));
      await usuario.click(within(confirmacao()).getByRole("button", { name: "Sim" }));

      expect(await screen.findByText("Cliente excluído.")).toHaveAttribute("role", "status");
      expect(
        await screen.findByRole("heading", { name: "Nenhum cliente cadastrado" }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/dashboard/customers");
      expect(alteracoes(api.chaves())).toEqual(["DELETE /api/dashboard/customers/k1"]);
      const depoisDaExclusao = api
        .chaves()
        .slice(api.chaves().indexOf("DELETE /api/dashboard/customers/k1") + 1);
      expect(depoisDaExclusao).toEqual(["GET /api/dashboard/customers"]);

      await act(() => router.navigate(-1));

      expect(await screen.findByRole("heading", { level: 1, name: "Cliente" })).toBeInTheDocument();
      expect(screen.getByText("Carregando…")).toBeInTheDocument();
      expect(screen.queryByLabelText("Nome *")).not.toBeInTheDocument();

      responder(respostaDeErro(404, "nao_encontrado", "Cliente não encontrado."));

      expect(
        await screen.findByRole("heading", { name: "Cliente não encontrado" }),
      ).toBeInTheDocument();
    });

    it("avisa quando não consegue excluir e continua na ficha", async () => {
      const usuario = userEvent.setup();
      simularCliente({
        "DELETE /api/dashboard/customers/k1": respostaDeErro(500, "erro_interno", "Erro interno."),
      });
      const { router } = renderizarRota("/dashboard/customers/k1");

      await usuario.click(await screen.findByRole("button", { name: "Excluir cliente" }));
      await usuario.click(screen.getByRole("button", { name: "Sim" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno.");
      expect(router.state.location.pathname).toBe("/dashboard/customers/k1");
      expect(screen.getByRole("heading", { level: 1, name: "Ana Souza" })).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Excluir cliente" })).toBeEnabled(),
      );
    });

    it("avisa quando o cliente não existe mais", async () => {
      const usuario = userEvent.setup();
      simularCliente({
        "GET /api/dashboard/customers/k1": respostaDeErro(
          404,
          "nao_encontrado",
          "Cliente não encontrado.",
        ),
      });
      const { router } = renderizarRota("/dashboard/customers/k1");

      expect(
        await screen.findByRole("heading", { name: "Cliente não encontrado" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Ele pode ter sido excluído.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();

      await usuario.click(screen.getByRole("link", { name: "Voltar aos clientes" }));

      expect(
        await screen.findByRole("heading", { level: 1, name: "Clientes" }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/dashboard/customers");
    });

    it("mostra o carregamento, avisa a falha e tenta de novo", async () => {
      const usuario = userEvent.setup();
      let responder: (resposta: unknown) => void = () => undefined;
      const api = simularCliente({
        "GET /api/dashboard/customers/k1": () =>
          new Promise((resolver) => {
            responder = resolver;
          }),
      });
      renderizarRota("/dashboard/customers/k1");

      expect(await screen.findByRole("heading", { level: 1, name: "Cliente" })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Carregando…");

      responder(respostaDeErro(500, "erro_interno", "Erro interno."));

      expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno.");
      expect(screen.queryByLabelText("Nome *")).not.toBeInTheDocument();

      api.rotas["GET /api/dashboard/customers/k1"] = { cliente: ANA };
      await usuario.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await screen.findByLabelText("Nome *")).toHaveValue("Ana Souza");
    });

    it("mantém o que foi digitado quando a atualização do cliente em segundo plano falha", async () => {
      const usuario = userEvent.setup();
      const api = simularCliente({
        "POST /api/dashboard/interests": () => {
          api.rotas["GET /api/dashboard/customers/k1"] = respostaDeErro(
            500,
            "erro_interno",
            "Erro interno.",
          );
          return { interesse: interesse({ id: "i2" }) };
        },
      });
      const { queryClient } = renderizarRota("/dashboard/customers/k1");
      const { regiao, escolha } = await abrirInteresses();
      await preencher(usuario, { Observações: "Prefere câmbio automático" });

      await usuario.selectOptions(escolha, "Honda Fit 2019 · Rascunho");
      await usuario.click(within(regiao).getByRole("button", { name: "Registrar interesse" }));

      expect(await screen.findByText("Interesse registrado.")).toBeInTheDocument();
      await waitFor(() =>
        expect(queryClient.getQueryState(["painel", "cliente", "k1"])?.status).toBe("error"),
      );
      expect(screen.getByLabelText("Observações")).toHaveValue("Prefere câmbio automático");
      expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
    });

    it("avisa que o cliente foi excluído em outra aba quando a ficha aberta é atualizada", async () => {
      const usuario = userEvent.setup();
      const api = simularCliente();
      renderizarRota("/dashboard/customers/k1");
      await abrirInteresses();
      await preencher(usuario, { Observações: "Prefere câmbio automático" });
      api.rotas["GET /api/dashboard/customers/k1"] = respostaDeErro(
        404,
        "nao_encontrado",
        "Cliente não encontrado.",
      );

      fireEvent(window, new Event("visibilitychange"));

      expect(
        await screen.findByRole("heading", { name: "Cliente não encontrado" }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Nome *")).not.toBeInTheDocument();
    });
  });

  describe("carros de interesse", () => {
    it("registra o interesse num carro que não foi vendido nem escolhido antes", async () => {
      const usuario = userEvent.setup();
      const api = simularCliente({
        "POST /api/dashboard/interests": () => {
          const novo = interesse({
            id: "i2",
            carro: {
              id: "c2",
              marca: "Fiat",
              modelo: "Pulse",
              versao: "Drive 1.3",
              anoModelo: 2023,
              status: "reservado",
              capa: null,
            },
          });
          api.rotas["GET /api/dashboard/interests?customerId=k1"] = {
            interesses: [interesse(), novo],
          };
          return { interesse: novo };
        },
      });
      renderizarRota("/dashboard/customers/k1");
      const { regiao, escolha } = await abrirInteresses();
      const registrar = within(regiao).getByRole("button", { name: "Registrar interesse" });

      await usuario.selectOptions(escolha, "Fiat Pulse Drive 1.3 2022/2023 · Reservado");
      expect(registrar).toBeEnabled();
      await usuario.click(registrar);

      expect(await screen.findByText("Interesse registrado.")).toHaveAttribute("role", "status");
      expect(api.corpos("POST /api/dashboard/interests")).toEqual([
        { clienteId: "k1", carroId: "c2" },
      ]);
      expect(await within(regiao).findByRole("link", { name: "Fiat Pulse 2023" })).toHaveAttribute(
        "href",
        "/dashboard/cars/c2",
      );
      await waitFor(() =>
        expect(opcoes(escolha)).toEqual(["Escolha um carro", "Honda Fit 2019 · Rascunho"]),
      );
      expect(escolha).toHaveValue("");
      expect(registrar).toBeDisabled();
    });

    it("avisa quando o interesse já foi registrado e mantém a escolha", async () => {
      const usuario = userEvent.setup();
      simularCliente({
        "POST /api/dashboard/interests": respostaDeErro(
          409,
          "conflito",
          "Este cliente já está interessado neste carro.",
        ),
      });
      renderizarRota("/dashboard/customers/k1");
      const { regiao, escolha } = await abrirInteresses();

      await usuario.selectOptions(escolha, "Honda Fit 2019 · Rascunho");
      await usuario.click(within(regiao).getByRole("button", { name: "Registrar interesse" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Este cliente já está interessado neste carro.",
      );
      expect(escolha).toHaveValue("c4");
      await waitFor(() =>
        expect(within(regiao).getByRole("button", { name: "Registrar interesse" })).toBeEnabled(),
      );
    });

    it("muda a etapa e exige o motivo quando o negócio é perdido", async () => {
      const usuario = userEvent.setup();
      const api = simularCliente({
        "PATCH /api/dashboard/interests/i1": ({ corpo }: RequisicaoSimulada) => {
          const dados = corpo as { etapa: EtapaFunil; motivoPerda: string | null };
          const atualizado = interesse(dados);
          api.rotas["GET /api/dashboard/interests?customerId=k1"] = { interesses: [atualizado] };
          return { interesse: atualizado };
        },
      });
      renderizarRota("/dashboard/customers/k1");
      const { regiao } = await abrirInteresses();
      const etapa = () => within(regiao).getByRole("combobox", ETAPA_DA_ANA);
      expect(await lerOpcoes(usuario, etapa())).toEqual([
        "Novo",
        "Em contato",
        "Visita agendada",
        "Proposta",
        "Negociação",
        "Vendido",
        "Perdido",
      ]);

      await escolherOpcao(usuario, etapa(), "Proposta");

      expect(await screen.findByText("Etapa alterada para Proposta.")).toHaveAttribute(
        "role",
        "status",
      );
      await waitFor(() => expect(etapa()).toHaveTextContent("Proposta"));

      await escolherOpcao(usuario, etapa(), "Perdido");
      const motivo = within(regiao).getByLabelText("Motivo da perda");
      expect(motivo).toHaveFocus();
      await usuario.click(within(regiao).getByRole("button", { name: "Marcar como perdido" }));

      expect(within(regiao).getByText("Informe o motivo da perda.")).toBeInTheDocument();
      expect(motivo).toHaveAttribute("aria-invalid", "true");

      await usuario.click(within(regiao).getByRole("button", { name: "Cancelar" }));

      expect(etapa()).toHaveTextContent("Proposta");

      await escolherOpcao(usuario, etapa(), "Perdido");
      expect(within(regiao).queryByText("Informe o motivo da perda.")).not.toBeInTheDocument();
      await usuario.type(
        within(regiao).getByLabelText("Motivo da perda"),
        "  Comprou em outra loja ",
      );
      await usuario.click(within(regiao).getByRole("button", { name: "Marcar como perdido" }));

      expect(await screen.findByText("Etapa alterada para Perdido.")).toHaveAttribute(
        "role",
        "status",
      );
      expect(await within(regiao).findByText("Motivo: Comprou em outra loja")).toBeInTheDocument();
      expect(etapa()).toHaveTextContent("Perdido");
      expect(api.corpos("PATCH /api/dashboard/interests/i1")).toEqual([
        { etapa: "proposta", motivoPerda: null },
        { etapa: "perdido", motivoPerda: "Comprou em outra loja" },
      ]);
    });

    it("avisa a falha ao mudar a etapa e mantém a etapa anterior", async () => {
      const usuario = userEvent.setup();
      simularCliente({
        "PATCH /api/dashboard/interests/i1": respostaDeErro(500, "erro_interno", "Erro interno."),
      });
      renderizarRota("/dashboard/customers/k1");
      const { regiao } = await abrirInteresses();

      const etapa = within(regiao).getByRole("combobox", ETAPA_DA_ANA);
      await escolherOpcao(usuario, etapa, "Negociação");

      expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno.");
      await waitFor(() => expect(etapa).not.toHaveAttribute("aria-disabled"));
      expect(etapa).toHaveTextContent("Novo");
    });

    it("remove o interesse depois da confirmação e devolve o carro às opções", async () => {
      const usuario = userEvent.setup();
      const api = simularCliente({
        "DELETE /api/dashboard/interests/i1": () => {
          api.rotas["GET /api/dashboard/interests?customerId=k1"] = { interesses: [] };
          return new Response(null, { status: 204 });
        },
      });
      renderizarRota("/dashboard/customers/k1");
      const { regiao, escolha } = await abrirInteresses();

      await usuario.click(within(regiao).getByRole("button", { name: "Remover interesse" }));
      await usuario.click(
        within(within(regiao).getByRole("group", { name: "Remover este interesse?" })).getByRole(
          "button",
          { name: "Sim" },
        ),
      );

      expect(await screen.findByText("Interesse removido.")).toHaveAttribute("role", "status");
      expect(
        await within(regiao).findByText("Este cliente ainda não tem carro de interesse."),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(opcoes(escolha)).toEqual([
          "Escolha um carro",
          "Chevrolet Onix 1.0 Turbo LTZ 2020/2021 · Disponível",
          "Fiat Pulse Drive 1.3 2022/2023 · Reservado",
          "Honda Fit 2019 · Rascunho",
        ]),
      );
      expect(alteracoes(api.chaves())).toEqual(["DELETE /api/dashboard/interests/i1"]);
    });

    it("avisa quando não consegue carregar os carros de interesse", async () => {
      simularCliente({
        "GET /api/dashboard/interests?customerId=k1": respostaDeErro(
          500,
          "erro_interno",
          "Erro interno.",
        ),
      });

      renderizarRota("/dashboard/customers/k1");

      const regiao = await screen.findByRole("region", { name: "Carros de interesse" });
      expect(await within(regiao).findByRole("alert")).toHaveTextContent("Erro interno.");
      expect(within(regiao).queryByLabelText("Carro")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Nome *")).toHaveValue("Ana Souza");
    });
  });
});
