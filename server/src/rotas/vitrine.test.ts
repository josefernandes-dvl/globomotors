import type {
  CarroPainel,
  CarroPublico,
  Cliente,
  FotoCarro,
  Loja,
  LojaPublica,
  StatusCarro,
} from "@globomotors/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  carroDeTeste,
  clienteDeTeste,
  fotoDeTeste,
  prepararApiDeTeste,
  type ApiDeTeste,
} from "../testes/apiDeTeste.ts";

const CAMPOS_PUBLICOS_CARRO = [
  "anoFabricacao",
  "anoModelo",
  "cambio",
  "carroceria",
  "combustivel",
  "cor",
  "descricao",
  "destaque",
  "fotos",
  "km",
  "marca",
  "modelo",
  "motor",
  "opcionais",
  "portas",
  "preco",
  "slug",
  "status",
  "versao",
];

const CAMPOS_PRIVADOS = [
  "precoVenda",
  "precoCompra",
  "custoPreparacao",
  "custoDocumentacao",
  "custoComissao",
  "precoMinimo",
  "margem",
  "dataEntrada",
  "diasEmEstoque",
  "placa",
  "chassi",
  "renavam",
  "origem",
  "vendedorNome",
  "vendedorTelefone",
  "observacoesInternas",
  "interessados",
  "vendidoEm",
  "criadoEm",
  "atualizadoEm",
  "mostrarVendidos",
  "cliente",
  "clientes",
  "interesses",
  "telefone",
  "email",
  "observacoes",
];

const LOJA_PUBLICA: LojaPublica = {
  nome: "Globo Motors",
  cidade: "Goiânia - GO",
  slogan: "Seminovos com procedência.",
  whatsapp: "62999990000",
  instagram: "globomotors",
  mostrarPreco: true,
};

const LOJA: Loja = { ...LOJA_PUBLICA, mostrarVendidos: false };

let api: ApiDeTeste;
let cookie: string;

beforeAll(async () => {
  api = await prepararApiDeTeste();
  cookie = await api.entrar();
});

afterAll(async () => {
  await api.encerrar();
});

async function configurarLoja(extra: Partial<Loja> = {}) {
  const resposta = await api.requisitar("PUT", "/dashboard/store", {
    corpo: { ...LOJA, ...extra },
    cookie,
  });
  expect(resposta.status).toBe(200);
}

async function buscarNoPainel(id: string) {
  const resposta = await api.requisitar<{ carro: CarroPainel }>("GET", `/dashboard/cars/${id}`, {
    cookie,
  });
  return resposta.corpo.carro;
}

async function criarCarro(status: StatusCarro = "disponivel", extra: Record<string, unknown> = {}) {
  const resposta = await api.requisitar<{ carro: CarroPainel }>("POST", "/dashboard/cars", {
    corpo: carroDeTeste({ status, ...extra }),
    cookie,
  });
  expect(resposta.status).toBe(201);
  return resposta.corpo.carro;
}

async function enviarFoto(carroId: string, dados = fotoDeTeste("jpeg")) {
  const resposta = await api.requisitar<{ foto: FotoCarro }>(
    "POST",
    `/dashboard/cars/${carroId}/photos`,
    { corpo: dados, tipo: "image/jpeg", cookie },
  );
  expect(resposta.status).toBe(201);
  return resposta.corpo.foto;
}

async function criarCarroComInteressado(status: StatusCarro = "disponivel") {
  const { id } = await criarCarro(status);
  const foto = await enviarFoto(id);
  const cliente = await api.requisitar<{ cliente: Cliente }>("POST", "/dashboard/customers", {
    corpo: clienteDeTeste(),
    cookie,
  });
  await api.requisitar("POST", "/dashboard/interests", {
    corpo: { clienteId: cliente.corpo.cliente.id, carroId: id },
    cookie,
  });
  return { carro: await buscarNoPainel(id), foto, cliente: cliente.corpo.cliente };
}

function vitrine<T>(caminho: string, cookieDaSessao?: string) {
  return api.requisitar<T>("GET", `/showroom${caminho}`, { cookie: cookieDaSessao });
}

async function slugsPublicos() {
  const resposta = await vitrine<{ carros: CarroPublico[] }>("/cars");
  expect(resposta.status).toBe(200);
  return resposta.corpo.carros.map((carro) => carro.slug);
}

function chaves(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.flatMap(chaves);
  if (typeof valor === "object" && valor !== null) {
    return Object.entries(valor).flatMap(([chave, filho]) => [chave, ...chaves(filho)]);
  }
  return [];
}

function folhas(valor: unknown): unknown[] {
  if (Array.isArray(valor)) return valor.flatMap(folhas);
  if (typeof valor === "object" && valor !== null) return Object.values(valor).flatMap(folhas);
  return [valor];
}

function esperarSemDadosPrivados(
  resposta: { texto: string; corpo: unknown },
  { carro, cliente }: { carro: CarroPainel; cliente: Cliente },
) {
  expect(chaves(resposta.corpo).filter((chave) => CAMPOS_PRIVADOS.includes(chave))).toEqual([]);
  const textos = [
    carro.id,
    carro.placa,
    carro.chassi,
    carro.renavam,
    carro.origem,
    carro.vendedorNome,
    carro.vendedorTelefone,
    carro.observacoesInternas,
    carro.dataEntrada,
    cliente.id,
    cliente.nome,
    cliente.telefone,
    cliente.email,
    cliente.observacoes,
  ];
  for (const texto of textos) {
    expect(texto).not.toBeNull();
    expect(resposta.texto).not.toContain(texto);
  }
  const valores = [
    carro.precoCompra,
    carro.custoPreparacao,
    carro.custoDocumentacao,
    carro.custoComissao,
    carro.precoMinimo,
    carro.margem,
  ];
  expect(valores).not.toContain(null);
  expect(folhas(resposta.corpo).filter((folha) => valores.includes(folha as number))).toEqual([]);
  expect(resposta.texto).not.toMatch(/\d{4}-\d{2}-\d{2}/);
}

function publicoEsperado(carro: CarroPainel, foto: FotoCarro): CarroPublico {
  return {
    slug: carro.slug,
    marca: "Chevrolet",
    modelo: "Onix",
    versao: "1.0 Turbo LT",
    anoFabricacao: 2022,
    anoModelo: 2023,
    km: 32_000,
    cambio: "Automático",
    combustivel: "Flex",
    carroceria: "Hatch",
    cor: "Prata",
    motor: "1.0 Turbo",
    portas: 4,
    opcionais: ["Ar-condicionado", "Câmera de ré"],
    descricao: "Único dono, revisões em dia.",
    preco: 8_990_000,
    status: "disponivel",
    destaque: false,
    fotos: [{ id: foto.id, url: `/api/showroom/photos/${foto.id}` }],
  };
}

describe("GET /api/showroom/store", () => {
  it("devolve a loja padrão sem exigir login", async () => {
    const resposta = await vitrine<{ loja: LojaPublica }>("/store");

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual({
      loja: {
        nome: "Globo Motors",
        cidade: null,
        slogan: null,
        whatsapp: null,
        instagram: null,
        mostrarPreco: true,
      },
    });
  });

  it("devolve só os campos públicos da configuração", async () => {
    await configurarLoja({ mostrarVendidos: true });

    const resposta = await vitrine<{ loja: LojaPublica }>("/store");

    expect(resposta.corpo).toEqual({ loja: LOJA_PUBLICA });
  });
});

describe("GET /api/showroom/cars", () => {
  beforeEach(async () => {
    await configurarLoja();
  });

  it("devolve lista vazia quando não há carros", async () => {
    expect(await slugsPublicos()).toEqual([]);
  });

  it("não lista carro em rascunho", async () => {
    await criarCarro("rascunho");

    expect(await slugsPublicos()).toEqual([]);
  });

  it("mostra só os campos públicos de cada carro", async () => {
    const { carro, foto } = await criarCarroComInteressado();

    const resposta = await vitrine<{ carros: CarroPublico[] }>("/cars");

    const publico = resposta.corpo.carros.find((item) => item.slug === carro.slug);
    expect(Object.keys(publico ?? {}).sort()).toEqual(CAMPOS_PUBLICOS_CARRO);
    expect(publico).toEqual(publicoEsperado(carro, foto));
  });

  it("não deixa vazar dado privado do carro nem dos clientes interessados", async () => {
    const dados = await criarCarroComInteressado();

    esperarSemDadosPrivados(await vitrine("/cars"), dados);
  });

  it("mostra disponíveis e reservados e esconde rascunhos e vendidos", async () => {
    const [disponivel, reservado, rascunho, vendido] = await Promise.all([
      criarCarro("disponivel"),
      criarCarro("reservado"),
      criarCarro("rascunho"),
      criarCarro("vendido"),
    ]);

    const slugs = await slugsPublicos();

    expect(slugs).toEqual(expect.arrayContaining([disponivel.slug, reservado.slug]));
    expect(slugs).not.toContain(rascunho.slug);
    expect(slugs).not.toContain(vendido.slug);
  });

  it("mostra os vendidos quando a loja escolhe mostrar, mas nunca os rascunhos", async () => {
    await configurarLoja({ mostrarVendidos: true });
    const vendido = await criarCarro("vendido");
    const rascunho = await criarCarro("rascunho");

    const resposta = await vitrine<{ carros: CarroPublico[] }>("/cars");

    const slugs = resposta.corpo.carros.map((carro) => carro.slug);
    expect(slugs).not.toContain(rascunho.slug);
    expect(resposta.corpo.carros.find((carro) => carro.slug === vendido.slug)?.status).toBe(
      "vendido",
    );
  });

  it("não envia o preço quando a loja escolhe não mostrar", async () => {
    await configurarLoja({ mostrarPreco: false });
    const carro = await criarCarro("disponivel", { precoVenda: 9_123_400 });

    const resposta = await vitrine<{ carros: CarroPublico[] }>("/cars");

    expect(resposta.corpo.carros.find((item) => item.slug === carro.slug)?.preco).toBeNull();
    expect(folhas(resposta.corpo)).not.toContain(9_123_400);
    expect(resposta.texto).not.toContain("9123400");
  });

  it("lista do mais novo para o mais antigo", async () => {
    const antigo = await criarCarro();
    const novo = await criarCarro();

    const slugs = await slugsPublicos();

    expect(slugs.indexOf(novo.slug)).toBeLessThan(slugs.indexOf(antigo.slug));
  });

  it("tira da vitrine o carro que volta para rascunho", async () => {
    const carro = await criarCarro();
    await api.requisitar("PATCH", `/dashboard/cars/${carro.id}/status`, {
      corpo: { status: "rascunho" },
      cookie,
    });

    expect(await slugsPublicos()).not.toContain(carro.slug);
    expect((await vitrine(`/cars/${carro.slug}`)).status).toBe(404);
  });

  it("devolve o mesmo conteúdo para quem tem sessão de vendedor", async () => {
    await criarCarroComInteressado();

    const anonimo = await vitrine("/cars");
    const vendedor = await vitrine("/cars", cookie);

    expect(vendedor.status).toBe(200);
    expect(vendedor.corpo).toEqual(anonimo.corpo);
  });
});

describe("GET /api/showroom/cars/:slug", () => {
  beforeEach(async () => {
    await configurarLoja();
  });

  it("devolve o carro publicado só com os campos públicos", async () => {
    const dados = await criarCarroComInteressado();

    const resposta = await vitrine<{ carro: CarroPublico }>(`/cars/${dados.carro.slug}`);

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual({ carro: publicoEsperado(dados.carro, dados.foto) });
    esperarSemDadosPrivados(resposta, dados);
  });

  it("devolve o carro reservado com o status", async () => {
    const carro = await criarCarro("reservado");

    const resposta = await vitrine<{ carro: CarroPublico }>(`/cars/${carro.slug}`);

    expect(resposta.corpo.carro.status).toBe("reservado");
  });

  it.each(["rascunho", "vendido"] as const)("responde 404 para carro %s", async (status) => {
    const carro = await criarCarro(status);

    const resposta = await vitrine(`/cars/${carro.slug}`);

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "nao_encontrado", mensagem: "Carro não encontrado." },
    });
  });

  it("mostra o vendido quando a loja escolhe mostrar", async () => {
    await configurarLoja({ mostrarVendidos: true });
    const carro = await criarCarro("vendido");

    const resposta = await vitrine<{ carro: CarroPublico }>(`/cars/${carro.slug}`);

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.carro.status).toBe("vendido");
  });

  it("não envia o preço quando a loja escolhe não mostrar", async () => {
    await configurarLoja({ mostrarPreco: false });
    const carro = await criarCarro();

    const resposta = await vitrine<{ carro: CarroPublico }>(`/cars/${carro.slug}`);

    expect(resposta.corpo.carro.preco).toBeNull();
    expect(resposta.texto).not.toContain(String(carro.precoVenda));
  });

  it("mantém o link do carro depois de editar marca e modelo", async () => {
    const carro = await criarCarro();
    await api.requisitar("PUT", `/dashboard/cars/${carro.id}`, {
      corpo: carroDeTeste({
        modelo: "Onix Plus",
        placa: carro.placa,
        chassi: carro.chassi,
        renavam: carro.renavam,
      }),
      cookie,
    });

    const resposta = await vitrine<{ carro: CarroPublico }>(`/cars/${carro.slug}`);

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.carro.modelo).toBe("Onix Plus");
  });

  it("responde 404 para slug que não existe", async () => {
    const resposta = await vitrine("/cars/fusca-1970-abc123");

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toMatchObject({ erro: { mensagem: "Carro não encontrado." } });
  });
});

describe("GET /api/showroom/photos/:id", () => {
  beforeEach(async () => {
    await configurarLoja();
  });

  it("serve a foto de carro publicado com cache público, também no CDN", async () => {
    const carro = await criarCarro();
    const dados = fotoDeTeste("jpeg");
    const foto = await enviarFoto(carro.id, dados);

    const baixada = await api.baixar(`/showroom/photos/${foto.id}`);

    expect(baixada.status).toBe(200);
    expect(baixada.headers.get("content-type")).toBe("image/jpeg");
    expect(baixada.headers.get("cache-control")).toBe("public, max-age=86400, s-maxage=86400");
    expect(baixada.dados.equals(dados)).toBe(true);
  });

  it.each(["rascunho", "vendido"] as const)(
    "responde 404 para foto de carro %s",
    async (status) => {
      const carro = await criarCarro(status);
      const foto = await enviarFoto(carro.id);

      const resposta = await vitrine(`/photos/${foto.id}`);

      expect(resposta.status).toBe(404);
      expect(resposta.corpo).toEqual({
        erro: { codigo: "nao_encontrado", mensagem: "Foto não encontrada." },
      });
    },
  );

  it("serve a foto do vendido quando a loja mostra vendidos", async () => {
    await configurarLoja({ mostrarVendidos: true });
    const carro = await criarCarro("vendido");
    const foto = await enviarFoto(carro.id);

    expect((await api.baixar(`/showroom/photos/${foto.id}`)).status).toBe(200);
  });

  it.each([
    ["que não existe", "3f0c8a4e-7b1d-4c2e-9a6f-5d8b2e1c0a9f"],
    ["com id inválido", "abc"],
  ])("responde 404 para foto %s", async (_caso, id) => {
    const resposta = await vitrine(`/photos/${id}`);

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toMatchObject({ erro: { mensagem: "Foto não encontrada." } });
  });
});

describe("escrita pela vitrine", () => {
  it.each([
    ["POST", "/cars"],
    ["PUT", "/cars/:slug"],
    ["PATCH", "/cars/:slug"],
    ["DELETE", "/cars/:slug"],
    ["PUT", "/store"],
    ["POST", "/store"],
    ["DELETE", "/photos/:foto"],
  ])("recusa %s %s mesmo com sessão de vendedor", async (metodo, caminho) => {
    await configurarLoja();
    const carro = await criarCarro();
    const foto = await enviarFoto(carro.id);
    const destino = caminho.replace(":slug", carro.slug).replace(":foto", foto.id);

    const resposta = await api.requisitar(metodo, `/showroom${destino}`, {
      corpo: { ...carroDeTeste(), ...LOJA, status: "vendido", nome: "Invadida" },
      cookie,
    });

    expect(resposta.status).toBe(404);
    expect(resposta.corpo).toEqual({
      erro: { codigo: "nao_encontrado", mensagem: "Rota não encontrada." },
    });
    const depois = await vitrine<{ carro: CarroPublico }>(`/cars/${carro.slug}`);
    expect(depois.corpo.carro.status).toBe("disponivel");
    expect((await vitrine<{ loja: LojaPublica }>("/store")).corpo.loja.nome).toBe(LOJA.nome);
    expect((await api.baixar(`/showroom/photos/${foto.id}`)).status).toBe(200);
  });
});
