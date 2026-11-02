import type { CodigoErro, ErroDeCampo } from "@globomotors/shared";
import { vi } from "vitest";

export interface RequisicaoSimulada {
  chave: string;
  corpo: unknown;
}

type Responder = (requisicao: RequisicaoSimulada) => unknown;

export type RotasSimuladas = Record<string, unknown>;

export function respostaDeErro(
  status: number,
  codigo: CodigoErro,
  mensagem: string,
  campos?: ErroDeCampo[],
) {
  return Response.json({ erro: { codigo, mensagem, ...(campos && { campos }) } }, { status });
}

function lerCorpo(corpo: BodyInit | null | undefined): unknown {
  return typeof corpo === "string" ? JSON.parse(corpo) : corpo;
}

export function simularApi(rotas: RotasSimuladas) {
  const requisicoes: RequisicaoSimulada[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (entrada, init) => {
      const url = new URL(entrada instanceof Request ? entrada.url : entrada, "http://localhost");
      const metodo = init?.method ?? "GET";
      const chave = `${metodo} ${url.pathname}${url.search}`;
      const requisicao = { chave, corpo: lerCorpo(init?.body) };
      requisicoes.push(requisicao);
      const encontrada = [chave, `${metodo} ${url.pathname}`].find((opcao) =>
        Object.hasOwn(rotas, opcao),
      );
      if (encontrada === undefined) {
        return respostaDeErro(500, "erro_interno", `Rota não simulada: ${chave}`);
      }
      const definida = rotas[encontrada];
      const valor: unknown =
        typeof definida === "function" ? await (definida as Responder)(requisicao) : definida;
      return valor instanceof Response ? valor.clone() : Response.json(valor);
    }),
  );

  return {
    requisicoes,
    chaves: () => requisicoes.map((requisicao) => requisicao.chave),
    corpos: (chave: string) =>
      requisicoes.filter((requisicao) => requisicao.chave === chave).map(({ corpo }) => corpo),
  };
}
