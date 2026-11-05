import type { CodigoErro, StatusCarro } from "@globomotors/shared";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { userEvent, type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { comprimirFoto } from "../../lib/fotos.ts";
import { carroPainel, cliente, interesse, rotasDoPainel } from "../../testes/dados.ts";
import { renderizarRota } from "../../testes/renderizar.tsx";
import { respostaDeErro, simularApi, type RotasSimuladas } from "../../testes/simularApi.ts";

vi.mock("../../lib/fotos.ts", () => ({ comprimirFoto: vi.fn() }));

const FOTOS = [1, 2, 3].map((numero) => ({
  id: `f${numero}`,
  url: `/api/dashboard/photos/f${numero}`,
}));
const ONIX = carroPainel({ fotos: FOTOS.slice(0, 2) });
const CRIADO = carroPainel({
  id: "c9",
  slug: "fiat-pulse-2023-c9",
  marca: "Fiat",
  modelo: "Pulse",
  fotos: [],
});

function simularFormulario(rotas: RotasSimuladas = {}) {
  const todas = rotasDoPainel({
    "GET /api/dashboard/cars": { carros: [] },
    "GET /api/dashboard/cars/c1": { carro: ONIX },
    "GET /api/dashboard/interests?carId=c1": { interesses: [] },
    "GET /api/dashboard/customers": { clientes: [] },
    ...rotas,
  });
  return { ...simularApi(todas), rotas: todas };
}

function reduzirFoto(arquivo: Blob) {
  const nome = arquivo instanceof File ? arquivo.name : "foto";
  return Promise.resolve(new File([arquivo], `reduzida-${nome}`, { type: "image/jpeg" }));
}

function foto(nome: string, tipo = "image/jpeg") {
  return new File([nome], nome, { type: tipo });
}

function variasFotos(prefixo: string, quantidade: number) {
  return Array.from({ length: quantidade }, (_, indice) => foto(`${prefixo}${indice + 1}.jpg`));
}

function entradaDeFotos() {
  return screen.getByLabelText(/^Adicionar fotos/);
}

function soltarFotos(arquivos: File[]) {
  fireEvent.drop(screen.getByText("Adicionar fotos"), { dataTransfer: { files: arquivos } });
}

function fotosNaTela() {
  return screen
    .queryAllByRole("img", { name: /^Foto \d+$/ })
    .map((imagem) => imagem.getAttribute("src"));
}

function valorDe(termo: string) {
  return screen.getByText(termo).nextElementSibling;
}

function formulario() {
  return screen.getByLabelText("Marca *").closest("form");
}

function alteracoes(chaves: string[]) {
  return chaves.filter((chave) => !chave.startsWith("GET"));
}

function adicionais() {
  return screen.getByRole("group", { name: "Adicionais" });
}

function novoAdicional() {
  return screen.getByRole("textbox", { name: "Novo adicional" });
}

function botaoAdicionar() {
  return within(adicionais()).getByRole("button", { name: "Adicionar" });
}

function itensAdicionais() {
  return within(adicionais())
    .queryAllByRole("listitem")
    .map((item) => item.textContent);
}

async function preencher(usuario: UserEvent, campos: Record<string, string>) {
  for (const [rotulo, texto] of Object.entries(campos)) {
    await usuario.clear(screen.getByLabelText(rotulo));
    if (texto) await usuario.paste(texto);
  }
}

describe("PaginaFormularioCarro", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T15:00:00.000Z"));
    vi.mocked(comprimirFoto).mockReset().mockImplementation(reduzirFoto);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("novo carro", () => {
    it("abre vazio, com a data de hoje, e calcula a margem e os dias em estoque", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario();
      const { router } = renderizarRota("/dashboard/cars/new");

      expect(
        await screen.findByRole("heading", { level: 1, name: "Novo veículo" }),
      ).toBeInTheDocument();
      await waitFor(() => expect(document.title).toBe("Novo veículo · Painel"));
      expect(
        screen.getAllByRole("heading", { level: 2 }).map((titulo) => titulo.textContent),
      ).toEqual(["Preencher com IA", "Fotos", "Veículo", "Anúncio", "Só para você"]);
      const privada = screen
        .getByRole("heading", { level: 2, name: "Só para você" })
        .closest("section");
      expect(privada).toHaveTextContent("Nada desta parte aparece no catálogo.");
      const vendedor = screen.getByRole("group", { name: "Vendedor" });
      expect(privada).toContainElement(vendedor);
      expect(privada).toContainElement(screen.getByLabelText("Preço de compra (R$)"));
      expect(privada).not.toContainElement(adicionais());
      expect(within(vendedor).getByLabelText("Nome")).toHaveAttribute(
        "placeholder",
        "Loja ou pessoa que está vendendo",
      );
      expect(within(vendedor).getByLabelText("Telefone")).toHaveAttribute("type", "tel");
      expect(screen.getByLabelText("Câmbio")).toHaveDisplayValue("Selecione");
      expect(
        within(screen.getByLabelText("Carroceria"))
          .getAllByRole("option")
          .map((opcao) => opcao.textContent),
      ).toEqual([
        "Selecione",
        "Hatch",
        "Sedã",
        "SUV",
        "Picape",
        "Minivan",
        "Cupê",
        "Conversível",
        "Utilitário",
        "Moto",
        "Scooter",
        "Moto elétrica",
        "Patinete",
      ]);
      expect(itensAdicionais()).toEqual([]);
      expect(document.body).not.toHaveTextContent("—");
      expect(document.body).not.toHaveTextContent(/vitrine/i);
      expect(screen.getByText("0 de 20")).toBeInTheDocument();
      expect(fotosNaTela()).toEqual([]);
      expect(formulario()).toHaveFormValues({
        marca: "",
        modelo: "",
        cambio: "",
        precoVenda: "",
        status: "rascunho",
        destaque: false,
        vendedorNome: "",
        vendedorTelefone: "",
        dataEntrada: "2026-10-30",
      });
      expect(valorDe("Margem estimada:")).toHaveTextContent("informe venda e compra");
      expect(valorDe("Em estoque há:")).toHaveTextContent(/^0 dias$/);
      expect(screen.queryByRole("link", { name: "Ver no catálogo" })).not.toBeInTheDocument();
      expect(
        screen.getByText(
          "Depois de salvar o veículo, você pode registrar os clientes interessados nele.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Adicionar ao catálogo" })).toBeEnabled();

      await preencher(usuario, {
        "Preço de venda (R$)": "89.900",
        "Preço de compra (R$)": "75.000",
        "Preparação (R$)": "1.200",
        "Documentação (R$)": "800",
        "Comissão (R$)": "500",
      });
      expect(valorDe("Margem estimada:")).toHaveTextContent("R$ 12.400");

      await preencher(usuario, { "Preço de venda (R$)": "70.000" });
      expect(valorDe("Margem estimada:")).toHaveTextContent("-R$ 7.500");
      expect(valorDe("Margem estimada:")).toHaveClass("text-perigo");

      await preencher(usuario, { "Preço de compra (R$)": "abc" });
      expect(valorDe("Margem estimada:")).toHaveTextContent("informe venda e compra");
      expect(valorDe("Margem estimada:")).not.toHaveClass("text-perigo");

      const entrada = screen.getByLabelText("Data de entrada");
      fireEvent.change(entrada, { target: { value: "2026-10-20" } });
      expect(valorDe("Em estoque há:")).toHaveTextContent(/^10 dias$/);
      fireEvent.change(entrada, { target: { value: "2026-10-29" } });
      expect(valorDe("Em estoque há:")).toHaveTextContent(/^1 dia$/);
      fireEvent.change(entrada, { target: { value: "2026-11-02" } });
      expect(screen.queryByText("Em estoque há:")).not.toBeInTheDocument();

      await usuario.click(screen.getByRole("link", { name: "Cancelar" }));

      expect(
        await screen.findByRole("heading", { level: 1, name: "Veículos" }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/dashboard/cars");
      expect(alteracoes(api.chaves())).toEqual([]);
    });

    it("exige marca e modelo e não chama a API enquanto houver erro", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario();
      renderizarRota("/dashboard/cars/new");
      const marca = await screen.findByLabelText("Marca *");

      await usuario.click(screen.getByRole("button", { name: "Adicionar ao catálogo" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Confira os campos destacados.");
      expect(marca).toHaveAttribute("aria-invalid", "true");
      expect(marca).toHaveAccessibleDescription("Informe a marca.");
      expect(screen.getByLabelText("Modelo *")).toHaveAccessibleDescription("Informe o modelo.");

      await usuario.type(marca, "Fiat");
      await usuario.click(screen.getByRole("button", { name: "Adicionar ao catálogo" }));

      expect(marca).not.toHaveAttribute("aria-invalid");
      expect(screen.getByLabelText("Modelo *")).toHaveAttribute("aria-invalid", "true");
      expect(alteracoes(api.chaves())).toEqual([]);
    });

    it("aplica as regras compartilhadas do carro antes de enviar", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario();
      renderizarRota("/dashboard/cars/new");
      await screen.findByLabelText("Marca *");
      const salvar = () =>
        usuario.click(screen.getByRole("button", { name: "Adicionar ao catálogo" }));

      await preencher(usuario, {
        "Marca *": "Fiat",
        "Modelo *": "Pulse",
        "Ano de fabricação": "2020",
        "Ano modelo": "2022",
        "Preço de venda (R$)": "50.000",
        "Preço mínimo (R$)": "60.000",
      });
      await salvar();

      expect(screen.getByLabelText("Ano modelo")).toHaveAccessibleDescription(
        "O ano modelo deve ser o de fabricação ou o seguinte.",
      );
      expect(screen.getByLabelText("Preço mínimo (R$)")).toHaveAccessibleDescription(
        "O preço mínimo não pode passar do preço anunciado.",
      );

      await preencher(usuario, {
        "Ano modelo": "2021",
        "Preço mínimo (R$)": "45.000",
        Quilometragem: "abc",
        Portas: "9",
        "Preço de compra (R$)": "abc",
        Placa: "XYZ",
        Chassi: "123",
        Renavam: "123",
        Nome: "x".repeat(101),
        Telefone: "123",
      });
      fireEvent.change(screen.getByLabelText("Data de entrada"), {
        target: { value: "2026-11-02" },
      });
      await salvar();

      expect(screen.getByLabelText("Ano modelo")).not.toHaveAttribute("aria-invalid");
      expect(screen.getByLabelText("Preço mínimo (R$)")).not.toHaveAttribute("aria-invalid");
      expect(screen.getByLabelText("Quilometragem")).toHaveAccessibleDescription(
        "Informe a quilometragem em número inteiro.",
      );
      expect(screen.getByLabelText("Portas")).toHaveAccessibleDescription(
        "Informe de 1 a 6 portas.",
      );
      expect(screen.getByLabelText("Preço de compra (R$)")).toHaveAccessibleDescription(
        "Informe um valor válido.",
      );
      expect(screen.getByLabelText("Placa")).toHaveAccessibleDescription(
        "Placa inválida: use ABC1D23 ou ABC-1234.",
      );
      expect(screen.getByLabelText("Chassi")).toHaveAccessibleDescription(
        "Chassi inválido: são 17 letras e números, sem I, O e Q.",
      );
      expect(screen.getByLabelText("Renavam")).toHaveAccessibleDescription(
        "Renavam inválido: confira os dígitos.",
      );
      expect(screen.getByLabelText("Data de entrada")).toHaveAccessibleDescription(
        "A data de entrada não pode estar no futuro.",
      );
      expect(screen.getByLabelText("Nome")).toHaveAccessibleDescription(
        "Use no máximo 100 caracteres.",
      );
      expect(screen.getByLabelText("Telefone")).toHaveAccessibleDescription(
        "Telefone inválido: informe DDD e número, como (62) 99999-0000.",
      );

      await preencher(usuario, { "Ano de fabricação": "1800", "Ano modelo": "2028" });
      await salvar();

      expect(screen.getByLabelText("Ano de fabricação")).toHaveAccessibleDescription(
        "Informe um ano a partir de 1900.",
      );
      expect(screen.getByLabelText("Ano modelo")).toHaveAccessibleDescription(
        "Informe um ano até 2027.",
      );
      expect(alteracoes(api.chaves())).toEqual([]);
    });

    it("converte os campos, cria o carro e volta ao catálogo", async () => {
      const usuario = userEvent.setup();
      let responder: (resposta: unknown) => void = () => undefined;
      const api = simularFormulario({
        "POST /api/dashboard/cars": () =>
          new Promise((resolver) => {
            responder = resolver;
          }),
      });
      const { router } = renderizarRota("/dashboard/cars/new");
      await screen.findByLabelText("Marca *");

      await preencher(usuario, {
        "Marca *": " Fiat ",
        "Modelo *": "Pulse",
        Versão: "Drive 1.3",
        "Ano de fabricação": "2022",
        "Ano modelo": "2023",
        Quilometragem: "35.000",
        Cor: "Branco",
        Motor: "1.3",
        Portas: "4",
        Descrição: "Revisado.",
        "Preço de venda (R$)": "72.900,50",
        "Preço de compra (R$)": "60.000",
        "Preparação (R$)": "1.500",
        "Comissão (R$)": "700",
        "Preço mínimo (R$)": "70.000",
        Placa: "abc-1d23",
        Chassi: "9bwzzz377vt004251",
        Renavam: "123456789",
        Nome: "Garagem Central",
        Telefone: "+55 (11) 98765-4321",
        Origem: "Compra direta",
        "Observações internas": "Revisar freios",
      });
      await usuario.type(novoAdicional(), "Ar-condicionado{Enter}");
      await usuario.type(novoAdicional(), "Multimídia");
      await usuario.click(botaoAdicionar());
      await usuario.selectOptions(screen.getByLabelText("Câmbio"), "CVT");
      await usuario.selectOptions(screen.getByLabelText("Combustível"), "Flex");
      await usuario.selectOptions(screen.getByLabelText("Carroceria"), "SUV");
      await usuario.selectOptions(screen.getByLabelText("Status"), "Disponível");
      await usuario.click(screen.getByLabelText("Destaque no catálogo"));
      await usuario.click(screen.getByRole("button", { name: "Adicionar ao catálogo" }));

      expect(await screen.findByRole("button", { name: "Salvando…" })).toBeDisabled();
      await waitFor(() =>
        expect(api.corpos("POST /api/dashboard/cars")).toEqual([
          {
            marca: "Fiat",
            modelo: "Pulse",
            versao: "Drive 1.3",
            anoFabricacao: 2022,
            anoModelo: 2023,
            km: 35_000,
            cambio: "CVT",
            combustivel: "Flex",
            carroceria: "SUV",
            cor: "Branco",
            motor: "1.3",
            portas: 4,
            opcionais: ["Ar-condicionado", "Multimídia"],
            descricao: "Revisado.",
            precoVenda: 7_290_050,
            destaque: true,
            status: "disponivel",
            precoCompra: 6_000_000,
            custoPreparacao: 150_000,
            custoDocumentacao: null,
            custoComissao: 70_000,
            precoMinimo: 7_000_000,
            dataEntrada: "2026-10-30",
            placa: "ABC1D23",
            chassi: "9BWZZZ377VT004251",
            renavam: "00123456789",
            origem: "Compra direta",
            vendedorNome: "Garagem Central",
            vendedorTelefone: "11987654321",
            observacoesInternas: "Revisar freios",
          },
        ]),
      );

      responder({ carro: CRIADO });

      expect(await screen.findByText("Veículo adicionado ao catálogo.")).toHaveAttribute(
        "role",
        "status",
      );
      expect(
        await screen.findByRole("heading", { level: 1, name: "Veículos" }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/dashboard/cars");
      expect(alteracoes(api.chaves())).toEqual(["POST /api/dashboard/cars"]);
    });
  });

  describe("fotos", () => {
    it("envia as fotos novas na ordem escolhida depois de criar o carro", async () => {
      const usuario = userEvent.setup();
      const revogar = vi.spyOn(URL, "revokeObjectURL");
      let enviadas = 0;
      const api = simularFormulario({
        "POST /api/dashboard/cars": { carro: CRIADO },
        "POST /api/dashboard/cars/c9/photos": () => {
          enviadas += 1;
          return { foto: { id: `n${enviadas}`, url: `/api/dashboard/photos/n${enviadas}` } };
        },
      });
      const { router } = renderizarRota("/dashboard/cars/new");
      await screen.findByLabelText("Marca *");

      await usuario.upload(entradaDeFotos(), [
        foto("a.jpg"),
        foto("b.png", "image/png"),
        foto("c.webp", "image/webp"),
      ]);

      expect(await screen.findByText("3 de 20")).toBeInTheDocument();
      const [a, b, c] = fotosNaTela();
      expect(screen.getByText("Capa").closest("li")).toContainElement(
        screen.getByRole("img", { name: "Foto 1" }),
      );
      expect(screen.getByRole("button", { name: "Mover foto 1 para a esquerda" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Mover foto 1 para a direita" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Mover foto 3 para a direita" })).toBeDisabled();

      await usuario.click(screen.getByRole("button", { name: "Mover foto 3 para a esquerda" }));
      expect(fotosNaTela()).toEqual([a, c, b]);

      await usuario.click(screen.getByRole("button", { name: "Remover foto 1" }));
      expect(fotosNaTela()).toEqual([c, b]);
      expect(screen.getByText("2 de 20")).toBeInTheDocument();
      expect(revogar).toHaveBeenCalledWith(a);

      await preencher(usuario, { "Marca *": "Fiat", "Modelo *": "Pulse" });
      await usuario.click(screen.getByRole("button", { name: "Adicionar ao catálogo" }));

      expect(await screen.findByText("Veículo adicionado ao catálogo.")).toBeInTheDocument();
      expect(alteracoes(api.chaves())).toEqual([
        "POST /api/dashboard/cars",
        "POST /api/dashboard/cars/c9/photos",
        "POST /api/dashboard/cars/c9/photos",
      ]);
      expect(
        api.corpos("POST /api/dashboard/cars/c9/photos").map((corpo) => (corpo as File).name),
      ).toEqual(["reduzida-c.webp", "reduzida-b.png"]);
      expect(
        await screen.findByRole("heading", { level: 1, name: "Veículos" }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/dashboard/cars");
      expect(revogar).toHaveBeenCalledWith(b);
      expect(revogar).toHaveBeenCalledWith(c);
    });

    it("bloqueia o envio enquanto prepara as fotos", async () => {
      const usuario = userEvent.setup();
      const pendentes: ((reduzida: Blob) => void)[] = [];
      vi.mocked(comprimirFoto).mockImplementation(
        () =>
          new Promise((resolver) => {
            pendentes.push(resolver);
          }),
      );
      simularFormulario();
      renderizarRota("/dashboard/cars/new");
      await screen.findByLabelText("Marca *");

      await usuario.upload(entradaDeFotos(), variasFotos("foto", 2));

      expect(screen.getByText("Preparando 2 fotos…")).toHaveAttribute("role", "status");
      expect(screen.getByRole("button", { name: "Adicionar ao catálogo" })).toBeDisabled();

      pendentes[0]?.(foto("reduzida-1.jpg"));
      expect(await screen.findByText("Preparando 1 foto…")).toBeInTheDocument();
      expect(screen.getByText("1 de 20")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Adicionar ao catálogo" })).toBeDisabled();

      pendentes[1]?.(foto("reduzida-2.jpg"));
      expect(await screen.findByText("2 de 20")).toBeInTheDocument();
      expect(screen.queryByText(/^Preparando/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Adicionar ao catálogo" })).toBeEnabled();
    });

    it("aceita fotos arrastadas e para no limite de 20 por carro", async () => {
      const usuario = userEvent.setup();
      simularFormulario();
      renderizarRota("/dashboard/cars/new");
      await screen.findByLabelText("Marca *");

      soltarFotos(variasFotos("arrastada", 15));
      expect(await screen.findByText("15 de 20")).toBeInTheDocument();

      await usuario.upload(entradaDeFotos(), variasFotos("escolhida", 6));

      expect(await screen.findByText("Cada veículo pode ter no máximo 20 fotos.")).toHaveAttribute(
        "role",
        "alert",
      );
      expect(await screen.findByText("20 de 20")).toBeInTheDocument();
      expect(entradaDeFotos()).toBeDisabled();

      soltarFotos([foto("mais-uma.jpg")]);

      expect(screen.getByText("20 de 20")).toBeInTheDocument();
      expect(screen.queryByText(/^Preparando/)).not.toBeInTheDocument();
      expect(comprimirFoto).toHaveBeenCalledTimes(20);
    });

    it("avisa a foto que não pôde ser lida e continua com as outras", async () => {
      const usuario = userEvent.setup();
      vi.mocked(comprimirFoto).mockImplementation((arquivo) =>
        arquivo instanceof File && arquivo.name === "corrompida.png"
          ? Promise.reject(new Error("Não foi possível ler esta imagem. Use JPG, PNG ou WebP."))
          : reduzirFoto(arquivo),
      );
      simularFormulario();
      renderizarRota("/dashboard/cars/new");
      await screen.findByLabelText("Marca *");

      await usuario.upload(entradaDeFotos(), [
        foto("a.jpg"),
        foto("corrompida.png", "image/png"),
        foto("c.jpg"),
      ]);

      expect(
        await screen.findByText(
          "corrompida.png: Não foi possível ler esta imagem. Use JPG, PNG ou WebP.",
        ),
      ).toHaveAttribute("role", "alert");
      expect(await screen.findByText("2 de 20")).toBeInTheDocument();
      expect(screen.queryByText(/^Preparando/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Adicionar ao catálogo" })).toBeEnabled();
    });

    it("apaga, envia e reordena as fotos ao salvar a edição", async () => {
      const usuario = userEvent.setup();
      const comTresFotos = carroPainel({ fotos: FOTOS });
      const api = simularFormulario({
        "GET /api/dashboard/cars/c1": { carro: comTresFotos },
        "PUT /api/dashboard/cars/c1": { carro: comTresFotos },
        "DELETE /api/dashboard/cars/c1/photos/f2": new Response(null, { status: 204 }),
        "POST /api/dashboard/cars/c1/photos": {
          foto: { id: "n1", url: "/api/dashboard/photos/n1" },
        },
        "PATCH /api/dashboard/cars/c1/photos": new Response(null, { status: 204 }),
      });
      renderizarRota("/dashboard/cars/c1");
      expect(await screen.findByText("3 de 20")).toBeInTheDocument();

      await usuario.click(screen.getByRole("button", { name: "Remover foto 2" }));
      expect(screen.getByText("2 de 20")).toBeInTheDocument();
      await usuario.upload(entradaDeFotos(), foto("nova.jpg"));
      expect(await screen.findByText("3 de 20")).toBeInTheDocument();
      const [, , nova] = fotosNaTela();
      await usuario.click(screen.getByRole("button", { name: "Mover foto 3 para a esquerda" }));
      await usuario.click(screen.getByRole("button", { name: "Mover foto 2 para a esquerda" }));
      expect(fotosNaTela()).toEqual([nova, "/api/dashboard/photos/f1", "/api/dashboard/photos/f3"]);

      await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));

      expect(await screen.findByText("Alterações salvas.")).toHaveAttribute("role", "status");
      expect(alteracoes(api.chaves())).toEqual([
        "PUT /api/dashboard/cars/c1",
        "DELETE /api/dashboard/cars/c1/photos/f2",
        "POST /api/dashboard/cars/c1/photos",
        "PATCH /api/dashboard/cars/c1/photos",
      ]);
      expect(
        api.corpos("POST /api/dashboard/cars/c1/photos").map((corpo) => (corpo as File).name),
      ).toEqual(["reduzida-nova.jpg"]);
      expect(api.corpos("PATCH /api/dashboard/cars/c1/photos")).toEqual([
        { ordem: ["n1", "f1", "f3"] },
      ]);
    });

    it("avisa a falha no envio de uma foto e abre o carro já criado", async () => {
      const usuario = userEvent.setup();
      let enviadas = 0;
      const api = simularFormulario({
        "POST /api/dashboard/cars": { carro: CRIADO },
        "POST /api/dashboard/cars/c9/photos": () => {
          enviadas += 1;
          return enviadas === 1
            ? { foto: { id: "n1", url: "/api/dashboard/photos/n1" } }
            : respostaDeErro(400, "arquivo_invalido", "Envie uma imagem JPG, PNG ou WebP.");
        },
        "GET /api/dashboard/cars/c9": {
          carro: { ...CRIADO, fotos: [{ id: "n1", url: "/api/dashboard/photos/n1" }] },
        },
        "GET /api/dashboard/interests?carId=c9": { interesses: [] },
      });
      const { router } = renderizarRota("/dashboard/cars/new");
      await screen.findByLabelText("Marca *");
      await usuario.upload(entradaDeFotos(), variasFotos("foto", 2));
      expect(await screen.findByText("2 de 20")).toBeInTheDocument();
      await preencher(usuario, { "Marca *": "Fiat", "Modelo *": "Pulse" });

      await usuario.click(screen.getByRole("button", { name: "Adicionar ao catálogo" }));

      expect(
        await screen.findByText(
          "O veículo foi salvo, mas houve um problema com as fotos: Envie uma imagem JPG, PNG ou WebP.",
        ),
      ).toHaveAttribute("role", "alert");
      expect(await screen.findByText("1 de 20")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: "Editar veículo" })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/dashboard/cars/c9");
      expect(router.state.historyAction).toBe("REPLACE");
      expect(fotosNaTela()).toEqual(["/api/dashboard/photos/n1"]);
      expect(alteracoes(api.chaves())).toEqual([
        "POST /api/dashboard/cars",
        "POST /api/dashboard/cars/c9/photos",
        "POST /api/dashboard/cars/c9/photos",
      ]);
    });

    it("avisa a falha ao apagar uma foto e recarrega o carro como ficou no servidor", async () => {
      const usuario = userEvent.setup();
      const salvo = carroPainel({ fotos: ONIX.fotos, atualizadoEm: "2026-10-30T15:00:00.000Z" });
      const api = simularFormulario({
        "PUT /api/dashboard/cars/c1": () => {
          api.rotas["GET /api/dashboard/cars/c1"] = { carro: salvo };
          return { carro: salvo };
        },
        "DELETE /api/dashboard/cars/c1/photos/f1": respostaDeErro(
          500,
          "erro_interno",
          "Erro interno.",
        ),
      });
      renderizarRota("/dashboard/cars/c1");

      await usuario.click(await screen.findByRole("button", { name: "Remover foto 1" }));
      expect(fotosNaTela()).toEqual(["/api/dashboard/photos/f2"]);
      await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));

      expect(
        await screen.findByText(
          "O veículo foi salvo, mas houve um problema com as fotos: Erro interno.",
        ),
      ).toHaveAttribute("role", "alert");
      expect(await screen.findByText("2 de 20")).toBeInTheDocument();
      expect(fotosNaTela()).toEqual(["/api/dashboard/photos/f1", "/api/dashboard/photos/f2"]);
      expect(alteracoes(api.chaves())).toEqual([
        "PUT /api/dashboard/cars/c1",
        "DELETE /api/dashboard/cars/c1/photos/f1",
      ]);
    });
  });

  describe("edição", () => {
    it("carrega o carro com todos os campos, as fotos e os interessados", async () => {
      simularFormulario({
        "GET /api/dashboard/interests?carId=c1": { interesses: [interesse()] },
      });

      renderizarRota("/dashboard/cars/c1");

      expect(await screen.findByLabelText("Marca *")).toHaveValue("Chevrolet");
      expect(formulario()).toHaveFormValues({
        marca: "Chevrolet",
        modelo: "Onix",
        versao: "1.0 Turbo LTZ",
        anoFabricacao: "2020",
        anoModelo: "2021",
        km: "42.000",
        cambio: "Automático",
        combustivel: "Flex",
        carroceria: "Hatch",
        cor: "Prata",
        motor: "1.0 Turbo",
        portas: "4",
        descricao: "Único dono, revisões na concessionária.",
        precoVenda: "89.900",
        status: "disponivel",
        destaque: false,
        precoCompra: "75.000",
        custoPreparacao: "1.200",
        custoDocumentacao: "800",
        custoComissao: "500",
        precoMinimo: "85.000",
        dataEntrada: "2026-10-01",
        placa: "ABC1D23",
        chassi: "9BGKS48U0LG123456",
        renavam: "00123456789",
        origem: "Troca",
        vendedorNome: "Auto Lima Multimarcas",
        vendedorTelefone: "(62) 98888-7777",
        observacoesInternas: "Pneus novos",
      });
      expect(itensAdicionais()).toEqual(["Ar-condicionado", "Multimídia"]);
      expect(valorDe("Margem estimada:")).toHaveTextContent("R$ 12.400");
      expect(valorDe("Em estoque há:")).toHaveTextContent(/^29 dias$/);
      expect(screen.getByText("2 de 20")).toBeInTheDocument();
      expect(fotosNaTela()).toEqual(["/api/dashboard/photos/f1", "/api/dashboard/photos/f2"]);
      const catalogo = screen.getByRole("link", { name: "Ver no catálogo" });
      expect(catalogo).toHaveAttribute("href", "/catalogo/chevrolet-onix-2021-c1");
      expect(catalogo).toHaveAttribute("target", "_blank");
      await waitFor(() => expect(document.title).toBe("Editar veículo · Painel"));
      expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled();

      const interessados = screen.getByRole("region", { name: "Clientes interessados" });
      expect(await within(interessados).findByRole("link", { name: "Ana Souza" })).toHaveAttribute(
        "href",
        "/dashboard/customers/k1",
      );
      expect(within(interessados).getByRole("link", { name: "(11) 91234-5678" })).toHaveAttribute(
        "href",
        "https://wa.me/5511912345678",
      );
    });

    it.each<StatusCarro>(["reservado", "rascunho", "vendido"])(
      "não mostra o link do catálogo com o carro %s",
      async (status) => {
        simularFormulario({ "GET /api/dashboard/cars/c1": { carro: carroPainel({ status }) } });

        renderizarRota("/dashboard/cars/c1");

        expect(await screen.findByLabelText("Status")).toHaveValue(status);
        expect(screen.queryByRole("link", { name: "Ver no catálogo" })).not.toBeInTheDocument();
      },
    );

    it("salva as alterações sem mexer nas fotos", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario({ "PUT /api/dashboard/cars/c1": { carro: ONIX } });
      const { router } = renderizarRota("/dashboard/cars/c1");
      await screen.findByLabelText("Marca *");

      await preencher(usuario, { "Preço de venda (R$)": "87.500" });
      await usuario.click(screen.getByLabelText("Destaque no catálogo"));
      await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));

      expect(await screen.findByText("Alterações salvas.")).toHaveAttribute("role", "status");
      expect(
        await screen.findByRole("heading", { level: 1, name: "Veículos" }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/dashboard/cars");
      expect(alteracoes(api.chaves())).toEqual(["PUT /api/dashboard/cars/c1"]);
      expect(api.corpos("PUT /api/dashboard/cars/c1")).toEqual([
        {
          marca: "Chevrolet",
          modelo: "Onix",
          versao: "1.0 Turbo LTZ",
          anoFabricacao: 2020,
          anoModelo: 2021,
          km: 42_000,
          cambio: "Automático",
          combustivel: "Flex",
          carroceria: "Hatch",
          cor: "Prata",
          motor: "1.0 Turbo",
          portas: 4,
          opcionais: ["Ar-condicionado", "Multimídia"],
          descricao: "Único dono, revisões na concessionária.",
          precoVenda: 8_750_000,
          destaque: true,
          status: "disponivel",
          precoCompra: 7_500_000,
          custoPreparacao: 120_000,
          custoDocumentacao: 80_000,
          custoComissao: 50_000,
          precoMinimo: 8_500_000,
          dataEntrada: "2026-10-01",
          placa: "ABC1D23",
          chassi: "9BGKS48U0LG123456",
          renavam: "00123456789",
          origem: "Troca",
          vendedorNome: "Auto Lima Multimarcas",
          vendedorTelefone: "62988887777",
          observacoesInternas: "Pneus novos",
        },
      ]);
    });

    it("avisa quantos clientes têm possível interesse no veículo salvo", async () => {
      const usuario = userEvent.setup();
      simularFormulario({
        "PUT /api/dashboard/cars/c1": { carro: ONIX, possiveisInteressados: 1 },
      });
      renderizarRota("/dashboard/cars/c1");
      await screen.findByLabelText("Marca *");

      await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));

      expect(
        await screen.findByText(
          "1 cliente tem possível interesse no veículo Chevrolet Onix. Veja em Interesses.",
        ),
      ).toHaveAttribute("role", "status");
      expect(screen.getByText("Alterações salvas.")).toHaveAttribute("role", "status");
    });

    it("marca os campos recusados pela API e limpa as marcas na tentativa seguinte", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario({
        "PUT /api/dashboard/cars/c1": respostaDeErro(
          409,
          "conflito",
          "Já existe um veículo com esta placa.",
          [{ campo: "placa", mensagem: "Já existe um veículo com esta placa." }],
        ),
      });
      renderizarRota("/dashboard/cars/c1");
      const salvar = async () => {
        await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));
        await waitFor(() =>
          expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled(),
        );
      };
      await screen.findByLabelText("Marca *");
      const placa = screen.getByLabelText("Placa");
      const adicional = novoAdicional();

      await salvar();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Já existe um veículo com esta placa.",
      );
      expect(placa).toHaveAttribute("aria-invalid", "true");
      expect(placa).toHaveAccessibleDescription("Já existe um veículo com esta placa.");

      api.rotas["PUT /api/dashboard/cars/c1"] = respostaDeErro(
        400,
        "validacao",
        "Dados inválidos.",
        [{ campo: "opcionais.2", mensagem: "Adicional vazio." }],
      );
      await salvar();

      expect(await screen.findByText("Dados inválidos.")).toHaveAttribute("role", "alert");
      expect(adicional).toHaveAttribute("aria-invalid", "true");
      expect(adicional).toHaveAccessibleDescription("Adicional vazio.");
      expect(placa).not.toHaveAttribute("aria-invalid");

      api.rotas["PUT /api/dashboard/cars/c1"] = () => {
        throw new TypeError("Failed to fetch");
      };
      await salvar();

      expect(
        await screen.findByText(
          "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
        ),
      ).toHaveAttribute("role", "alert");
      expect(adicional).not.toHaveAttribute("aria-invalid");
      expect(adicional).not.toHaveAccessibleDescription();
      expect(alteracoes(api.chaves())).toEqual([
        "PUT /api/dashboard/cars/c1",
        "PUT /api/dashboard/cars/c1",
        "PUT /api/dashboard/cars/c1",
      ]);
    });

    it("avisa quando o carro não existe mais", async () => {
      const usuario = userEvent.setup();
      simularFormulario({
        "GET /api/dashboard/cars/c1": respostaDeErro(
          404,
          "nao_encontrado",
          "Veículo não encontrado.",
        ),
      });
      const { router } = renderizarRota("/dashboard/cars/c1");

      expect(
        await screen.findByRole("heading", { name: "Veículo não encontrado" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Ele pode ter sido excluído.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();

      await usuario.click(screen.getByRole("link", { name: "Voltar ao catálogo" }));

      expect(
        await screen.findByRole("heading", { level: 1, name: "Veículos" }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/dashboard/cars");
    });

    it("avisa que o carro foi excluído em outra aba quando o formulário aberto é atualizado", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario();
      renderizarRota("/dashboard/cars/c1");
      await screen.findByLabelText("Marca *");
      await preencher(usuario, { "Preço de venda (R$)": "87.500" });
      api.rotas["GET /api/dashboard/cars/c1"] = respostaDeErro(
        404,
        "nao_encontrado",
        "Veículo não encontrado.",
      );

      fireEvent(window, new Event("visibilitychange"));

      expect(
        await screen.findByRole("heading", { name: "Veículo não encontrado" }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Marca *")).not.toBeInTheDocument();
    });

    it("mostra o carregamento, avisa a falha e tenta de novo", async () => {
      const usuario = userEvent.setup();
      let responder: (resposta: unknown) => void = () => undefined;
      const api = simularFormulario({
        "GET /api/dashboard/cars/c1": () =>
          new Promise((resolver) => {
            responder = resolver;
          }),
      });
      renderizarRota("/dashboard/cars/c1");

      expect(
        await screen.findByRole("heading", { level: 1, name: "Editar veículo" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Carregando…");

      responder(respostaDeErro(500, "erro_interno", "Erro interno."));

      expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno.");
      expect(screen.queryByLabelText("Marca *")).not.toBeInTheDocument();

      api.rotas["GET /api/dashboard/cars/c1"] = { carro: ONIX };
      await usuario.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await screen.findByLabelText("Marca *")).toHaveValue("Chevrolet");
    });
  });

  describe("adicionais", () => {
    it("adiciona um por vez, com Enter ou pelo botão, sem enviar o formulário", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario();
      renderizarRota("/dashboard/cars/new");
      await screen.findByLabelText("Marca *");
      const entrada = novoAdicional();

      expect(within(adicionais()).queryByRole("list")).not.toBeInTheDocument();
      expect(entrada).toHaveAttribute("enterkeyhint", "enter");
      expect(botaoAdicionar()).toBeDisabled();

      await usuario.type(entrada, "   {Enter}");

      expect(itensAdicionais()).toEqual([]);
      expect(botaoAdicionar()).toBeDisabled();

      await usuario.clear(entrada);
      await usuario.type(entrada, " Ar-condicionado {Enter}");

      expect(itensAdicionais()).toEqual(["Ar-condicionado"]);
      expect(entrada).toHaveValue("");
      expect(botaoAdicionar()).toBeDisabled();

      await usuario.type(entrada, "Câmera de ré");
      expect(botaoAdicionar()).toBeEnabled();
      await usuario.click(botaoAdicionar());

      expect(itensAdicionais()).toEqual(["Ar-condicionado", "Câmera de ré"]);
      expect(entrada).toHaveValue("");
      expect(entrada).toHaveFocus();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Marca *")).not.toHaveAttribute("aria-invalid");
      expect(alteracoes(api.chaves())).toEqual([]);
    });

    it("explica por que recusou o item e devolve o foco para corrigir", async () => {
      const usuario = userEvent.setup();
      simularFormulario();
      renderizarRota("/dashboard/cars/c1");
      await screen.findByLabelText("Marca *");
      const entrada = novoAdicional();

      await usuario.type(entrada, " multimídia {Enter}");

      expect(entrada).toHaveAttribute("aria-invalid", "true");
      expect(entrada).toHaveAccessibleDescription("“multimídia” já está na lista.");
      expect(entrada).toHaveValue(" multimídia ");
      expect(itensAdicionais()).toEqual(["Ar-condicionado", "Multimídia"]);

      await usuario.type(entrada, "s");

      expect(entrada).not.toHaveAttribute("aria-invalid");
      expect(entrada).not.toHaveAccessibleDescription();

      await usuario.clear(entrada);
      await usuario.paste("a".repeat(61));
      await usuario.click(botaoAdicionar());

      expect(entrada).toHaveAccessibleDescription(
        "Cada adicional pode ter no máximo 60 caracteres.",
      );
      expect(entrada).toHaveFocus();
      expect(itensAdicionais()).toEqual(["Ar-condicionado", "Multimídia"]);

      await usuario.keyboard("{Backspace}{Enter}");

      expect(itensAdicionais()).toEqual(["Ar-condicionado", "Multimídia", "a".repeat(60)]);
      expect(entrada).not.toHaveAccessibleDescription();
    });

    it("para em 40 itens e libera a vaga quando um sai", async () => {
      const usuario = userEvent.setup();
      const quarenta = Array.from({ length: 40 }, (_, indice) => `Item ${indice + 1}`);
      simularFormulario({
        "GET /api/dashboard/cars/c1": { carro: carroPainel({ opcionais: quarenta }) },
      });
      renderizarRota("/dashboard/cars/c1");
      await screen.findByLabelText("Marca *");

      await usuario.type(novoAdicional(), "Item 41{Enter}");

      expect(novoAdicional()).toHaveAccessibleDescription("Informe no máximo 40 adicionais.");
      expect(itensAdicionais()).toEqual(quarenta);

      await usuario.click(screen.getByRole("button", { name: "Remover Item 1" }));

      expect(novoAdicional()).not.toHaveAccessibleDescription();
      await usuario.click(botaoAdicionar());

      expect(itensAdicionais()).toEqual([...quarenta.slice(1), "Item 41"]);
    });

    it("tira e põe itens e salva a lista na ordem da tela", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario({ "PUT /api/dashboard/cars/c1": { carro: ONIX } });
      renderizarRota("/dashboard/cars/c1");
      await screen.findByLabelText("Marca *");

      await usuario.click(screen.getByRole("button", { name: "Remover Ar-condicionado" }));
      expect(itensAdicionais()).toEqual(["Multimídia"]);
      await usuario.type(novoAdicional(), "Teto solar{Enter}");
      await usuario.type(novoAdicional(), "ar-condicionado{Enter}");
      expect(itensAdicionais()).toEqual(["Multimídia", "Teto solar", "ar-condicionado"]);
      await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));

      expect(await screen.findByText("Alterações salvas.")).toBeInTheDocument();
      expect(api.corpos("PUT /api/dashboard/cars/c1")).toEqual([
        expect.objectContaining({ opcionais: ["Multimídia", "Teto solar", "ar-condicionado"] }),
      ]);
    });

    it("salva o carro sem adicionais depois de tirar todos", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario({ "PUT /api/dashboard/cars/c1": { carro: ONIX } });
      renderizarRota("/dashboard/cars/c1");
      await screen.findByLabelText("Marca *");

      await usuario.click(screen.getByRole("button", { name: "Remover Ar-condicionado" }));
      await usuario.click(screen.getByRole("button", { name: "Remover Multimídia" }));

      expect(within(adicionais()).queryByRole("list")).not.toBeInTheDocument();
      await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));

      expect(await screen.findByText("Alterações salvas.")).toBeInTheDocument();
      expect(api.corpos("PUT /api/dashboard/cars/c1")).toEqual([
        expect.objectContaining({ opcionais: [] }),
      ]);
    });
  });

  describe("preencher com IA", () => {
    function pedirLeitura(usuario: UserEvent) {
      return usuario.click(screen.getByRole("button", { name: "Preencher com IA" }));
    }

    function entradaDaIa() {
      return screen.getByLabelText("Escolher imagens");
    }

    function imagensDaIa() {
      return within(screen.getByRole("list", { name: "Imagens para a IA" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent);
    }

    it("escreve nos campos o que a IA leu do texto e das imagens", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario({
        "POST /api/dashboard/ai/extract-car": {
          carro: {
            marca: "Chevrolet",
            modelo: "Onix",
            anoFabricacao: 2020,
            anoModelo: 2021,
            km: 42_000,
            cambio: "Automático",
            precoVenda: 8_990_000,
            precoCompra: 7_500_000,
            vendedorTelefone: "62988887777",
            opcionais: ["Ar-condicionado", "Câmera de ré"],
          },
        },
      });
      renderizarRota("/dashboard/cars/new");
      await screen.findByLabelText("Marca *");
      expect(screen.queryByRole("list", { name: "Imagens para a IA" })).not.toBeInTheDocument();
      await usuario.click(screen.getByRole("button", { name: "Adicionar ao catálogo" }));
      expect(screen.getByLabelText("Marca *")).toHaveAttribute("aria-invalid", "true");
      const documento = foto("documento.png", "image/png");

      await preencher(usuario, {
        "Texto sobre o veículo": "  Onix LTZ 2020/2021, 42 mil km, R$ 89.900  ",
      });
      await usuario.upload(entradaDaIa(), [documento, foto("painel.jpg")]);
      expect(imagensDaIa()).toEqual(["documento.png", "painel.jpg"]);
      await pedirLeitura(usuario);

      expect(
        await screen.findByText("A IA preencheu 10 campos. Confira antes de salvar."),
      ).toHaveAttribute("role", "status");
      expect(formulario()).toHaveFormValues({
        marca: "Chevrolet",
        modelo: "Onix",
        versao: "",
        anoFabricacao: "2020",
        anoModelo: "2021",
        km: "42.000",
        cambio: "Automático",
        precoVenda: "89.900",
        precoCompra: "75.000",
        vendedorTelefone: "(62) 98888-7777",
        status: "rascunho",
        destaque: false,
        dataEntrada: "2026-10-30",
      });
      expect(itensAdicionais()).toEqual(["Ar-condicionado", "Câmera de ré"]);
      expect(screen.getByLabelText("Marca *")).not.toHaveAttribute("aria-invalid");
      expect(valorDe("Margem estimada:")).toHaveTextContent("R$ 14.900");
      expect(fotosNaTela()).toEqual([]);
      const [pedido] = api.corpos("POST /api/dashboard/ai/extract-car") as FormData[];
      expect(pedido?.get("texto")).toBe("Onix LTZ 2020/2021, 42 mil km, R$ 89.900");
      expect((pedido?.getAll("imagens") as File[]).map(({ name, type }) => [name, type])).toEqual([
        ["documento.png", "image/jpeg"],
        ["painel.jpg", "image/jpeg"],
      ]);
      expect(vi.mocked(comprimirFoto)).toHaveBeenCalledWith(documento);
    });

    it("confere o pedido antes de chamar a IA e deixa tirar imagens", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario();
      renderizarRota("/dashboard/cars/new");
      await screen.findByLabelText("Marca *");

      await pedirLeitura(usuario);
      expect(screen.getByRole("alert")).toHaveTextContent("Cole um texto ou escolha uma imagem.");

      await preencher(usuario, { "Texto sobre o veículo": "a".repeat(6001) });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      await pedirLeitura(usuario);
      expect(screen.getByRole("alert")).toHaveTextContent("Use no máximo 6000 caracteres.");

      await preencher(usuario, { "Texto sobre o veículo": "" });
      await usuario.upload(entradaDaIa(), variasFotos("doc", 3));
      await usuario.upload(entradaDaIa(), variasFotos("placa", 2));
      expect(imagensDaIa()).toEqual([
        "doc1.jpg",
        "doc2.jpg",
        "doc3.jpg",
        "placa1.jpg",
        "placa2.jpg",
      ]);
      await pedirLeitura(usuario);
      expect(screen.getByRole("alert")).toHaveTextContent("Escolha no máximo 4 imagens.");

      await usuario.click(screen.getByRole("button", { name: "Remover doc2.jpg" }));

      expect(imagensDaIa()).toEqual(["doc1.jpg", "doc3.jpg", "placa1.jpg", "placa2.jpg"]);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(alteracoes(api.chaves())).toEqual([]);
      expect(vi.mocked(comprimirFoto)).not.toHaveBeenCalled();
    });

    it.each<[number, CodigoErro, string, string]>([
      [
        429,
        "ia_indisponivel",
        "O limite gratuito da IA acabou por agora. Tente de novo mais tarde.",
        "O limite gratuito da IA acabou por agora. Tente de novo mais tarde.",
      ],
      [
        503,
        "ia_indisponivel",
        "A leitura com IA ainda não foi configurada no servidor.",
        "A leitura com IA ainda não foi configurada no servidor.",
      ],
      [
        413,
        "requisicao_invalida",
        "Requisição inválida.",
        "As imagens ficaram grandes demais. Escolha menos imagens.",
      ],
    ])(
      "mostra o erro %i da leitura sem mexer no formulário",
      async (status, codigo, mensagem, esperada) => {
        const usuario = userEvent.setup();
        simularFormulario({
          "POST /api/dashboard/ai/extract-car": respostaDeErro(status, codigo, mensagem),
        });
        renderizarRota("/dashboard/cars/new");
        await screen.findByLabelText("Marca *");

        await preencher(usuario, { "Texto sobre o veículo": "Onix 2021" });
        await pedirLeitura(usuario);

        expect(await screen.findByRole("alert")).toHaveTextContent(esperada);
        expect(screen.getByLabelText("Marca *")).toHaveValue("");
        expect(screen.getByLabelText("Texto sobre o veículo")).toHaveValue("Onix 2021");
        expect(screen.getByRole("button", { name: "Preencher com IA" })).toBeEnabled();
      },
    );

    it("avisa quando a IA não acha nada e quando uma imagem não pode ser lida", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario({ "POST /api/dashboard/ai/extract-car": { carro: {} } });
      renderizarRota("/dashboard/cars/new");
      await screen.findByLabelText("Marca *");

      await preencher(usuario, { "Texto sobre o veículo": "Bom dia" });
      await pedirLeitura(usuario);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "A IA não achou dados do veículo. Escreva mais detalhes ou escolha outra imagem.",
      );
      expect(screen.queryByText(/^A IA preencheu/)).not.toBeInTheDocument();

      vi.mocked(comprimirFoto).mockRejectedValue(
        new Error("Não foi possível ler esta imagem. Use JPG, PNG ou WebP."),
      );
      await usuario.upload(entradaDaIa(), foto("documento.jpg"));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      await pedirLeitura(usuario);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "documento.jpg: Não foi possível ler esta imagem. Use JPG, PNG ou WebP.",
      );
      expect(api.corpos("POST /api/dashboard/ai/extract-car")).toHaveLength(1);
    });

    it("bloqueia o envio do carro enquanto a IA lê", async () => {
      const usuario = userEvent.setup();
      let responder: (valor: unknown) => void = () => undefined;
      simularFormulario({
        "POST /api/dashboard/ai/extract-car": () =>
          new Promise((resolver) => {
            responder = resolver;
          }),
      });
      renderizarRota("/dashboard/cars/new");
      await screen.findByLabelText("Marca *");

      await preencher(usuario, { "Texto sobre o veículo": "Fiat Pulse 2023" });
      await pedirLeitura(usuario);

      expect(await screen.findByRole("button", { name: "Lendo…" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Adicionar ao catálogo" })).toBeDisabled();

      responder({ carro: { marca: "Fiat", modelo: "Pulse" } });

      expect(
        await screen.findByText("A IA preencheu 2 campos. Confira antes de salvar."),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Modelo *")).toHaveValue("Pulse");
      expect(screen.getByRole("button", { name: "Preencher com IA" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Adicionar ao catálogo" })).toBeEnabled();
    });

    it("ao editar, troca só os campos lidos, junta os adicionais e salva", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario({
        "POST /api/dashboard/ai/extract-car": {
          carro: { km: 51_000, precoVenda: 9_250_050, opcionais: ["multimídia", "Teto solar"] },
        },
        "PUT /api/dashboard/cars/c1": { carro: ONIX },
      });
      renderizarRota("/dashboard/cars/c1");
      await screen.findByLabelText("Marca *");

      await preencher(usuario, { "Texto sobre o veículo": "Agora com 51 mil km e teto solar" });
      await pedirLeitura(usuario);

      expect(
        await screen.findByText("A IA preencheu 3 campos. Confira antes de salvar."),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Quilometragem")).toHaveValue("51.000");
      expect(screen.getByLabelText("Preço de venda (R$)")).toHaveValue("92.500,50");
      expect(itensAdicionais()).toEqual(["Ar-condicionado", "Multimídia", "Teto solar"]);

      await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));

      expect(await screen.findByText("Alterações salvas.")).toBeInTheDocument();
      expect(api.corpos("PUT /api/dashboard/cars/c1")).toEqual([
        expect.objectContaining({
          marca: "Chevrolet",
          modelo: "Onix",
          km: 51_000,
          precoVenda: 9_250_050,
          opcionais: ["Ar-condicionado", "Multimídia", "Teto solar"],
          status: "disponivel",
          precoCompra: 7_500_000,
          placa: "ABC1D23",
          vendedorTelefone: "62988887777",
        }),
      ]);
    });
  });

  describe("clientes interessados", () => {
    it("registra um cliente interessado e o tira da lista de escolha", async () => {
      const usuario = userEvent.setup();
      const bruno = { id: "k2", nome: "Bruno Lima", telefone: "11955554444" };
      const api = simularFormulario({
        "GET /api/dashboard/interests?carId=c1": { interesses: [interesse()] },
        "GET /api/dashboard/customers": { clientes: [cliente(), cliente(bruno)] },
        "POST /api/dashboard/interests": () => {
          const novo = interesse({ id: "i2", cliente: bruno });
          api.rotas["GET /api/dashboard/interests?carId=c1"] = {
            interesses: [interesse(), novo],
          };
          return { interesse: novo };
        },
      });
      renderizarRota("/dashboard/cars/c1");
      const interessados = await screen.findByRole("region", { name: "Clientes interessados" });

      expect(
        await within(interessados).findByRole("option", { name: "Bruno Lima · (11) 95555-4444" }),
      ).toBeInTheDocument();
      const escolha = within(interessados).getByLabelText("Cliente");
      expect(
        within(escolha)
          .getAllByRole("option")
          .map((opcao) => opcao.textContent),
      ).toEqual(["Escolha um cliente", "Bruno Lima · (11) 95555-4444"]);
      const registrar = within(interessados).getByRole("button", { name: "Registrar interesse" });
      expect(registrar).toBeDisabled();

      await usuario.selectOptions(escolha, "Bruno Lima · (11) 95555-4444");
      expect(registrar).toBeEnabled();
      await usuario.click(registrar);

      expect(await screen.findByText("Interesse registrado.")).toHaveAttribute("role", "status");
      expect(api.corpos("POST /api/dashboard/interests")).toEqual([
        { clienteId: "k2", carroId: "c1" },
      ]);
      expect(await within(interessados).findByRole("link", { name: "Bruno Lima" })).toHaveAttribute(
        "href",
        "/dashboard/customers/k2",
      );
      await waitFor(() =>
        expect(
          within(escolha)
            .getAllByRole("option")
            .map((opcao) => opcao.textContent),
        ).toEqual(["Escolha um cliente"]),
      );
      expect(escolha).toHaveValue("");
      expect(registrar).toBeDisabled();
    });

    it("convida a cadastrar o primeiro cliente", async () => {
      const usuario = userEvent.setup();
      simularFormulario();
      const { router } = renderizarRota("/dashboard/cars/c1");
      const interessados = await screen.findByRole("region", { name: "Clientes interessados" });

      expect(
        await within(interessados).findByText("Nenhum cliente cadastrado."),
      ).toBeInTheDocument();
      expect(
        within(interessados).getByText("Nenhum cliente interessado ainda."),
      ).toBeInTheDocument();
      expect(within(interessados).queryByRole("combobox")).not.toBeInTheDocument();

      await usuario.click(within(interessados).getByRole("link", { name: "Cadastrar cliente" }));

      expect(
        await screen.findByRole("heading", { level: 1, name: "Novo cliente" }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/dashboard/customers/new");
    });

    it("avisa quando não consegue carregar os interessados", async () => {
      simularFormulario({
        "GET /api/dashboard/interests?carId=c1": respostaDeErro(
          500,
          "erro_interno",
          "Erro interno.",
        ),
      });

      renderizarRota("/dashboard/cars/c1");

      const interessados = await screen.findByRole("region", { name: "Clientes interessados" });
      expect(await within(interessados).findByRole("alert")).toHaveTextContent("Erro interno.");
      expect(within(interessados).queryByRole("combobox")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Marca *")).toHaveValue("Chevrolet");
    });

    it("mantém o que foi digitado quando a atualização do carro em segundo plano falha", async () => {
      const usuario = userEvent.setup();
      const api = simularFormulario({
        "GET /api/dashboard/customers": { clientes: [cliente()] },
        "POST /api/dashboard/interests": () => {
          api.rotas["GET /api/dashboard/cars/c1"] = respostaDeErro(
            500,
            "erro_interno",
            "Erro interno.",
          );
          api.rotas["GET /api/dashboard/interests?carId=c1"] = { interesses: [interesse()] };
          return { interesse: interesse() };
        },
      });
      const { queryClient } = renderizarRota("/dashboard/cars/c1");
      const interessados = await screen.findByRole("region", { name: "Clientes interessados" });
      await preencher(usuario, { "Preço de venda (R$)": "87.500" });

      await usuario.selectOptions(
        await within(interessados).findByLabelText("Cliente"),
        "Ana Souza · (11) 91234-5678",
      );
      await usuario.click(
        within(interessados).getByRole("button", { name: "Registrar interesse" }),
      );

      expect(await screen.findByText("Interesse registrado.")).toBeInTheDocument();
      await waitFor(() =>
        expect(queryClient.getQueryState(["painel", "carro", "c1"])?.status).toBe("error"),
      );
      expect(screen.getByLabelText("Preço de venda (R$)")).toHaveValue("87.500");
      expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
      expect(await within(interessados).findByRole("link", { name: "Ana Souza" })).toBeVisible();
    });
  });
});
