import { LOJA_PADRAO } from "@globomotors/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Icone } from "../../componentes/Icone.tsx";
import { ordenarCarros } from "../../lib/catalogo.ts";
import { linkWhatsApp } from "../../lib/compartilhamento.ts";
import { formatarNumero, formatarTelefone } from "../../lib/formatacao.ts";
import { consultaCarrosPublicos, consultaLojaPublica } from "../../lib/vitrine.ts";
import { CartaoDoCarro, RodapeVitrine } from "./PartesDaVitrine.tsx";

const PASSOS = [
  {
    titulo: "Escolha no catálogo",
    texto: "Veja as fotos e a ficha de cada veículo, direto do celular.",
  },
  {
    titulo: "Chame no WhatsApp",
    texto: "Tire suas dúvidas e combine uma visita para ver o veículo de perto.",
  },
  { titulo: "Feche negócio", texto: "Acertou os detalhes? É só combinar a entrega." },
];

const TITULO_DE_SECAO =
  "text-xl leading-none font-extrabold uppercase font-stretch-[118%] sm:text-2xl";

export function PaginaInicial() {
  const { data: loja = LOJA_PADRAO } = useQuery(consultaLojaPublica);
  const carros = useQuery(consultaCarrosPublicos);
  const todos = carros.data ?? [];
  const disponiveis = todos.filter((carro) => carro.status === "disponivel").length;
  const destaques = ordenarCarros(
    todos.filter((carro) => carro.status !== "vendido"),
    "destaque",
    (carro) => carro.preco,
  ).slice(0, 4);

  return (
    <div className="min-h-dvh bg-noite text-noite-texto">
      <title>{loja.nome}</title>
      <header className="border-b border-[#1a2740] fundo-hero">
        <div className="mx-auto flex min-h-[78svh] max-w-3xl flex-col items-center justify-center px-5 py-12 text-center">
          <img
            src="/logo.webp"
            alt=""
            className="w-[min(400px,80vw)] drop-shadow-[0_20px_40px_rgb(0_0_0/0.45)]"
          />
          <h1 className="sr-only">{loja.nome}</h1>
          {loja.cidade && (
            <p className="mt-2 inline-flex items-center gap-2 text-xs tracking-[0.18em] text-noite-prata uppercase">
              <span aria-hidden="true" className="h-0.5 w-7 bg-acento" />
              {loja.cidade}
              <span aria-hidden="true" className="h-0.5 w-7 bg-acento" />
            </p>
          )}
          {loja.slogan && (
            <p className="mt-3 max-w-[560px] text-lg text-[#aeb8c7] sm:text-xl">{loja.slogan}</p>
          )}
          <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <Link
              to="/catalogo"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-acento px-7 py-4 text-base font-extrabold tracking-[0.06em] text-white uppercase shadow-[0_12px_32px_-8px_rgb(47_111_192/0.8)] transition hover:bg-acento-forte active:translate-y-px"
            >
              Ver catálogo
              <Icone nome="direita" className="size-5" />
            </Link>
            {loja.whatsapp && (
              <a
                href={linkWhatsApp(loja.whatsapp)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2c3d5c] bg-white/5 px-6 py-4 text-base font-bold text-white transition hover:bg-white/10 active:translate-y-px"
              >
                <Icone nome="whatsapp" className="size-5 text-whatsapp" />
                Falar no WhatsApp
              </a>
            )}
          </div>
          {disponiveis > 0 && (
            <p className="mt-5 text-sm text-noite-suave">
              <b className="text-white tabular-nums">{formatarNumero(disponiveis)}</b>{" "}
              {disponiveis === 1 ? "veículo disponível agora" : "veículos disponíveis agora"}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-5">
        {(carros.isPending || destaques.length > 0) && (
          <section aria-labelledby="titulo-destaques" className="py-10 sm:py-14">
            <div className="flex items-end justify-between gap-3">
              <h2 id="titulo-destaques" className={TITULO_DE_SECAO}>
                Em destaque
              </h2>
              <Link
                to="/catalogo"
                className="text-sm font-semibold text-acento-claro hover:text-white"
              >
                Ver todos
              </Link>
            </div>
            {carros.isPending ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <p role="status" className="sr-only">
                  Carregando veículos…
                </p>
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-[230px] animate-pulse rounded-xl bg-noite-cartao sm:h-[300px] sm:rounded-2xl"
                  />
                ))}
              </div>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {destaques.map((carro) => (
                  <li key={carro.slug}>
                    <CartaoDoCarro carro={carro} nivel={3} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {loja.whatsapp && (
          <section
            aria-labelledby="titulo-como-comprar"
            className="border-t border-noite-linha py-10 sm:py-14"
          >
            <h2 id="titulo-como-comprar" className={TITULO_DE_SECAO}>
              Como comprar
            </h2>
            <ol className="mt-5 grid gap-3 sm:grid-cols-3">
              {PASSOS.map(({ titulo, texto }, indice) => (
                <li
                  key={titulo}
                  className="flex gap-3.5 rounded-2xl border border-noite-linha bg-noite-cartao p-4"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-9 flex-none place-items-center rounded-full border border-acento/50 bg-acento/15 font-extrabold text-acento-claro tabular-nums"
                  >
                    {indice + 1}
                  </span>
                  <div>
                    <h3 className="font-bold">{titulo}</h3>
                    <p className="mt-0.5 text-sm text-noite-suave">{texto}</p>
                  </div>
                </li>
              ))}
            </ol>
            <a
              href={linkWhatsApp(loja.whatsapp)}
              target="_blank"
              rel="noreferrer"
              className="mt-6 flex items-center justify-center gap-2.5 rounded-xl bg-whatsapp px-4 py-[13px] font-bold text-white hover:bg-whatsapp-forte sm:mx-auto sm:max-w-sm"
            >
              <Icone nome="whatsapp" className="size-5" />
              {`WhatsApp ${formatarTelefone(loja.whatsapp)}`}
            </a>
          </section>
        )}

        {loja.instagram && (
          <p className="border-t border-noite-linha py-8 text-center text-sm text-noite-suave">
            Acompanhe as novidades no Instagram{" "}
            <a
              href={`https://instagram.com/${loja.instagram}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-acento-claro hover:text-white"
            >
              @{loja.instagram}
            </a>
          </p>
        )}
      </main>

      <RodapeVitrine loja={loja} />
    </div>
  );
}
