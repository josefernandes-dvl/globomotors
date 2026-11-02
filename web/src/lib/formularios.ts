import type { ErroDeCampo } from "@globomotors/shared";
import { ErroApi } from "./api.ts";

export type ErrosDoFormulario = Partial<Record<string, string>>;

export function errosPorCampo(erros: ErroDeCampo[]): ErrosDoFormulario {
  const mapa: ErrosDoFormulario = {};
  for (const { campo, mensagem } of erros) mapa[campo.split(".")[0] ?? campo] ??= mensagem;
  return mapa;
}

export function errosDaApi(erro: unknown) {
  return erro instanceof ErroApi ? errosPorCampo(erro.campos) : {};
}

export function mensagemDeErro(erro: unknown) {
  return erro instanceof Error ? erro.message : "Algo deu errado. Tente novamente.";
}
