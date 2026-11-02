import { ROTULOS_STATUS_CARRO, type StatusCarro } from "@globomotors/shared";
import type { ReactNode } from "react";
import { mensagemDeErro } from "../../lib/formularios.ts";

const CORES_STATUS: Record<StatusCarro, string> = {
  rascunho: "bg-[#eef1f5] text-suave",
  disponivel: "bg-[#e4f4ea] text-ok",
  reservado: "bg-[#fdf1d6] text-[#8a5e00]",
  vendido: "bg-[#e3e8ef] text-[#4a4f57]",
};

export function EtiquetaStatus({
  status,
  className = "",
}: {
  status: StatusCarro;
  className?: string;
}) {
  return (
    <span
      className={`rounded-full px-[9px] py-[5px] text-[11px] leading-none font-bold tracking-[0.07em] uppercase ${CORES_STATUS[status]} ${className}`}
    >
      {ROTULOS_STATUS_CARRO[status]}
    </span>
  );
}

export function PaginaDoPainel({
  titulo,
  acoes,
  children,
}: {
  titulo: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-7xl px-5 pt-6 pb-16">
      <title>{`${titulo} · Painel`}</title>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-extrabold font-stretch-[115%]">{titulo}</h1>
        {acoes}
      </div>
      {children}
    </main>
  );
}

export function CaixaVazia({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-[18px] border-[1.5px] border-dashed border-[#b9c4d2] bg-papel px-6 py-12 text-center">
      <h2 className="text-xl font-extrabold font-stretch-[118%]">{titulo}</h2>
      {children && <div className="mx-auto mt-2 max-w-lg text-suave">{children}</div>}
    </div>
  );
}

export function ErroAoCarregar({ erro, onTentar }: { erro: unknown; onTentar: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-[#f0c7c2] bg-[#fdf3f2] px-4 py-3 text-sm text-perigo"
    >
      <p className="font-semibold">{mensagemDeErro(erro)}</p>
      <button type="button" onClick={onTentar} className="botao botao-pequeno mt-2">
        Tentar de novo
      </button>
    </div>
  );
}

export function CarregandoPainel() {
  return (
    <p role="status" className="py-10 text-center text-sm font-medium text-suave">
      Carregando…
    </p>
  );
}
