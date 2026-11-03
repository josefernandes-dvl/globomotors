import {
  ROTULOS_STATUS_CARRO,
  type CarroPublico,
  type LojaPublica,
  type StatusPublico,
} from "@globomotors/shared";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ImagemDoCarro } from "../../componentes/ImagemDoCarro.tsx";
import {
  formatarAnos,
  formatarTelefone,
  resumoDoCarro,
  tituloDoCarro,
} from "../../lib/formatacao.ts";

const CORES_DA_ETIQUETA: Record<StatusPublico, string> = {
  disponivel: "bg-acento text-white",
  vendido: "bg-[#4a5568] text-white",
};

interface PropsEtiqueta {
  status: StatusPublico;
  destaque: boolean;
  className?: string;
}

export function EtiquetaDoCarro({ status, destaque, className = "" }: PropsEtiqueta) {
  if (status === "disponivel" && !destaque) return null;
  return (
    <span
      className={`rounded-md px-[9px] py-[5px] text-[11px] font-extrabold tracking-widest uppercase ${CORES_DA_ETIQUETA[status]} ${className}`}
    >
      {status === "disponivel" ? "Destaque" : ROTULOS_STATUS_CARRO[status]}
    </span>
  );
}

export function TopoDaVitrine({ loja, children }: { loja: LojaPublica; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#1c2d4a] fundo-topo">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <img
            src="/emblema.webp"
            alt=""
            className="size-9 flex-none drop-shadow-[0_0_10px_rgb(80_150_255/0.35)]"
          />
          <span className="truncate texto-metal text-base leading-none font-black uppercase font-stretch-[125%] sm:text-lg">
            {loja.nome}
          </span>
        </Link>
        {children}
      </div>
    </header>
  );
}

interface PropsCartao {
  carro: CarroPublico;
  nivel?: 2 | 3;
  doCatalogo?: boolean;
}

export function CartaoDoCarro({ carro, nivel = 2, doCatalogo = false }: PropsCartao) {
  const Titulo = nivel === 2 ? "h2" : "h3";
  const anos = formatarAnos(carro);
  const resumo = resumoDoCarro(carro);
  return (
    <Link
      to={`/catalogo/${carro.slug}`}
      state={doCatalogo ? { doCatalogo } : undefined}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-noite-linha bg-noite-cartao transition duration-200 hover:-translate-y-0.5 hover:border-[#33476a] hover:shadow-vitrine sm:rounded-2xl"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-noite-foto">
        <ImagemDoCarro
          url={carro.fotos[0]?.url}
          alt=""
          tom="escuro"
          className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-b from-transparent to-[rgb(7_13_24/0.88)]"
        />
        <EtiquetaDoCarro
          status={carro.status}
          destaque={carro.destaque}
          className="absolute top-2 left-2"
        />
        {anos && (
          <span className="absolute bottom-2 left-2.5 text-xs font-extrabold tracking-[0.06em] font-stretch-[120%] tabular-nums sm:text-sm">
            {anos}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3.5">
        <Titulo className="text-[15px] leading-tight font-extrabold uppercase font-stretch-[115%] sm:text-lg">
          {tituloDoCarro(carro)}
        </Titulo>
        {carro.versao && (
          <p className="truncate text-xs text-noite-suave sm:text-[13px]">{carro.versao}</p>
        )}
        {resumo && <p className="text-xs text-noite-prata tabular-nums">{resumo}</p>}
        <span className="mt-auto pt-1.5 text-[11px] font-bold tracking-[0.06em] text-acento-claro uppercase sm:text-xs">
          {carro.preco === null ? "Ver detalhes\u00a0→" : "Ver detalhes e preço\u00a0→"}
        </span>
      </div>
    </Link>
  );
}

export function RodapeVitrine({ loja }: { loja: LojaPublica }) {
  const partes = [
    loja.nome,
    loja.whatsapp && `WhatsApp ${formatarTelefone(loja.whatsapp)}`,
    loja.instagram && `@${loja.instagram}`,
  ];
  return (
    <footer className="border-t border-[#1a2740] text-[13px] text-[#7a869a]">
      <p className="mx-auto max-w-7xl px-5 pt-[22px] pb-10">{partes.filter(Boolean).join(" · ")}</p>
    </footer>
  );
}

export function AvisoVitrine({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-noite-borda px-5 py-[60px] text-center text-noite-suave">
      {children}
    </div>
  );
}
