import { CODIGOS_ERRO } from "@globomotors/shared";
import { ErroHttp } from "../erros.ts";

interface Traducao {
  mensagem: string;
  campo?: string;
}

function detalhesDoPostgres(erro: unknown) {
  const causa: unknown = erro instanceof Error && erro.cause !== undefined ? erro.cause : erro;
  if (typeof causa !== "object" || causa === null) return {};
  const { code, constraint } = causa as { code?: unknown; constraint?: unknown };
  return { codigo: code, restricao: typeof constraint === "string" ? constraint : undefined };
}

export function traduzirRestricoes(traducoes: Record<string, Traducao>) {
  return (erro: unknown): never => {
    const { codigo, restricao } = detalhesDoPostgres(erro);
    const traducao = restricao === undefined ? undefined : traducoes[restricao];
    if (traducao && codigo === "23505") {
      const campos = traducao.campo && [{ campo: traducao.campo, mensagem: traducao.mensagem }];
      throw new ErroHttp(409, CODIGOS_ERRO.CONFLITO, traducao.mensagem, campos || undefined);
    }
    if (traducao && codigo === "23503") {
      throw new ErroHttp(404, CODIGOS_ERRO.NAO_ENCONTRADO, traducao.mensagem);
    }
    throw erro;
  };
}

export function primeiro<T>(linhas: T[]): T {
  const [linha] = linhas;
  if (linha === undefined) throw new Error("A consulta não devolveu nenhuma linha.");
  return linha;
}

export function escaparLike(texto: string) {
  return texto.replace(/[\\%_]/g, "\\$&");
}
