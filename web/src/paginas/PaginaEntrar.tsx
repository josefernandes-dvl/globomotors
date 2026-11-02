import { errosDeCampo, esquemaEntrar, type RespostaSessao } from "@globomotors/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { CampoTexto } from "../componentes/Campo.tsx";
import { Carregando } from "../componentes/Carregando.tsx";
import { api } from "../lib/api.ts";
import { errosPorCampo, mensagemDeErro, type ErrosDoFormulario } from "../lib/formularios.ts";
import { CHAVE_SESSAO, useSessao } from "../lib/sessao.ts";

function destinoDepoisDoLogin(estado: unknown) {
  const de = typeof estado === "object" && estado !== null && "de" in estado ? estado.de : null;
  return typeof de === "string" && de.startsWith("/dashboard") ? de : "/dashboard";
}

export function PaginaEntrar() {
  const sessao = useSessao();
  const estado: unknown = useLocation().state;
  const queryClient = useQueryClient();
  const [erros, setErros] = useState<ErrosDoFormulario>({});

  const entrar = useMutation({
    mutationFn: (dados: { email: string; senha: string }) =>
      api.post<RespostaSessao>("/auth/login", dados),
    onSuccess: ({ usuario }) => queryClient.setQueryData(CHAVE_SESSAO, usuario),
  });

  if (sessao.isPending) return <Carregando />;
  if (sessao.data) return <Navigate to={destinoDepoisDoLogin(estado)} replace />;

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const resultado = esquemaEntrar.safeParse(
      Object.fromEntries(new FormData(evento.currentTarget)),
    );
    if (!resultado.success) {
      setErros(errosPorCampo(errosDeCampo(resultado.error)));
      return;
    }
    setErros({});
    entrar.mutate(resultado.data);
  }

  return (
    <main className="grid min-h-dvh place-items-center p-5">
      <title>Entrar · Painel do vendedor</title>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/emblema.webp" alt="" className="size-16" />
          <h1 className="text-2xl font-extrabold font-stretch-[115%]">Painel do vendedor</h1>
          <p className="text-sm text-suave">Entre com o e-mail e a senha cadastrados pela loja.</p>
        </div>
        <form
          noValidate
          onSubmit={aoEnviar}
          className="flex flex-col gap-4 rounded-2xl border border-linha bg-papel p-6 shadow-cartao"
        >
          <CampoTexto
            rotulo="E-mail"
            name="email"
            type="email"
            autoComplete="username"
            erro={erros.email}
          />
          <CampoTexto
            rotulo="Senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            erro={erros.senha}
          />
          {entrar.isError && (
            <p
              role="alert"
              className="rounded-[10px] bg-[#fdecea] px-3 py-2 text-sm font-medium text-perigo"
            >
              {mensagemDeErro(entrar.error)}
            </p>
          )}
          <button
            type="submit"
            disabled={entrar.isPending}
            className="botao botao-primario w-full py-2.5"
          >
            {entrar.isPending ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <Link to="/" className="mt-5 block text-center text-sm font-semibold text-acento">
          Ver a vitrine
        </Link>
      </div>
    </main>
  );
}
