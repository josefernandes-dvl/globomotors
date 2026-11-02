import { CODIGOS_ERRO } from "@globomotors/shared";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ErroApi } from "./api.ts";
import { CHAVE_SESSAO } from "./sessao.ts";

export function deveTentarDeNovo(tentativasFeitas: number, erro: unknown) {
  const recusadaPelaApi = erro instanceof ErroApi && erro.status >= 400 && erro.status < 500;
  return !recusadaPelaApi && tentativasFeitas < 2;
}

export function criarClienteDeConsultas() {
  const encerrarSessaoExpirada = (erro: Error) => {
    if (erro instanceof ErroApi && erro.codigo === CODIGOS_ERRO.NAO_AUTENTICADO) {
      queryClient.setQueryData(CHAVE_SESSAO, null);
    }
  };
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: encerrarSessaoExpirada }),
    mutationCache: new MutationCache({ onError: encerrarSessaoExpirada }),
    defaultOptions: { queries: { retry: deveTentarDeNovo } },
  });
  return queryClient;
}
