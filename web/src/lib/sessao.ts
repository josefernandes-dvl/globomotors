import type { RespostaSessao, Usuario } from "@globomotors/shared";
import { useQuery } from "@tanstack/react-query";
import { api, ErroApi } from "./api.ts";

export const CHAVE_SESSAO = ["sessao"] as const;

export async function buscarSessao(): Promise<Usuario | null> {
  try {
    const { usuario } = await api.get<RespostaSessao>("/auth/me");
    return usuario;
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 401) return null;
    throw erro;
  }
}

export function useSessao() {
  return useQuery({ queryKey: CHAVE_SESSAO, queryFn: buscarSessao, staleTime: Infinity });
}
