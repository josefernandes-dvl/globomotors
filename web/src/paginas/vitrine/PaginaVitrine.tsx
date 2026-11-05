import {
  CAMBIOS,
  CARROCERIAS,
  COMBUSTIVEIS,
  LOJA_PADRAO,
  type CarroPublico,
} from "@globomotors/shared";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Abas } from "../../componentes/Abas.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { Selecao } from "../../componentes/Selecao.tsx";
import {
  abasDoCatalogo,
  anosUteis,
  combinaComBusca,
  contarFiltros,
  FILTROS_VAZIOS,
  filtrarCarros,
  LIMITES_DE_KM,
  LIMITES_DE_PRECO,
  limitesUteis,
  marcasDe,
  opcoesPresentes,
  ordenarCarros,
  ORDENS_VITRINE,
  ROTULOS_ORDEM,
  type AbaDoCatalogo,
  type Ordem,
} from "../../lib/catalogo.ts";
import { linkWhatsApp } from "../../lib/compartilhamento.ts";
import { useEstadoDaPagina } from "../../lib/estadoDaPagina.ts";
import { formatarDinheiro, formatarNumero, plural } from "../../lib/formatacao.ts";
import { consultaCarrosPublicos, consultaLojaPublica } from "../../lib/vitrine.ts";
import { AvisoVitrine, CartaoDoCarro, RodapeVitrine, TopoDaVitrine } from "./PartesDaVitrine.tsx";

const GRADE = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4";

const OPCOES_DE_ORDEM = ORDENS_VITRINE.map((valor) => ({ valor, rotulo: ROTULOS_ORDEM[valor] }));

const GRUPOS: {
  campo: "carrocerias" | "cambios" | "combustiveis";
  titulo: string;
  opcoes: readonly string[];
  valorDe: (carro: CarroPublico) => string | null;
}[] = [
  {
    campo: "carrocerias",
    titulo: "Carroceria",
    opcoes: CARROCERIAS,
    valorDe: (carro) => carro.carroceria,
  },
  { campo: "cambios", titulo: "Câmbio", opcoes: CAMBIOS, valorDe: (carro) => carro.cambio },
  {
    campo: "combustiveis",
    titulo: "Combustível",
    opcoes: COMBUSTIVEIS,
    valorDe: (carro) => carro.combustivel,
  },
];

const FAIXAS: {
  campo: "precoMaximo" | "anoMinimo" | "kmMaximo";
  titulo: string;
  qualquer: string;
  valoresDe: (carros: CarroPublico[]) => number[];
  rotulo: (valor: number) => string;
}[] = [
  {
    campo: "precoMaximo",
    titulo: "Preço",
    qualquer: "Qualquer preço",
    valoresDe: (carros) =>
      limitesUteis(
        LIMITES_DE_PRECO,
        carros.map((carro) => carro.preco),
      ),
    rotulo: (valor) => `Até ${formatarDinheiro(valor)}`,
  },
  {
    campo: "anoMinimo",
    titulo: "Ano",
    qualquer: "Qualquer ano",
    valoresDe: anosUteis,
    rotulo: (valor) => `A partir de ${valor}`,
  },
  {
    campo: "kmMaximo",
    titulo: "Quilometragem",
    qualquer: "Qualquer km",
    valoresDe: (carros) =>
      limitesUteis(
        LIMITES_DE_KM,
        carros.map((carro) => carro.km),
      ),
    rotulo: (valor) => `Até ${formatarNumero(valor)} km`,
  },
];

function alternar(lista: string[], valor: string) {
  return lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];
}

export function PaginaVitrine() {
  const { data: loja = LOJA_PADRAO } = useQuery(consultaLojaPublica);
  const carros = useQuery(consultaCarrosPublicos);
  const [busca, setBusca] = useEstadoDaPagina("busca", "");
  const [ordem, setOrdem] = useEstadoDaPagina<Ordem>("ordem", "destaque");
  const [filtros, setFiltros] = useEstadoDaPagina("filtros", FILTROS_VAZIOS);
  const [escolhida, setEscolhida] = useEstadoDaPagina<AbaDoCatalogo>("aba", null);
  const [painelAberto, setPainelAberto] = useState(false);

  const todos = carros.data ?? [];
  const disponiveis = todos.filter((carro) => carro.status === "disponivel").length;
  const { abas, aba, carros: daAba } = abasDoCatalogo(todos, escolhida);
  const encontrados = ordenarCarros(
    filtrarCarros(daAba, filtros).filter((carro) => combinaComBusca(carro, busca)),
    ordem,
    (carro) => carro.preco,
  );
  const ativos = contarFiltros(filtros);
  const marcas = marcasDe(daAba);
  const grupos = GRUPOS.map((grupo) => ({
    ...grupo,
    opcoes: opcoesPresentes(grupo.opcoes, daAba.map(grupo.valorDe)),
  })).filter((grupo) => grupo.opcoes.length > 1);
  const faixas = FAIXAS.map((faixa) => ({ ...faixa, valores: faixa.valoresDe(daAba) })).filter(
    (faixa) => faixa.valores.length > 0,
  );

  function limparTudo() {
    setBusca("");
    setFiltros(FILTROS_VAZIOS);
  }

  let conteudo: ReactNode;
  if (carros.isPending) {
    conteudo = (
      <div className={GRADE}>
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
    );
  } else if (carros.isError) {
    conteudo = (
      <AvisoVitrine>
        <p className="font-semibold text-noite-texto">Não foi possível carregar os veículos.</p>
        <p className="mt-1">{carros.error.message}</p>
        <button
          type="button"
          onClick={() => void carros.refetch()}
          className="botao botao-escuro mt-4"
        >
          Tentar de novo
        </button>
      </AvisoVitrine>
    );
  } else if (todos.length === 0) {
    conteudo = <AvisoVitrine>Em breve, novos veículos por aqui.</AvisoVitrine>;
  } else if (encontrados.length === 0) {
    conteudo = (
      <AvisoVitrine>
        <p className="font-semibold text-noite-texto">Nenhum veículo encontrado.</p>
        <p className="mt-1">Tente outra busca ou mude os filtros.</p>
        <button type="button" onClick={limparTudo} className="botao botao-escuro mt-4">
          Limpar busca e filtros
        </button>
      </AvisoVitrine>
    );
  } else {
    conteudo = (
      <ul className={GRADE}>
        {encontrados.map((carro) => (
          <li key={carro.slug}>
            <CartaoDoCarro carro={carro} doCatalogo />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="min-h-dvh bg-noite text-noite-texto">
      <title>{`Catálogo de veículos · ${loja.nome}`}</title>
      <TopoDaVitrine loja={loja}>
        {loja.whatsapp && (
          <a
            href={linkWhatsApp(loja.whatsapp)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-none items-center gap-2 rounded-full bg-whatsapp px-3 py-2 text-sm font-bold text-white hover:bg-whatsapp-forte"
          >
            <Icone nome="whatsapp" />
            <span className="max-sm:sr-only">WhatsApp</span>
          </a>
        )}
      </TopoDaVitrine>

      <div className="border-b border-[#1a2740] fundo-hero">
        <div className="mx-auto max-w-7xl px-4 pt-7 pb-6 sm:px-5">
          <h1 className="text-[28px] leading-none font-extrabold uppercase font-stretch-[120%] sm:text-4xl">
            Catálogo de veículos
          </h1>
          <p className="mt-2.5 flex flex-wrap gap-x-2 text-sm text-noite-prata">
            {carros.isSuccess && (
              <span>
                <b className="text-white tabular-nums">{formatarNumero(disponiveis)}</b>{" "}
                {disponiveis === 1 ? "veículo disponível" : "veículos disponíveis"}
              </span>
            )}
            {carros.isSuccess && loja.cidade && <span aria-hidden="true">·</span>}
            {loja.cidade && <span>{loja.cidade}</span>}
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-5">
        <Abas
          rotulo="Tipos de veículo"
          tema="escuro"
          abas={abas}
          valor={aba}
          aoMudar={(nova) => {
            setEscolhida(nova);
            setFiltros(FILTROS_VAZIOS);
            setPainelAberto(false);
          }}
          className="-mx-4 mt-2 px-4 sm:mx-0 sm:px-0"
        >
          <div className="flex flex-col gap-2.5 pt-4 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Buscar veículos</span>
              <Icone
                nome="busca"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-noite-suave"
              />
              <input
                type="search"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="O que você procura?"
                className="min-h-10 w-full rounded-[10px] border border-[#22314b] bg-noite-campo py-2 pr-3 pl-[38px] text-noite-texto outline-none placeholder:text-noite-suave focus:border-acento focus:ring-2 focus:ring-acento/25"
              />
            </label>
            <div className="flex items-center gap-2.5">
              {(grupos.length > 0 || faixas.length > 0) && (
                <button
                  type="button"
                  aria-expanded={painelAberto}
                  aria-controls="painel-de-filtros"
                  aria-label={
                    ativos > 0 ? `Filtros, ${plural(ativos, "ativo", "ativos")}` : undefined
                  }
                  onClick={() => setPainelAberto(!painelAberto)}
                  className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] border px-3.5 text-sm font-semibold transition ${
                    painelAberto || ativos > 0
                      ? "border-acento bg-acento/15 text-white"
                      : "border-[#22314b] bg-noite-campo text-noite-texto hover:border-[#33476a]"
                  }`}
                >
                  <Icone nome="filtros" />
                  Filtros
                  {ativos > 0 && (
                    <span className="grid min-w-5 place-items-center rounded-full bg-acento px-1.5 text-xs leading-5 font-bold text-white tabular-nums">
                      {ativos}
                    </span>
                  )}
                </button>
              )}
              <Selecao
                rotulo="Ordenar por"
                tema="escuro"
                alinhar="direita"
                valor={ordem}
                opcoes={OPCOES_DE_ORDEM}
                aoMudar={setOrdem}
                className="ml-auto min-w-[150px]"
              />
            </div>
          </div>

          <div
            id="painel-de-filtros"
            hidden={!painelAberto}
            className="mt-3 rounded-2xl border border-noite-linha bg-noite-cartao p-4 transition duration-200 starting:-translate-y-1 starting:opacity-0"
          >
            {grupos.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                {grupos.map(({ campo, titulo, opcoes }) => (
                  <fieldset key={campo}>
                    <legend className="mb-2 text-xs font-semibold tracking-[0.08em] text-noite-suave uppercase">
                      {titulo}
                    </legend>
                    <div className="flex flex-wrap gap-1.5">
                      {opcoes.map((opcao) => {
                        const marcado = filtros[campo].includes(opcao);
                        return (
                          <button
                            key={opcao}
                            type="button"
                            aria-pressed={marcado}
                            onClick={() =>
                              setFiltros({ ...filtros, [campo]: alternar(filtros[campo], opcao) })
                            }
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                              marcado
                                ? "border-acento bg-acento/20 text-white"
                                : "border-noite-borda text-noite-prata hover:border-[#33476a]"
                            }`}
                          >
                            {marcado && <Icone nome="marcado" className="size-3.5" />}
                            {opcao}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            )}
            {faixas.length > 0 && (
              <div
                className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${grupos.length > 0 ? "mt-4" : ""}`}
              >
                {faixas.map(({ campo, titulo, qualquer, valores, rotulo }) => (
                  <div key={campo} className="flex flex-col gap-1.5">
                    <span
                      aria-hidden="true"
                      className="text-xs font-semibold tracking-[0.08em] text-noite-suave uppercase"
                    >
                      {titulo}
                    </span>
                    <Selecao
                      rotulo={titulo}
                      tema="escuro"
                      valor={String(filtros[campo] ?? "")}
                      opcoes={[
                        { valor: "", rotulo: qualquer },
                        ...valores.map((valor) => ({
                          valor: String(valor),
                          rotulo: rotulo(valor),
                        })),
                      ]}
                      aoMudar={(valor) =>
                        setFiltros({ ...filtros, [campo]: valor ? Number(valor) : null })
                      }
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-noite-linha pt-4">
              <button
                type="button"
                disabled={ativos === 0}
                onClick={() => setFiltros({ ...FILTROS_VAZIOS, marca: filtros.marca })}
                className="cursor-pointer text-sm font-semibold text-acento-claro hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Limpar filtros
              </button>
              <button
                type="button"
                onClick={() => setPainelAberto(false)}
                className="botao botao-primario"
              >
                {`Ver ${plural(encontrados.length, "veículo", "veículos")}`}
              </button>
            </div>
          </div>

          {marcas.length > 1 && (
            <div
              role="group"
              aria-label="Filtrar por marca"
              className="-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 pt-3 sm:mx-0 sm:flex-wrap sm:px-0"
            >
              {["", ...marcas].map((opcao) => (
                <button
                  key={opcao || "todas"}
                  type="button"
                  aria-pressed={filtros.marca === opcao}
                  onClick={() => setFiltros({ ...filtros, marca: opcao })}
                  className={`flex-none cursor-pointer rounded-full border px-3.5 py-[7px] text-[13px] font-semibold tracking-[0.04em] uppercase ${
                    filtros.marca === opcao
                      ? "border-[#c9d2de] bg-linear-to-b from-white to-[#c9d2de] text-noite"
                      : "border-noite-borda text-noite-prata hover:border-[#33476a]"
                  }`}
                >
                  {opcao || "Todas"}
                </button>
              ))}
            </div>
          )}

          <div className="pt-4">{conteudo}</div>
        </Abas>
      </main>

      <RodapeVitrine loja={loja} />
    </div>
  );
}
