import { LOJA_PADRAO, type Usuario } from "@globomotors/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";
import { ProvedorDeAvisos } from "../../componentes/Avisos.tsx";
import { Carregando } from "../../componentes/Carregando.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { api } from "../../lib/api.ts";
import { useAvisos } from "../../lib/avisos.ts";
import { mensagemDeErro } from "../../lib/formularios.ts";
import { CHAVE_PAINEL, consultaLojaPainel } from "../../lib/painel.ts";
import { CHAVE_SESSAO, useSessao } from "../../lib/sessao.ts";

const SECOES = [
  { para: "/dashboard/cars", rotulo: "Carros" },
  { para: "/dashboard/customers", rotulo: "Clientes" },
  { para: "/dashboard/funnel", rotulo: "Funil" },
  { para: "/dashboard/store", rotulo: "Loja" },
];

export function LayoutPainel() {
  const sessao = useSessao();
  const { pathname, search } = useLocation();
  const queryClient = useQueryClient();
  const semSessao = sessao.data === null;

  useEffect(() => {
    if (semSessao) queryClient.removeQueries({ queryKey: CHAVE_PAINEL });
  }, [semSessao, queryClient]);

  if (sessao.isPending) return <Carregando />;
  if (sessao.isError) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-md place-content-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-extrabold font-stretch-[115%]">
          Não foi possível abrir o painel
        </h1>
        <p className="text-suave">{sessao.error.message}</p>
        <button
          type="button"
          onClick={() => void sessao.refetch()}
          className="botao botao-primario mx-auto"
        >
          Tentar de novo
        </button>
      </main>
    );
  }
  if (!sessao.data) return <Navigate to="/login" replace state={{ de: pathname + search }} />;

  return (
    <ProvedorDeAvisos>
      <Painel usuario={sessao.data} />
    </ProvedorDeAvisos>
  );
}

function Painel({ usuario }: { usuario: Usuario }) {
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const { data: loja } = useQuery(consultaLojaPainel);

  const sair = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => queryClient.setQueryData(CHAVE_SESSAO, null),
    onError: (erro) => avisar(mensagemDeErro(erro), "erro"),
  });

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[#1c2d4a] fundo-topo text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-[18px] gap-y-3 px-5 py-4">
          <Link to="/dashboard/cars" className="mr-auto flex min-w-0 items-center gap-3">
            <img
              src="/emblema.webp"
              alt=""
              className="size-12 flex-none drop-shadow-[0_0_10px_rgb(80_150_255/0.35)]"
            />
            <span className="min-w-0">
              <span className="block truncate texto-metal text-[22px] leading-none font-black uppercase font-stretch-[125%]">
                {loja?.nome ?? LOJA_PADRAO.nome}
              </span>
              <span className="mt-[5px] block text-[11px] font-semibold tracking-[0.32em] text-acento-claro uppercase">
                Gestão do catálogo
              </span>
            </span>
          </Link>
          <nav aria-label="Seções do painel" className="flex flex-wrap gap-1">
            {SECOES.map(({ para, rotulo }) => (
              <NavLink
                key={para}
                to={para}
                className={({ isActive }) =>
                  `botao botao-pequeno ${isActive ? "botao-primario" : "botao-escuro"}`
                }
              >
                {rotulo}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/catalogo" target="_blank" className="botao botao-pequeno botao-escuro">
              <Icone nome="externo" />
              Ver catálogo
            </Link>
            <span className="max-w-40 truncate text-sm text-noite-prata">{usuario.nome}</span>
            <button
              type="button"
              onClick={() => sair.mutate()}
              disabled={sair.isPending}
              className="botao botao-pequeno botao-escuro"
            >
              <Icone nome="sair" />
              Sair
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
