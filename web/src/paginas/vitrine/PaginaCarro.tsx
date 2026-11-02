import {
  LOJA_PADRAO,
  type CarroPublico,
  type FotoCarro,
  type LojaPublica,
} from "@globomotors/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Icone } from "../../componentes/Icone.tsx";
import { ImagemDoCarro } from "../../componentes/ImagemDoCarro.tsx";
import { ErroApi } from "../../lib/api.ts";
import { linkDoCarro, linkWhatsApp, mensagemDeInteresse } from "../../lib/compartilhamento.ts";
import {
  fichaTecnica,
  formatarPreco,
  formatarTelefone,
  tituloDoCarro,
} from "../../lib/formatacao.ts";
import { consultaCarroPublico, consultaLojaPublica } from "../../lib/vitrine.ts";
import { AvisoVitrine, EtiquetaDoCarro, RodapeVitrine, TopoDaVitrine } from "./PartesDaVitrine.tsx";

export function PaginaCarro() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const veioDoCatalogo =
    (useLocation().state as { doCatalogo?: boolean } | null)?.doCatalogo === true;
  const { data: loja = LOJA_PADRAO } = useQuery(consultaLojaPublica);
  const consulta = useQuery(consultaCarroPublico(slug));

  let conteudo: ReactNode;
  if (consulta.isPending) {
    conteudo = (
      <>
        <p role="status" className="sr-only">
          Carregando veículo…
        </p>
        <div className="h-[480px] animate-pulse rounded-[18px] bg-noite-cartao" />
      </>
    );
  } else if (consulta.isError) {
    const naoExiste = consulta.error instanceof ErroApi && consulta.error.status === 404;
    conteudo = naoExiste ? (
      <AvisoVitrine>
        <h1 className="text-xl font-extrabold text-noite-texto font-stretch-[115%]">
          Veículo não encontrado
        </h1>
        <p className="mt-1">Ele pode ter sido vendido ou retirado do catálogo.</p>
        <Link to="/catalogo" className="botao botao-primario mt-4">
          Ver os veículos disponíveis
        </Link>
      </AvisoVitrine>
    ) : (
      <AvisoVitrine>
        <p className="font-semibold text-noite-texto">Não foi possível carregar este veículo.</p>
        <p className="mt-1">{consulta.error.message}</p>
        <button
          type="button"
          onClick={() => void consulta.refetch()}
          className="botao botao-escuro mt-4"
        >
          Tentar de novo
        </button>
      </AvisoVitrine>
    );
  } else {
    conteudo = <DetalheDoCarro carro={consulta.data} loja={loja} />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-noite text-noite-texto">
      <TopoDaVitrine loja={loja} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-12 sm:px-5">
        <Link
          to="/catalogo"
          onClick={(evento) => {
            if (!veioDoCatalogo) return;
            evento.preventDefault();
            void navigate(-1);
          }}
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-acento-claro hover:text-white"
        >
          <Icone nome="esquerda" />
          Voltar ao catálogo
        </Link>
        {conteudo}
      </main>
      <RodapeVitrine loja={loja} />
    </div>
  );
}

function DetalheDoCarro({ carro, loja }: { carro: CarroPublico; loja: LojaPublica }) {
  const titulo = tituloDoCarro(carro);
  const ficha = fichaTecnica(carro);
  const whatsapp = carro.status === "vendido" ? null : loja.whatsapp;

  return (
    <article className="grid grid-cols-1 overflow-hidden rounded-[18px] border border-noite-linha bg-noite-cartao md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <title>{`${[titulo, carro.versao].filter(Boolean).join(" ")} · ${loja.nome}`}</title>
      <Galeria key={carro.slug} fotos={carro.fotos} titulo={titulo} />
      <div className="flex flex-col gap-3.5 p-5 sm:p-6">
        <EtiquetaDoCarro status={carro.status} destaque={carro.destaque} className="self-start" />
        <h1 className="text-[26px] leading-[1.05] font-extrabold uppercase font-stretch-[118%]">
          {titulo}
        </h1>
        {carro.versao && <p className="-mt-2 text-noite-suave">{carro.versao}</p>}
        <p className="text-[32px] leading-tight font-extrabold text-acento-claro font-stretch-[120%] tabular-nums">
          {formatarPreco(carro.preco)}
        </p>
        {ficha.length > 0 && (
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#22314b] bg-[#22314b]">
            {ficha.map(({ rotulo, valor }) => (
              <div key={rotulo} className="bg-noite-cartao px-3 py-2.5 last:odd:col-span-2">
                <dt className="text-[11px] tracking-[0.07em] text-noite-suave uppercase">
                  {rotulo}
                </dt>
                <dd className="font-bold tabular-nums">{valor}</dd>
              </div>
            ))}
          </dl>
        )}
        {carro.opcionais.length > 0 && (
          <section>
            <h2 className="mb-1.5 text-xs tracking-[0.07em] text-noite-prata uppercase">Possui:</h2>
            <ul className="flex flex-wrap gap-1.5">
              {carro.opcionais.map((opcional) => (
                <li
                  key={opcional}
                  className="rounded-full border border-noite-borda bg-noite-foto px-2.5 py-1 text-[13px]"
                >
                  {opcional}
                </li>
              ))}
            </ul>
          </section>
        )}
        {carro.descricao && (
          <p className="whitespace-pre-wrap text-noite-prata">{carro.descricao}</p>
        )}
        {whatsapp && (
          <div className="flex flex-col gap-1.5">
            <a
              href={linkWhatsApp(whatsapp, mensagemDeInteresse(carro, linkDoCarro(carro.slug)))}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2.5 rounded-xl bg-whatsapp px-4 py-[13px] font-bold text-white hover:bg-whatsapp-forte"
            >
              <Icone nome="whatsapp" className="size-5" />
              Tenho interesse: chamar no WhatsApp
            </a>
            <p className="text-center text-xs text-noite-suave">
              WhatsApp {formatarTelefone(whatsapp)}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

function Galeria({ fotos, titulo }: { fotos: FotoCarro[]; titulo: string }) {
  const [indice, setIndice] = useState(0);
  const total = fotos.length;

  useEffect(() => {
    if (total < 2) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "ArrowRight") setIndice((atual) => (atual + 1) % total);
      if (evento.key === "ArrowLeft") setIndice((atual) => (atual - 1 + total) % total);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [total]);

  const navegacao =
    "absolute top-1/2 grid size-[42px] -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/14 text-white backdrop-blur-md hover:bg-white/26";

  return (
    <section aria-label="Fotos do veículo" className="flex flex-col bg-noite">
      <div className="relative grid aspect-4/3 place-items-center overflow-hidden">
        <ImagemDoCarro
          url={fotos[indice]?.url}
          alt={total > 1 ? `${titulo}, foto ${indice + 1} de ${total}` : titulo}
          tom="escuro"
          className="size-full object-contain"
        />
        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={() => setIndice((indice - 1 + total) % total)}
              className={`${navegacao} left-3`}
            >
              <Icone nome="esquerda" className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Próxima foto"
              onClick={() => setIndice((indice + 1) % total)}
              className={`${navegacao} right-3`}
            >
              <Icone nome="direita" className="size-5" />
            </button>
          </>
        )}
      </div>
      {total > 1 && (
        <div className="flex gap-1.5 overflow-x-auto p-2.5">
          {fotos.map((foto, posicao) => (
            <button
              key={foto.id}
              type="button"
              aria-label={`Ver foto ${posicao + 1}`}
              aria-current={posicao === indice ? "true" : undefined}
              onClick={() => setIndice(posicao)}
              className={`h-[54px] w-[72px] flex-none cursor-pointer overflow-hidden rounded-md border-2 transition ${
                posicao === indice
                  ? "border-acento"
                  : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <img src={foto.url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
