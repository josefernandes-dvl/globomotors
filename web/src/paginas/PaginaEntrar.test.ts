import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { rotasDoPainel, USUARIO } from "../testes/dados.ts";
import { renderizarRota } from "../testes/renderizar.tsx";
import { respostaDeErro, simularApi, type RotasSimuladas } from "../testes/simularApi.ts";

const SEM_SESSAO = {
  "GET /api/auth/me": respostaDeErro(401, "nao_autenticado", "Entre para continuar."),
};

function simularLogin(rotas: RotasSimuladas = {}) {
  return simularApi(
    rotasDoPainel({
      ...SEM_SESSAO,
      "POST /api/auth/login": { usuario: USUARIO },
      "GET /api/dashboard/cars": { carros: [] },
      "GET /api/dashboard/customers": { clientes: [] },
      ...rotas,
    }),
  );
}

async function preencherEEntrar(email: string, senha: string) {
  const usuario = userEvent.setup();
  await usuario.type(await screen.findByLabelText("E-mail"), email);
  await usuario.type(screen.getByLabelText("Senha"), senha);
  await usuario.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("PaginaEntrar", () => {
  it("valida o formulário antes de chamar a API", async () => {
    const usuario = userEvent.setup();
    const api = simularLogin();
    renderizarRota("/login");

    expect(await screen.findByRole("heading", { name: "Painel do vendedor" })).toBeInTheDocument();
    expect(
      screen.getByText("Entre com o e-mail e a senha cadastrados pela loja."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver a vitrine" })).toHaveAttribute("href", "/");
    await waitFor(() => expect(document.title).toBe("Entrar · Painel do vendedor"));

    await usuario.click(screen.getByRole("button", { name: "Entrar" }));
    const email = screen.getByLabelText("E-mail");
    const senha = screen.getByLabelText("Senha");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Informe o e-mail.");
    expect(senha).toHaveAccessibleDescription("Informe a senha.");

    await usuario.type(email, "marcos@");
    await usuario.click(senha);
    await usuario.paste("x".repeat(201));
    await usuario.click(screen.getByRole("button", { name: "Entrar" }));
    expect(email).toHaveAccessibleDescription("E-mail inválido.");
    expect(senha).toHaveAccessibleDescription("Senha longa demais.");

    await usuario.clear(senha);
    await usuario.type(email, "globomotors.test");
    await usuario.type(senha, "teste123");
    await usuario.click(screen.getByRole("button", { name: "Entrar" }));
    expect(email).not.toHaveAttribute("aria-invalid");
    expect(senha).not.toHaveAttribute("aria-invalid");
    expect(api.chaves().filter((chave) => chave.startsWith("POST"))).toEqual([
      "POST /api/auth/login",
    ]);
  });

  it("entra com o e-mail normalizado e abre o painel", async () => {
    let responder: (resposta: unknown) => void = () => undefined;
    const api = simularLogin({
      "POST /api/auth/login": () =>
        new Promise((resolver) => {
          responder = resolver;
        }),
    });
    const { router } = renderizarRota("/login");

    await preencherEEntrar("  Marcos@GloboMotors.TEST ", "teste123");

    expect(screen.getByRole("button", { name: "Entrando…" })).toBeDisabled();
    expect(api.corpos("POST /api/auth/login")).toEqual([
      { email: "marcos@globomotors.test", senha: "teste123" },
    ]);
    responder({ usuario: USUARIO });
    expect(await screen.findByRole("heading", { name: "Carros" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard/cars");
    expect(screen.getByText(USUARIO.nome)).toBeInTheDocument();
  });

  it("volta para a página do painel que pediu o login", async () => {
    simularLogin();
    const { router } = renderizarRota({
      pathname: "/login",
      state: { de: "/dashboard/customers?search=ana" },
    });

    await preencherEEntrar("marcos@globomotors.test", "teste123");

    expect(await screen.findByRole("heading", { name: "Clientes" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard/customers");
    expect(router.state.location.search).toBe("?search=ana");
  });

  it("ignora destino fora do painel", async () => {
    simularLogin();
    const { router } = renderizarRota({
      pathname: "/login",
      state: { de: "https://golpe.example/painel" },
    });

    await preencherEEntrar("marcos@globomotors.test", "teste123");

    expect(await screen.findByRole("heading", { name: "Carros" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard/cars");
  });

  it.each([
    [401, "credenciais_invalidas", "E-mail ou senha incorretos."],
    [429, "muitas_tentativas", "Muitas tentativas de login. Tente de novo em 15 min."],
  ] as const)(
    "mostra o erro %i da API e deixa tentar de novo",
    async (status, codigo, mensagem) => {
      simularLogin({ "POST /api/auth/login": respostaDeErro(status, codigo, mensagem) });
      const { router } = renderizarRota("/login");

      await preencherEEntrar("marcos@globomotors.test", "errada");

      expect(await screen.findByRole("alert")).toHaveTextContent(mensagem);
      expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
      expect(router.state.location.pathname).toBe("/login");
    },
  );

  it("leva direto ao painel quem já entrou", async () => {
    simularLogin({ "GET /api/auth/me": { usuario: USUARIO } });

    const { router } = renderizarRota("/login");

    expect(await screen.findByRole("heading", { name: "Carros" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard/cars");
  });
});
