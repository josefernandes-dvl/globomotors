import {
  CAMBIOS,
  CAMPOS_DA_IA,
  CARROCERIAS,
  CODIGOS_ERRO,
  COMBUSTIVEIS,
  esquemaCarro,
  type CampoDaIa,
  type CarroExtraido,
  type TipoDeFoto,
} from "@globomotors/shared";
import type { Config } from "./config.ts";
import { ErroHttp } from "./erros.ts";

export interface PedidoIa {
  texto: string;
  imagens: { tipo: TipoDeFoto; dados: Buffer }[];
}

export interface Ia {
  lerCarro: (pedido: PedidoIa) => Promise<CarroExtraido>;
}

interface RespostaDaIa {
  choices?: { message?: { content?: unknown } }[];
}

const TEMPO_LIMITE = 50_000;
const TEXTO = { type: "string" };
const INTEIRO = { type: "integer" };
const REAIS = { type: "number" };

const PROPRIEDADES: Record<CampoDaIa, object> = {
  marca: TEXTO,
  modelo: TEXTO,
  versao: TEXTO,
  anoFabricacao: INTEIRO,
  anoModelo: INTEIRO,
  km: INTEIRO,
  cambio: { type: "string", enum: CAMBIOS },
  combustivel: { type: "string", enum: COMBUSTIVEIS },
  carroceria: { type: "string", enum: CARROCERIAS },
  cores: { type: "array", items: TEXTO },
  motor: TEXTO,
  portas: INTEIRO,
  opcionais: { type: "array", items: TEXTO },
  descricao: TEXTO,
  precoVenda: REAIS,
  precoCompra: REAIS,
  custoPreparacao: REAIS,
  custoDocumentacao: REAIS,
  custoComissao: REAIS,
  precoMinimo: REAIS,
  dataEntrada: TEXTO,
  placa: TEXTO,
  chassi: TEXTO,
  renavam: TEXTO,
  origem: TEXTO,
  vendedorNome: TEXTO,
  vendedorTelefone: TEXTO,
  observacoesInternas: TEXTO,
};

const INSTRUCOES = [
  "Você ajuda uma loja de carros seminovos a cadastrar um carro.",
  "Leia o texto e as imagens (anúncio, conversa, foto do carro, do painel ou do documento) e responda só com um objeto JSON com os campos que encontrar.",
  "Omita o campo que não aparecer: nunca invente nem estime valores.",
  "marca, modelo e versao: como no mercado brasileiro (ex.: Chevrolet, Onix, 1.0 Turbo LTZ).",
  "anoFabricacao e anoModelo: em 2020/2021, a fabricação é 2020 e o modelo é 2021.",
  "km: quilometragem, em número inteiro.",
  "cambio, combustivel e carroceria: só um dos valores aceitos no esquema.",
  "motor: cilindrada e tipo (ex.: 1.0 Turbo). portas: número de portas.",
  "cores: uma por item (ex.: Prata). Quando o anúncio oferece o mesmo veículo em várias cores, liste todas.",
  "opcionais: itens curtos, um por item (ex.: Ar-condicionado, Câmera de ré).",
  "descricao: texto do anúncio para o cliente, em português, com até 2000 caracteres. Ela é pública: nunca ponha nela preço de compra, custos, preço mínimo, placa, chassi, Renavam, dados de quem vendeu o carro para a loja nem observações internas.",
  "precoVenda: preço pelo qual a loja anuncia o carro, em reais (89900 para R$ 89.900). Se o texto for a oferta de quem está vendendo o carro para a loja, o preço pedido vai em precoCompra.",
  "precoCompra, custoPreparacao, custoDocumentacao, custoComissao e precoMinimo: valores internos da loja, em reais.",
  "dataEntrada: dia em que o carro entrou na loja, no formato AAAA-MM-DD.",
  "placa, chassi e renavam: como aparecem no documento.",
  "origem: como o carro chegou à loja (troca, leilão, compra direta).",
  "vendedorNome e vendedorTelefone: loja ou pessoa que está vendendo o carro para a loja, nunca um cliente interessado em comprar.",
  "observacoesInternas: o que o cliente não deve ver, como defeitos, pendências e multas.",
].join("\n");

function vazio(valor: unknown) {
  return valor === null || valor === undefined || (Array.isArray(valor) && valor.length === 0);
}

export function lerCarroExtraido(bruto: unknown): CarroExtraido {
  if (typeof bruto !== "object" || bruto === null) return {};
  const lido: Record<string, unknown> = {};
  for (const campo of CAMPOS_DA_IA) {
    const valor: unknown = (bruto as Record<string, unknown>)[campo];
    if (vazio(valor)) continue;
    const resultado = esquemaCarro.shape[campo].safeParse(
      PROPRIEDADES[campo] === REAIS && typeof valor === "number" ? Math.round(valor * 100) : valor,
    );
    if (resultado.success && !vazio(resultado.data)) lido[campo] = resultado.data;
  }
  return lido;
}

export function criarIa({
  AI_API_KEY,
  AI_MODEL,
  AI_BASE_URL,
}: Pick<Config, "AI_API_KEY" | "AI_MODEL" | "AI_BASE_URL">): Ia | null {
  if (!AI_API_KEY) return null;
  const endereco = `${AI_BASE_URL.replace(/\/+$/, "")}/chat/completions`;

  async function perguntar({ texto, imagens }: PedidoIa): Promise<unknown> {
    const resposta = await fetch(endereco, {
      method: "POST",
      headers: { authorization: `Bearer ${AI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: INSTRUCOES },
          {
            role: "user",
            content: [
              { type: "text", text: texto || "Não há texto: leia só as imagens." },
              ...imagens.map(({ tipo, dados }) => ({
                type: "image_url",
                image_url: { url: `data:${tipo};base64,${dados.toString("base64")}` },
              })),
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "carro", schema: { type: "object", properties: PROPRIEDADES } },
        },
      }),
      signal: AbortSignal.timeout(TEMPO_LIMITE),
    });
    if (resposta.status === 429) {
      throw new ErroHttp(
        429,
        CODIGOS_ERRO.IA_INDISPONIVEL,
        "O limite gratuito da IA acabou por agora. Tente de novo mais tarde.",
      );
    }
    if (!resposta.ok) throw new Error(`A IA respondeu ${resposta.status}.`);
    const { choices } = (await resposta.json()) as RespostaDaIa;
    const conteudo = choices?.[0]?.message?.content;
    if (typeof conteudo !== "string") throw new Error("A IA respondeu sem conteúdo.");
    return JSON.parse(conteudo.trim().replace(/^```(?:json)?|```$/g, ""));
  }

  return {
    async lerCarro(pedido) {
      try {
        return lerCarroExtraido(await perguntar(pedido));
      } catch (erro) {
        if (erro instanceof ErroHttp) throw erro;
        throw new ErroHttp(
          502,
          CODIGOS_ERRO.IA_INDISPONIVEL,
          "A IA não respondeu agora. Tente de novo em instantes.",
          undefined,
          { cause: erro },
        );
      }
    },
  };
}
