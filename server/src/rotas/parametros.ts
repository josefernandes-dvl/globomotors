import { CODIGOS_ERRO } from "@globomotors/shared";
import { z } from "zod";
import { ErroHttp } from "../erros.ts";

const esquemaId = z.uuid();

export function idDaRota(valor: string, mensagem: string) {
  const resultado = esquemaId.safeParse(valor);
  if (!resultado.success) throw new ErroHttp(404, CODIGOS_ERRO.NAO_ENCONTRADO, mensagem);
  return resultado.data;
}

export function naoEncontrado(mensagem: string) {
  return new ErroHttp(404, CODIGOS_ERRO.NAO_ENCONTRADO, mensagem);
}
