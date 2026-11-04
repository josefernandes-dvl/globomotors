import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  carroPainel,
  cliente,
  clienteComDesejos,
  desejo,
  interesse,
  rotasDoPainel,
  veiculoPossivel,
} from "../../testes/dados.ts";
import { renderizarRota } from "../../testes/renderizar.tsx";
import { respostaDeErro, simularApi, type RotasSimuladas } from "../../testes/simularApi.ts";

const ID_ANA = "0b6f1e2c-3d4a-4b5c-8d6e-7f8091a2b3c4";
const ID_BRUNO = "5a7d9c1e-2b3f-4c5d-9e6f-a0b1c2d3e4f5";

const ANA = clienteComDesejos({
  cliente: { id: ID_ANA, nome: "Ana Souza", telefone: "11912345678" },
  possivelDesde: "2026-11-01T12:00:00.000Z",
  desejos: [
    desejo({
      anoMinimo: 2019,
      precoMaximo: 9_000_000,
      observacoes: "Prefere prata",
      possiveis: [veiculoPossivel()],
    }),
  ],
});

const BRUNO = clienteComDesejos({
  cliente: { id: ID_BRUNO, nome: "Bruno Lima", telefone: "1933334444" },
  desejos: [desejo({ id: "d2", nome: "SUV diesel" }), desejo({ id: "d3", nome: "Hilux" })],
});

const CARROS = [
  carroPainel(),
  carroPainel({
    id: "c2",
    marca: "Fiat",
    modelo: "Pulse",
    versao: "Drive 1.3",
    anoFabricacao: 2022,
    anoModelo: 2023,
    status: "reservado",
  }),
  carroPainel({ id: "c3", marca: "Honda", modelo: "Fit", status: "vendido" }),
];

function simularInteresses(rotas: RotasSimuladas = {}) {
  return simularApi(
    rotasDoPainel({
      "GET /api/dashboard/wishes": { clientes: [ANA, BRUNO] },
      "GET /api/dashboard/customers": {
        clientes: [
          cliente({ id: ID_ANA }),
          cliente({ id: ID_BRUNO, nome: "Bruno Lima", telefone: "1933334444" }),
        ],
      },
      "GET /api/dashboard/cars": { carros: CARROS },
      ...rotas,
    }),
  );
}

function itemDe(elemento: HTMLElement) {
  const item = elemento.closest("li");
  if (!item) throw new Error("O elemento não está numa lista.");
  return item;
}

function alteracoes(chaves: string[]) {
  return chaves.filter((chave) => !chave.startsWith("GET"));
}

function textos(elementos: HTMLElement[]) {
  return elementos.map((elemento) => elemento.textContent);
}

async function abrirCadastro() {
  renderizarRota("/dashboard/wishlist");
  await screen.findByRole("option", { name: "Bruno Lima · (19) 3333-4444" });
}

describe("PaginaInteresses", () => {
  it("lista cada cliente com os interesses, com quem tem veículo compatível em destaque", async () => {
    simularInteresses();

    renderizarRota("/dashboard/wishlist");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Interesses" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Interesses · Painel"));
    const lista = await screen.findByRole("list", { name: "Clientes com interesses" });
    expect(
      textos(within(lista).getAllByRole("link", { name: /^(Ana Souza|Bruno Lima)$/ })),
    ).toEqual(["Ana Souza", "Bruno Lima"]);

    const cartaoAna = itemDe(within(lista).getByRole("link", { name: "Ana Souza" }));
    expect(within(lista).getByRole("link", { name: "Ana Souza" })).toHaveAttribute(
      "href",
      `/dashboard/customers/${ID_ANA}`,
    );
    expect(within(cartaoAna).getByText("Possível interesse")).toBeInTheDocument();
    expect(within(cartaoAna).getByRole("link", { name: "(11) 91234-5678" })).toHaveAttribute(
      "href",
      "https://wa.me/5511912345678",
    );
    const onix = itemDe(within(cartaoAna).getByText("Onix automático"));
    expect(within(onix).getByText(/^A partir de 2019/).textContent).toBe(
      "A partir de 2019 · Até R$ 90.000",
    );
    expect(within(onix).getByText("Prefere prata")).toBeInTheDocument();
    expect(within(onix).getByText("Combina com:")).toBeInTheDocument();
    const compativel = within(onix).getByRole("link", { name: /^Chevrolet Onix/ });
    expect(compativel).toHaveAttribute("href", "/dashboard/cars/c1");
    expect(compativel.textContent).toBe("Chevrolet Onix 1.0 Turbo LTZ 2020/2021 · R$ 89.900");

    const cartaoBruno = itemDe(within(lista).getByRole("link", { name: "Bruno Lima" }));
    expect(within(cartaoBruno).queryByText("Possível interesse")).not.toBeInTheDocument();
    expect(within(cartaoBruno).queryByText("Combina com:")).not.toBeInTheDocument();
    expect(within(cartaoBruno).getByText("SUV diesel")).toBeInTheDocument();
    expect(within(cartaoBruno).getByText("Hilux")).toBeInTheDocument();
    expect(within(cartaoBruno).getAllByRole("button", { name: "Atender" })).toHaveLength(2);

    expect(document.body).not.toHaveTextContent("—");
    expect(document.body).not.toHaveTextContent("–");
    expect(document.body).not.toHaveTextContent(/vitrine/i);
  });

  it("explica o que fazer quando nenhum cliente tem interesse cadastrado", async () => {
    simularInteresses({ "GET /api/dashboard/wishes": { clientes: [] } });

    renderizarRota("/dashboard/wishlist");

    expect(
      await screen.findByRole("heading", { name: "Nenhum interesse cadastrado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Quando um veículo compatível entrar no catálogo, o cliente sobe/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Clientes com interesses" })).not.toBeInTheDocument();
  });

  it("mostra o erro ao carregar a lista e busca de novo", async () => {
    const usuario = userEvent.setup();
    let tentativas = 0;
    simularInteresses({
      "GET /api/dashboard/wishes": () =>
        ++tentativas === 1
          ? respostaDeErro(500, "erro_interno", "Erro interno.")
          : { clientes: [BRUNO] },
    });

    renderizarRota("/dashboard/wishlist");

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno.");
    await usuario.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("SUV diesel")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra o erro ao carregar os clientes no lugar do formulário", async () => {
    simularInteresses({
      "GET /api/dashboard/customers": respostaDeErro(500, "erro_interno", "Erro interno."),
    });

    renderizarRota("/dashboard/wishlist");

    const formulario = await screen.findByRole("form", { name: "Novo interesse" });
    expect(await within(formulario).findByRole("alert")).toHaveTextContent("Erro interno.");
    expect(within(formulario).queryByLabelText("Cliente *")).not.toBeInTheDocument();
  });

  it("sem cliente cadastrado, leva ao cadastro de cliente", async () => {
    simularInteresses({ "GET /api/dashboard/customers": { clientes: [] } });

    renderizarRota("/dashboard/wishlist");

    expect(
      await screen.findByText(/Cadastre um cliente antes de registrar um interesse/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cadastrar cliente" })).toHaveAttribute(
      "href",
      "/dashboard/customers/new",
    );
    expect(screen.queryByRole("button", { name: "Cadastrar interesse" })).not.toBeInTheDocument();
  });

  it("cadastra o interesse com ano e preço, mantém o cliente e avisa quantos veículos combinam", async () => {
    const usuario = userEvent.setup();
    const corolla = desejo({
      id: "d9",
      nome: "Corolla",
      possiveis: [veiculoPossivel(), veiculoPossivel({ id: "c2" })],
    });
    let clientes = [ANA, BRUNO];
    const api = simularInteresses({
      "GET /api/dashboard/wishes": () => ({ clientes }),
      "POST /api/dashboard/wishes": () => {
        clientes = [ANA, { ...BRUNO, desejos: [corolla, ...BRUNO.desejos] }];
        return { desejo: corolla };
      },
    });
    await abrirCadastro();

    await usuario.selectOptions(screen.getByLabelText("Cliente *"), "Bruno Lima · (19) 3333-4444");
    await usuario.type(screen.getByLabelText("Veículo procurado *"), "  Corolla ");
    await usuario.type(screen.getByLabelText("Ano mínimo"), "2018");
    await usuario.type(screen.getByLabelText("Preço máximo (R$)"), "95.000");
    await usuario.type(screen.getByLabelText("Observações"), "Só automático");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar interesse" }));

    expect(
      await screen.findByText("Interesse cadastrado. 2 veículos do catálogo combinam."),
    ).toHaveAttribute("role", "status");
    expect(api.corpos("POST /api/dashboard/wishes")).toEqual([
      {
        clienteId: ID_BRUNO,
        nome: "Corolla",
        anoMinimo: 2018,
        precoMaximo: 9_500_000,
        observacoes: "Só automático",
      },
    ]);
    expect(screen.getByLabelText("Cliente *")).toHaveValue(ID_BRUNO);
    expect(screen.getByLabelText("Veículo procurado *")).toHaveValue("");
    expect(screen.getByLabelText("Ano mínimo")).toHaveValue("");
    expect(screen.getByLabelText("Preço máximo (R$)")).toHaveValue("");
    expect(screen.getByLabelText("Observações")).toHaveValue("");
    expect(await screen.findByText("Corolla")).toBeInTheDocument();
  });

  it("confere os campos antes de enviar e cadastra depois de corrigidos", async () => {
    const usuario = userEvent.setup();
    const api = simularInteresses({
      "POST /api/dashboard/wishes": { desejo: desejo({ id: "d9", nome: "Onix" }) },
    });
    await abrirCadastro();

    await usuario.type(screen.getByLabelText("Ano mínimo"), "abc");
    await usuario.type(screen.getByLabelText("Preço máximo (R$)"), "muito");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar interesse" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Confira os campos destacados.");
    const erros = {
      "Cliente *": "Escolha um cliente.",
      "Veículo procurado *": "Informe o veículo procurado.",
      "Ano mínimo": "Informe um ano válido.",
      "Preço máximo (R$)": "Informe um valor válido.",
    };
    for (const [rotulo, mensagem] of Object.entries(erros)) {
      expect(screen.getByLabelText(rotulo)).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText(rotulo)).toHaveAccessibleDescription(mensagem);
    }
    expect(alteracoes(api.chaves())).toEqual([]);

    await usuario.selectOptions(screen.getByLabelText("Cliente *"), "Ana Souza · (11) 91234-5678");
    await usuario.type(screen.getByLabelText("Veículo procurado *"), "Onix");
    await usuario.clear(screen.getByLabelText("Ano mínimo"));
    await usuario.clear(screen.getByLabelText("Preço máximo (R$)"));
    await usuario.click(screen.getByRole("button", { name: "Cadastrar interesse" }));

    expect(await screen.findByText("Interesse cadastrado.")).toHaveAttribute("role", "status");
    expect(api.corpos("POST /api/dashboard/wishes")).toEqual([
      { clienteId: ID_ANA, nome: "Onix", anoMinimo: null, precoMaximo: null, observacoes: null },
    ]);
    for (const rotulo of Object.keys(erros)) {
      expect(screen.getByLabelText(rotulo)).not.toHaveAttribute("aria-invalid");
    }
  });

  it("mostra no campo o interesse repetido recusado pelo servidor", async () => {
    const usuario = userEvent.setup();
    simularInteresses({
      "POST /api/dashboard/wishes": respostaDeErro(
        409,
        "conflito",
        "Este cliente já tem este interesse.",
        [{ campo: "nome", mensagem: "Este cliente já tem este interesse." }],
      ),
    });
    await abrirCadastro();

    await usuario.selectOptions(screen.getByLabelText("Cliente *"), "Ana Souza · (11) 91234-5678");
    await usuario.type(screen.getByLabelText("Veículo procurado *"), "Onix automático");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar interesse" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este cliente já tem este interesse.",
    );
    const nome = screen.getByLabelText("Veículo procurado *");
    expect(nome).toHaveAttribute("aria-invalid", "true");
    expect(nome).toHaveAccessibleDescription("Este cliente já tem este interesse.");
    expect(nome).toHaveValue("Onix automático");
    expect(screen.getByLabelText("Cliente *")).toHaveValue(ID_ANA);
  });

  it("exclui o interesse depois de confirmar", async () => {
    const usuario = userEvent.setup();
    let clientes = [ANA, BRUNO];
    const api = simularInteresses({
      "GET /api/dashboard/wishes": () => ({ clientes }),
      "DELETE /api/dashboard/wishes/d2": () => {
        clientes = [ANA, { ...BRUNO, desejos: BRUNO.desejos.filter(({ id }) => id !== "d2") }];
        return new Response(null, { status: 204 });
      },
    });
    renderizarRota("/dashboard/wishlist");
    const suv = itemDe(await screen.findByText("SUV diesel"));

    await usuario.click(within(suv).getByRole("button", { name: "Excluir interesse" }));
    await usuario.click(
      within(within(suv).getByRole("group", { name: "Excluir este interesse?" })).getByRole(
        "button",
        { name: "Sim" },
      ),
    );

    expect(await screen.findByText("Interesse excluído.")).toHaveAttribute("role", "status");
    await waitFor(() => expect(screen.queryByText("SUV diesel")).not.toBeInTheDocument());
    expect(screen.getByText("Hilux")).toBeInTheDocument();
    expect(alteracoes(api.chaves())).toEqual(["DELETE /api/dashboard/wishes/d2"]);
  });

  it("atende o interesse com o veículo escolhido, sugerindo primeiro os que combinam", async () => {
    const usuario = userEvent.setup();
    let clientes = [ANA, BRUNO];
    const api = simularInteresses({
      "GET /api/dashboard/wishes": () => ({ clientes }),
      "POST /api/dashboard/wishes/d1/attend": () => {
        clientes = [BRUNO];
        return { interesse: interesse({ etapa: "em_contato" }) };
      },
    });
    renderizarRota("/dashboard/wishlist");
    const onix = itemDe(await screen.findByText("Onix automático"));
    const secoes = screen.getByRole("navigation", { name: "Seções do painel" });
    expect(
      within(secoes).getByRole("link", { name: "Interesses (1 cliente com possível interesse)" }),
    ).toHaveAttribute("aria-current", "page");

    await usuario.click(within(onix).getByRole("button", { name: "Atender" }));

    const formulario = screen.getByRole("form", { name: "Atender Onix automático" });
    const veiculo = within(formulario).getByLabelText("Veículo");
    await waitFor(() => expect(veiculo).toBeEnabled());
    expect(veiculo).toHaveValue("c1");
    expect(
      textos(
        within(
          within(veiculo).getByRole("group", { name: "Combinam com o interesse" }),
        ).getAllByRole("option"),
      ),
    ).toEqual(["Chevrolet Onix 1.0 Turbo LTZ 2020/2021 · Disponível"]);
    expect(
      textos(
        within(within(veiculo).getByRole("group", { name: "Outros veículos" })).getAllByRole(
          "option",
        ),
      ),
    ).toEqual(["Fiat Pulse Drive 1.3 2022/2023 · Reservado"]);
    expect(within(veiculo).queryByRole("option", { name: /Honda Fit/ })).not.toBeInTheDocument();

    await usuario.selectOptions(veiculo, "c2");
    await usuario.click(within(formulario).getByRole("button", { name: "Confirmar" }));

    expect(
      await screen.findByText("Interesse atendido. Ana Souza está em “Em contato” no funil."),
    ).toHaveAttribute("role", "status");
    expect(api.corpos("POST /api/dashboard/wishes/d1/attend")).toEqual([{ carroId: "c2" }]);
    await waitFor(() => expect(screen.queryByText("Onix automático")).not.toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Ana Souza" })).not.toBeInTheDocument();
    expect(within(secoes).getByRole("link", { name: /^Interesses/ }).textContent).toBe(
      "Interesses",
    );
    expect(alteracoes(api.chaves())).toEqual(["POST /api/dashboard/wishes/d1/attend"]);
  });

  it("sem veículo compatível, só confirma depois de escolher e mostra a etapa em que o cliente ficou", async () => {
    const usuario = userEvent.setup();
    let tentativas = 0;
    const api = simularInteresses({
      "POST /api/dashboard/wishes/d2/attend": () =>
        ++tentativas === 1
          ? respostaDeErro(404, "nao_encontrado", "Veículo não encontrado.")
          : { interesse: interesse({ etapa: "proposta" }) },
    });
    renderizarRota("/dashboard/wishlist");
    const suv = itemDe(await screen.findByText("SUV diesel"));

    await usuario.click(within(suv).getByRole("button", { name: "Atender" }));
    await usuario.click(within(suv).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("form", { name: "Atender SUV diesel" })).not.toBeInTheDocument();

    await usuario.click(within(suv).getByRole("button", { name: "Atender" }));
    const formulario = screen.getByRole("form", { name: "Atender SUV diesel" });
    const veiculo = within(formulario).getByLabelText("Veículo");
    await waitFor(() => expect(veiculo).toBeEnabled());
    expect(veiculo).toHaveValue("");
    expect(within(veiculo).queryByRole("group")).not.toBeInTheDocument();
    expect(textos(within(veiculo).getAllByRole("option"))).toEqual([
      "Escolha um veículo",
      "Chevrolet Onix 1.0 Turbo LTZ 2020/2021 · Disponível",
      "Fiat Pulse Drive 1.3 2022/2023 · Reservado",
    ]);
    const confirmar = within(formulario).getByRole("button", { name: "Confirmar" });
    expect(confirmar).toBeDisabled();

    await usuario.selectOptions(veiculo, "c1");
    await usuario.click(confirmar);

    expect(await screen.findByRole("alert")).toHaveTextContent("Veículo não encontrado.");
    expect(formulario).toBeInTheDocument();

    await usuario.click(confirmar);

    expect(
      await screen.findByText("Interesse atendido. Bruno Lima está em “Proposta” no funil."),
    ).toBeInTheDocument();
    expect(api.corpos("POST /api/dashboard/wishes/d2/attend")).toEqual([
      { carroId: "c1" },
      { carroId: "c1" },
    ]);
  });
});
