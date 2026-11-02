import {
  ETAPAS_FUNIL,
  ROTULOS_ETAPA_FUNIL,
  type EtapaFunil,
  type Interesse,
} from "@globomotors/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Icone } from "../../componentes/Icone.tsx";
import { ImagemDoCarro } from "../../componentes/ImagemDoCarro.tsx";
import { linkWhatsApp } from "../../lib/compartilhamento.ts";
import { useEstadoDaPagina } from "../../lib/estadoDaPagina.ts";
import { formatarTelefone, tituloDoCarro } from "../../lib/formatacao.ts";
import { consultaInteresses } from "../../lib/painel.ts";
import { CaixaVazia, CarregandoPainel, ErroAoCarregar, PaginaDoPainel } from "./PartesDoPainel.tsx";
import { SeletorDeEtapa } from "./SeletorDeEtapa.tsx";

type Filtro = EtapaFunil | "";

const CORES_DAS_ETAPAS: Record<EtapaFunil, string> = {
  novo: "bg-acento",
  em_contato: "bg-acento-claro",
  visita_agendada: "bg-[#7b61c9]",
  proposta: "bg-alerta",
  negociacao: "bg-[#dd6b20]",
  vendido: "bg-ok",
  perdido: "bg-perigo",
};

export function PaginaFunil() {
  const interesses = useQuery(consultaInteresses());
  const [etapa, setEtapa] = useEstadoDaPagina<Filtro>("etapa", "");

  return (
    <PaginaDoPainel titulo="Funil de vendas">
      {interesses.isPending ? (
        <CarregandoPainel />
      ) : interesses.isError ? (
        <ErroAoCarregar erro={interesses.error} onTentar={() => void interesses.refetch()} />
      ) : interesses.data.length === 0 ? (
        <CaixaVazia titulo="Nenhum interesse registrado">
          <p>
            Registre o interesse de um cliente na página do carro ou do cliente. Cada interesse vira
            um cartão aqui, e você avança a etapa conforme a negociação anda.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to="/dashboard/cars" className="botao">
              Ver carros
            </Link>
            <Link to="/dashboard/customers" className="botao">
              Ver clientes
            </Link>
          </div>
        </CaixaVazia>
      ) : (
        <Quadro interesses={interesses.data} etapa={etapa} aoFiltrar={setEtapa} />
      )}
    </PaginaDoPainel>
  );
}

function Quadro({
  interesses,
  etapa,
  aoFiltrar,
}: {
  interesses: Interesse[];
  etapa: Filtro;
  aoFiltrar: (etapa: Filtro) => void;
}) {
  const daEtapa = (alvo: EtapaFunil) => interesses.filter((interesse) => interesse.etapa === alvo);
  const filtros: { valor: Filtro; rotulo: string; total: number }[] = [
    { valor: "", rotulo: "Todas", total: interesses.length },
    ...ETAPAS_FUNIL.map((valor) => ({
      valor,
      rotulo: ROTULOS_ETAPA_FUNIL[valor],
      total: daEtapa(valor).length,
    })),
  ];
  const etapas = etapa ? [etapa] : ETAPAS_FUNIL.filter((alvo) => daEtapa(alvo).length > 0);

  return (
    <>
      <div
        role="group"
        aria-label="Filtrar por etapa"
        className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        {filtros.map(({ valor, rotulo, total }) => (
          <button
            key={valor || "todas"}
            type="button"
            aria-pressed={etapa === valor}
            onClick={() => aoFiltrar(valor)}
            className="group inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-full border border-linha bg-papel py-1.5 pr-1.5 pl-3 text-[13px] font-semibold whitespace-nowrap transition hover:border-[#b9c4d2] aria-pressed:border-tinta aria-pressed:bg-tinta aria-pressed:text-white"
          >
            {valor && (
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${CORES_DAS_ETAPAS[valor]}`}
              />
            )}
            {rotulo}{" "}
            <span className="min-w-6 rounded-full bg-painel px-1.5 py-0.5 text-center text-xs text-suave tabular-nums group-aria-pressed:bg-white/15 group-aria-pressed:text-white">
              {total}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-6">
        {etapas.map((alvo) => {
          const itens = daEtapa(alvo);
          return (
            <section key={alvo} aria-labelledby={`etapa-${alvo}`}>
              <h2
                id={`etapa-${alvo}`}
                className="mb-2.5 flex items-center gap-2 text-sm font-extrabold tracking-wide uppercase"
              >
                <span
                  aria-hidden="true"
                  className={`size-2.5 rounded-full ${CORES_DAS_ETAPAS[alvo]}`}
                />
                {ROTULOS_ETAPA_FUNIL[alvo]}{" "}
                <span className="rounded-full bg-papel px-2 py-0.5 text-xs text-suave tabular-nums">
                  {itens.length}
                </span>
              </h2>
              {itens.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#b9c4d2] px-4 py-6 text-center text-sm text-suave">
                  Nenhum interesse nesta etapa.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {itens.map((interesse) => (
                    <li key={interesse.id}>
                      <CartaoDoInteresse interesse={interesse} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function CartaoDoInteresse({ interesse }: { interesse: Interesse }) {
  const { carro, cliente } = interesse;
  return (
    <article className="flex h-full flex-col gap-2.5 rounded-xl border border-linha bg-papel p-3 shadow-cartao">
      <div className="flex items-start gap-3">
        <ImagemDoCarro
          url={carro.capa}
          alt=""
          className="aspect-4/3 w-16 flex-none rounded-lg object-cover"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            to={`/dashboard/customers/${cliente.id}`}
            className="truncate leading-tight font-bold hover:text-acento"
          >
            {cliente.nome}
          </Link>
          <Link
            to={`/dashboard/cars/${carro.id}`}
            className="truncate text-[13px] text-suave hover:text-acento"
          >
            {[tituloDoCarro(carro), carro.anoModelo].filter(Boolean).join(" ")}
          </Link>
          <a
            href={linkWhatsApp(cliente.telefone)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 self-start text-[13px] font-semibold text-whatsapp-forte tabular-nums"
          >
            <Icone nome="whatsapp" className="size-3.5" />
            {formatarTelefone(cliente.telefone)}
          </a>
        </div>
      </div>
      {interesse.etapa === "perdido" && interesse.motivoPerda && (
        <p className="text-xs text-suave">Motivo: {interesse.motivoPerda}</p>
      )}
      <SeletorDeEtapa interesse={interesse} className="mt-auto" />
    </article>
  );
}
