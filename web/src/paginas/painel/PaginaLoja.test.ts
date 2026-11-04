import { LOJA_PADRAO, type Loja } from "@globomotors/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LOJA, LOJA_PUBLICA, carroPublico, rotasDoPainel } from "../../testes/dados.ts";
import { renderizarRota } from "../../testes/renderizar.tsx";
import {
  respostaDeErro,
  simularApi,
  type RequisicaoSimulada,
  type RotasSimuladas,
} from "../../testes/simularApi.ts";

const LINK = `${window.location.origin}/catalogo`;
const SALVAR = { name: "Salvar dados da loja" };

function simularLoja(rotas: RotasSimuladas = {}) {
  const todas: RotasSimuladas = rotasDoPainel({
    "PUT /api/dashboard/store": ({ corpo }: RequisicaoSimulada) => {
      todas["GET /api/dashboard/store"] = { loja: corpo };
      return { loja: corpo };
    },
    ...rotas,
  });
  return { ...simularApi(todas), rotas: todas };
}

function alteracoes(chaves: string[]) {
  return chaves.filter((chave) => !chave.startsWith("GET"));
}

function nomeNoTopo() {
  return within(screen.getByRole("banner")).getAllByRole("link")[0]?.textContent;
}

async function preencher(usuario: UserEvent, campos: Record<string, string>) {
  for (const [rotulo, texto] of Object.entries(campos)) {
    await usuario.clear(screen.getByLabelText(rotulo));
    if (texto) await usuario.paste(texto);
  }
}

describe("PaginaLoja", () => {
  it("preenche o formulário com os dados da loja e mostra o link do catálogo", async () => {
    const api = simularLoja();
    renderizarRota("/dashboard/store");

    expect(await screen.findByLabelText("Nome da loja *")).toHaveValue("Globo Motors");
    await waitFor(() => expect(document.title).toBe("Dados da loja · Painel"));
    expect(screen.getByRole("heading", { level: 1, name: "Dados da loja" })).toBeInTheDocument();
    expect(screen.getByLabelText("Cidade")).toHaveValue("Campinas, SP");
    expect(screen.getByLabelText("Cidade")).toHaveAttribute("placeholder", "São Paulo, SP");
    expect(screen.getByLabelText("Slogan")).toHaveValue("Seminovos com procedência");
    expect(screen.getByLabelText("Slogan")).toHaveAccessibleDescription(
      "Aparece no topo da página inicial.",
    );
    expect(screen.getByLabelText("WhatsApp da loja")).toHaveValue("(11) 98765-4321");
    expect(screen.getByLabelText("WhatsApp da loja")).toHaveAccessibleDescription(
      "Recebe as mensagens dos clientes que clicam em “Tenho interesse”.",
    );
    expect(screen.getByLabelText("Instagram")).toHaveValue("@globomotors");
    expect(screen.getByRole("checkbox", { name: "Mostrar preços no catálogo" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Mostrar veículos vendidos no catálogo" }),
    ).not.toBeChecked();

    const link = screen.getByRole("link", { name: LINK });
    expect(link).toHaveAttribute("href", LINK);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(document.body).not.toHaveTextContent(/vitrine/i);
    expect(alteracoes(api.chaves())).toEqual([]);
  });

  it("abre em branco a loja ainda não configurada e salva os campos opcionais vazios", async () => {
    const usuario = userEvent.setup();
    const api = simularLoja({ "GET /api/dashboard/store": { loja: LOJA_PADRAO } });
    renderizarRota("/dashboard/store");

    expect(await screen.findByLabelText("Nome da loja *")).toHaveValue("Globo Motors");
    for (const rotulo of ["Cidade", "Slogan", "WhatsApp da loja", "Instagram"]) {
      expect(screen.getByLabelText(rotulo)).toHaveValue("");
    }
    expect(screen.getByLabelText("Instagram")).toHaveAttribute("placeholder", "@globomotors");

    await usuario.click(screen.getByRole("button", SALVAR));

    expect(await screen.findByText("Dados da loja salvos.")).toBeInTheDocument();
    expect(api.corpos("PUT /api/dashboard/store")).toEqual([LOJA_PADRAO]);
    expect(screen.getByLabelText("Instagram")).toHaveValue("");
  });

  it("aponta os campos inválidos sem chamar o servidor e salva depois de corrigidos", async () => {
    const usuario = userEvent.setup();
    const api = simularLoja();
    renderizarRota("/dashboard/store");
    await screen.findByLabelText("Nome da loja *");

    await preencher(usuario, {
      "Nome da loja *": "   ",
      "WhatsApp da loja": "1234",
      Instagram: "@globo motors",
    });
    await usuario.click(screen.getByRole("button", SALVAR));

    expect(await screen.findByRole("alert")).toHaveTextContent("Confira os campos destacados.");
    const nome = screen.getByLabelText("Nome da loja *");
    expect(nome).toHaveAttribute("aria-invalid", "true");
    expect(nome).toHaveAccessibleDescription("Informe o nome da loja.");
    expect(screen.getByLabelText("WhatsApp da loja")).toHaveAccessibleDescription(
      "Telefone inválido: informe DDD e número, como (62) 99999-0000.",
    );
    expect(screen.getByLabelText("Instagram")).toHaveAccessibleDescription(
      "Instagram inválido: informe o @ do perfil.",
    );
    expect(screen.getByLabelText("Cidade")).not.toHaveAttribute("aria-invalid");
    expect(alteracoes(api.chaves())).toEqual([]);

    await preencher(usuario, {
      "Nome da loja *": "Globo Motors",
      "WhatsApp da loja": "",
      Instagram: "",
    });
    await usuario.click(screen.getByRole("button", SALVAR));

    expect(await screen.findByText("Dados da loja salvos.")).toBeInTheDocument();
    expect(api.corpos("PUT /api/dashboard/store")).toEqual([
      { ...LOJA, whatsapp: null, instagram: null },
    ]);
    expect(screen.getByLabelText("Nome da loja *")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("WhatsApp da loja")).toHaveAccessibleDescription(
      "Recebe as mensagens dos clientes que clicam em “Tenho interesse”.",
    );
  });

  it("salva os dados normalizados, atualiza o topo do painel e a vitrine", async () => {
    const usuario = userEvent.setup();
    let responder: (resposta: unknown) => void = () => undefined;
    const salva: Loja = {
      nome: "Auto Center Campinas",
      cidade: null,
      slogan: "Os melhores seminovos",
      whatsapp: "1933334444",
      instagram: "auto.center",
      mostrarPreco: false,
      mostrarVendidos: true,
    };
    const api = simularLoja({
      "PUT /api/dashboard/store": () =>
        new Promise((resolver) => {
          responder = resolver;
        }),
    });
    const { queryClient } = renderizarRota("/dashboard/store");
    queryClient.setQueryData(["vitrine", "loja"], LOJA_PUBLICA);
    queryClient.setQueryData(["vitrine", "carros"], [carroPublico()]);
    await screen.findByLabelText("Nome da loja *");
    expect(nomeNoTopo()).toMatch(/^Globo Motors/);

    await preencher(usuario, {
      "Nome da loja *": "  Auto Center Campinas ",
      Cidade: "",
      Slogan: " Os melhores seminovos ",
      "WhatsApp da loja": "+55 (19) 3333-4444",
      Instagram: "https://www.instagram.com/auto.center/",
    });
    await usuario.click(screen.getByRole("checkbox", { name: "Mostrar preços no catálogo" }));
    await usuario.click(
      screen.getByRole("checkbox", { name: "Mostrar veículos vendidos no catálogo" }),
    );
    await usuario.click(screen.getByRole("button", SALVAR));

    expect(await screen.findByRole("button", { name: "Salvando…" })).toBeDisabled();
    expect(api.corpos("PUT /api/dashboard/store")).toEqual([salva]);

    api.rotas["GET /api/dashboard/store"] = { loja: salva };
    responder({ loja: salva });

    expect(await screen.findByText("Dados da loja salvos.")).toHaveAttribute("role", "status");
    expect(screen.getByRole("button", SALVAR)).toBeEnabled();
    expect(screen.getByLabelText("Nome da loja *")).toHaveValue("Auto Center Campinas");
    expect(screen.getByLabelText("Cidade")).toHaveValue("");
    expect(screen.getByLabelText("Slogan")).toHaveValue("Os melhores seminovos");
    expect(screen.getByLabelText("WhatsApp da loja")).toHaveValue("(19) 3333-4444");
    expect(screen.getByLabelText("Instagram")).toHaveValue("@auto.center");
    expect(screen.getByRole("checkbox", { name: "Mostrar preços no catálogo" })).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Mostrar veículos vendidos no catálogo" }),
    ).toBeChecked();
    expect(nomeNoTopo()).toMatch(/^Auto Center Campinas/);
    expect(queryClient.getQueryState(["vitrine", "loja"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["vitrine", "carros"])?.isInvalidated).toBe(true);
    expect(alteracoes(api.chaves())).toEqual(["PUT /api/dashboard/store"]);
  });

  it("avisa quando não consegue salvar e mantém o que foi digitado", async () => {
    const usuario = userEvent.setup();
    simularLoja({
      "PUT /api/dashboard/store": () => {
        throw new TypeError("Failed to fetch");
      },
    });
    renderizarRota("/dashboard/store");
    await screen.findByLabelText("Nome da loja *");

    await preencher(usuario, { "Nome da loja *": "Auto Center Campinas" });
    await usuario.click(screen.getByRole("button", SALVAR));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
    );
    const nome = screen.getByLabelText("Nome da loja *");
    expect(nome).toHaveValue("Auto Center Campinas");
    expect(nome).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("button", SALVAR)).toBeEnabled();
    expect(nomeNoTopo()).toMatch(/^Globo Motors/);
  });

  it("continua no formulário quando a atualização em segundo plano falha depois de salvar", async () => {
    const usuario = userEvent.setup();
    const api = simularLoja({
      "PUT /api/dashboard/store": ({ corpo }: RequisicaoSimulada) => {
        api.rotas["GET /api/dashboard/store"] = respostaDeErro(
          500,
          "erro_interno",
          "Erro interno.",
        );
        return { loja: corpo };
      },
    });
    const { queryClient } = renderizarRota("/dashboard/store");
    await screen.findByLabelText("Nome da loja *");

    await preencher(usuario, {
      "Nome da loja *": "Auto Center Campinas",
      Slogan: "Troca com troco",
    });
    await usuario.click(screen.getByRole("button", SALVAR));

    expect(await screen.findByText("Dados da loja salvos.")).toBeInTheDocument();
    await waitFor(() =>
      expect(queryClient.getQueryState(["painel", "loja"])?.status).toBe("error"),
    );
    expect(screen.getByLabelText("Slogan")).toHaveValue("Troca com troco");
    expect(nomeNoTopo()).toMatch(/^Auto Center Campinas/);
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });

  it("copia o link do catálogo", async () => {
    const usuario = userEvent.setup();
    simularLoja();
    renderizarRota("/dashboard/store");
    const copiar = vi.spyOn(navigator.clipboard, "writeText");

    await usuario.click(await screen.findByRole("button", { name: "Copiar link" }));

    expect(await screen.findByText("Link do catálogo copiado.")).toHaveAttribute("role", "status");
    expect(copiar).toHaveBeenCalledTimes(1);
    expect(await navigator.clipboard.readText()).toBe(LINK);
  });

  it("pede para copiar à mão quando o navegador não deixa copiar", async () => {
    const usuario = userEvent.setup();
    simularLoja();
    renderizarRota("/dashboard/store");
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("Permissão negada.", "NotAllowedError"),
    );

    await usuario.click(await screen.findByRole("button", { name: "Copiar link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível copiar. Selecione o link e copie manualmente.",
    );
    expect(screen.getByRole("link", { name: LINK })).toHaveAttribute("href", LINK);
  });

  it("mostra o carregamento, avisa a falha e tenta de novo", async () => {
    const usuario = userEvent.setup();
    let responder: (resposta: unknown) => void = () => undefined;
    const api = simularLoja({
      "GET /api/dashboard/store": () =>
        new Promise((resolver) => {
          responder = resolver;
        }),
    });
    renderizarRota("/dashboard/store");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Dados da loja" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando…");

    responder(respostaDeErro(500, "erro_interno", "Erro interno."));

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno.");
    expect(screen.queryByLabelText("Nome da loja *")).not.toBeInTheDocument();

    api.rotas["GET /api/dashboard/store"] = { loja: LOJA };
    await usuario.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByLabelText("Nome da loja *")).toHaveValue("Globo Motors");
  });
});
