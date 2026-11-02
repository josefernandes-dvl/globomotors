import {
  LOJA_PADRAO,
  ROTULOS_STATUS_CARRO,
  STATUS_CARRO,
  type CarroPainel,
  type StatusCarro,
} from "@globomotors/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { BotaoConfirmar } from "../../componentes/BotaoConfirmar.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { ImagemDoCarro } from "../../componentes/ImagemDoCarro.tsx";
import { Selecao } from "../../componentes/Selecao.tsx";
import { api } from "../../lib/api.ts";
import { useAvisos } from "../../lib/avisos.ts";
import {
  combinaComBusca,
  marcasDe,
  ordenarCarros,
  ORDENS_PAINEL,
  ROTULOS_ORDEM,
  type Ordem,
} from "../../lib/catalogo.ts";
import { fichaDoCarro, linkDoCarro } from "../../lib/compartilhamento.ts";
import {
  formatarAnos,
  formatarDinheiro,
  formatarNumero,
  plural,
  resumoDoCarro,
  tituloDoCarro,
} from "../../lib/formatacao.ts";
import { mensagemDeErro } from "../../lib/formularios.ts";
import { CHAVE_PAINEL, consultaCarrosPainel, consultaLojaPainel } from "../../lib/painel.ts";
import { gerarCatalogoPdf } from "../../lib/pdf.ts";
import {
  CaixaVazia,
  CarregandoPainel,
  ErroAoCarregar,
  EtiquetaStatus,
  PaginaDoPainel,
} from "./PartesDoPainel.tsx";

const CHAVE_CARROS = consultaCarrosPainel.queryKey;

const OPCOES_DE_STATUS = STATUS_CARRO.map((valor) => ({
  valor,
  rotulo: ROTULOS_STATUS_CARRO[valor],
}));

const OPCOES_DO_FILTRO_DE_STATUS: { valor: StatusCarro | ""; rotulo: string }[] = [
  { valor: "", rotulo: "Todos os status" },
  ...OPCOES_DE_STATUS,
];

const OPCOES_DE_ORDEM = ORDENS_PAINEL.map((valor) => ({ valor, rotulo: ROTULOS_ORDEM[valor] }));

export function PaginaCatalogo() {
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const carros = useQuery(consultaCarrosPainel);
  const { data: loja = LOJA_PADRAO } = useQuery(consultaLojaPainel);
  const [busca, setBusca] = useState("");
  const [marca, setMarca] = useState("");
  const [status, setStatus] = useState<StatusCarro | "">("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [ficha, setFicha] = useState<string | null>(null);

  const mudarStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusCarro }) =>
      api.patch<{ carro: CarroPainel }>(`/dashboard/cars/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE_CARROS });
      const anteriores = queryClient.getQueryData(CHAVE_CARROS);
      queryClient.setQueryData(CHAVE_CARROS, (lista) =>
        lista?.map((carro) => (carro.id === id ? { ...carro, status } : carro)),
      );
      return { anteriores };
    },
    onError: (erro, _variaveis, contexto) => {
      queryClient.setQueryData(CHAVE_CARROS, contexto?.anteriores);
      avisar(mensagemDeErro(erro), "erro");
    },
    onSuccess: ({ carro }) => avisar(`Status alterado para ${ROTULOS_STATUS_CARRO[carro.status]}.`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHAVE_PAINEL }),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => api.delete(`/dashboard/cars/${id}`),
    onSuccess: (_resposta, id) => {
      queryClient.setQueryData(CHAVE_CARROS, (lista) => lista?.filter((carro) => carro.id !== id));
      avisar("Carro excluído do catálogo.");
    },
    onError: (erro) => avisar(mensagemDeErro(erro), "erro"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHAVE_PAINEL }),
  });

  const pdf = useMutation({
    mutationFn: () => gerarCatalogoPdf(),
    onSuccess: ({ documento, nomeDoArquivo }) => {
      documento.save(nomeDoArquivo);
    },
    onError: (erro) => avisar(mensagemDeErro(erro), "erro"),
  });

  async function copiarFicha(carro: CarroPainel) {
    const publicado = carro.status === "disponivel" || carro.status === "reservado";
    const texto = fichaDoCarro(carro, loja, publicado ? linkDoCarro(carro.slug) : null);
    try {
      await navigator.clipboard.writeText(texto);
      avisar("Ficha copiada. É só colar no WhatsApp.");
    } catch {
      setFicha(texto);
    }
  }

  const todos = carros.data ?? [];
  const opcoesDeMarca = [
    { valor: "", rotulo: "Todas as marcas" },
    ...marcasDe(todos).map((opcao) => ({ valor: opcao, rotulo: opcao })),
  ];
  const encontrados = ordenarCarros(
    todos.filter(
      (carro) =>
        (!marca || carro.marca === marca) &&
        (!status || carro.status === status) &&
        combinaComBusca(carro, busca, carro.placa, carro.vendedorNome),
    ),
    ordem,
    (carro) => carro.precoVenda,
  );

  let conteudo: ReactNode;
  if (carros.isPending) {
    conteudo = <CarregandoPainel />;
  } else if (carros.isError) {
    conteudo = <ErroAoCarregar erro={carros.error} onTentar={() => void carros.refetch()} />;
  } else if (todos.length === 0) {
    conteudo = (
      <CaixaVazia titulo="Seu catálogo está vazio">
        <p>
          Cadastre o primeiro carro. Ele entra como rascunho e só vai para a vitrine quando você
          publicar.
        </p>
        <Link to="/dashboard/cars/new" className="botao botao-primario mt-4">
          <Icone nome="mais" />
          Adicionar carro
        </Link>
      </CaixaVazia>
    );
  } else if (encontrados.length === 0) {
    conteudo = (
      <CaixaVazia titulo="Nada encontrado">
        <p>Nenhum carro corresponde aos filtros.</p>
        <button
          type="button"
          onClick={() => {
            setBusca("");
            setMarca("");
            setStatus("");
          }}
          className="botao mt-4"
        >
          Limpar filtros
        </button>
      </CaixaVazia>
    );
  } else {
    conteudo = (
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {encontrados.map((carro) => (
          <li key={carro.id}>
            <CartaoDoCarro
              carro={carro}
              onStatus={(novo) => mudarStatus.mutate({ id: carro.id, status: novo })}
              onFicha={() => void copiarFicha(carro)}
              onExcluir={() => excluir.mutate(carro.id)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <PaginaDoPainel
      titulo="Carros"
      acoes={
        <>
          <button
            type="button"
            onClick={() => pdf.mutate()}
            disabled={pdf.isPending}
            title="Catálogo em PDF com os carros publicados na vitrine"
            className="botao"
          >
            <Icone nome="baixar" />
            {pdf.isPending ? "Gerando PDF…" : "Baixar PDF"}
          </button>
          <Link to="/dashboard/cars/new" className="botao botao-primario">
            <Icone nome="mais" />
            Adicionar carro
          </Link>
        </>
      }
    >
      {todos.length > 0 && <Estatisticas carros={todos} />}
      {todos.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <label className="relative col-span-2 sm:min-w-[240px] sm:flex-1">
            <span className="sr-only">Buscar no catálogo</span>
            <Icone
              nome="busca"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave"
            />
            <input
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar por marca, modelo, placa, vendedor…"
              className="entrada pl-9"
            />
          </label>
          <Selecao
            rotulo="Filtrar por marca"
            valor={marca}
            opcoes={opcoesDeMarca}
            aoMudar={setMarca}
            className="sm:w-44"
          />
          <Selecao
            rotulo="Filtrar por status"
            valor={status}
            opcoes={OPCOES_DO_FILTRO_DE_STATUS}
            aoMudar={setStatus}
            alinhar="direita"
            className="sm:w-44"
          />
          <Selecao
            rotulo="Ordenar por"
            valor={ordem}
            opcoes={OPCOES_DE_ORDEM}
            aoMudar={setOrdem}
            alinhar="direita"
            className="col-span-2 sm:w-44"
          />
        </div>
      )}
      {conteudo}
      {ficha !== null && <DialogoDaFicha texto={ficha} onFechar={() => setFicha(null)} />}
    </PaginaDoPainel>
  );
}

function Estatisticas({ carros }: { carros: CarroPainel[] }) {
  const quantos = (status: StatusCarro) => carros.filter((carro) => carro.status === status).length;
  const emEstoque = carros
    .filter((carro) => carro.status !== "vendido")
    .reduce((total, carro) => total + (carro.precoVenda ?? 0), 0);
  const itens = [
    { rotulo: "No catálogo", valor: formatarNumero(carros.length), cor: "" },
    { rotulo: "Disponíveis", valor: formatarNumero(quantos("disponivel")), cor: "text-ok" },
    { rotulo: "Reservados", valor: formatarNumero(quantos("reservado")), cor: "text-alerta" },
    { rotulo: "Vendidos", valor: formatarNumero(quantos("vendido")), cor: "text-vendido" },
    { rotulo: "Rascunhos", valor: formatarNumero(quantos("rascunho")), cor: "text-suave" },
    { rotulo: "Valor em estoque", valor: formatarDinheiro(emEstoque), cor: "" },
  ];
  return (
    <dl className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:gap-2.5 sm:overflow-visible sm:px-0">
      {itens.map(({ rotulo, valor, cor }) => (
        <div
          key={rotulo}
          className="flex-none rounded-xl border border-linha bg-papel px-3.5 py-2.5 sm:min-w-[118px] sm:px-4 sm:py-3 sm:shadow-cartao sm:last:flex-1"
        >
          <dt className="rotulo whitespace-nowrap">{rotulo}</dt>
          <dd
            className={`text-xl font-extrabold whitespace-nowrap font-stretch-[112%] tabular-nums sm:text-2xl ${cor}`}
          >
            {valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface PropsCartao {
  carro: CarroPainel;
  onStatus: (status: StatusCarro) => void;
  onFicha: () => void;
  onExcluir: () => void;
}

function CartaoDoCarro({ carro, onStatus, onFicha, onExcluir }: PropsCartao) {
  const idTitulo = useId();
  const vendido = carro.status === "vendido";
  const anos = formatarAnos(carro);
  const resumo = resumoDoCarro(carro);
  const internos = [
    carro.placa,
    carro.margem !== null && `Margem ${formatarDinheiro(carro.margem)}`,
    !vendido && `${plural(carro.diasEmEstoque, "dia", "dias")} em estoque`,
    carro.interessados > 0 && plural(carro.interessados, "interessado", "interessados"),
  ].filter(Boolean);

  return (
    <article
      aria-labelledby={idTitulo}
      className="flex h-full flex-col rounded-[14px] border border-linha bg-papel shadow-cartao"
    >
      <div className="relative aspect-4/3 overflow-hidden rounded-t-[13px] bg-[#e2e7ee]">
        <ImagemDoCarro
          url={carro.fotos[0]?.url}
          alt=""
          className={`size-full object-cover ${vendido ? "grayscale" : ""}`}
        />
        {anos && (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-b from-transparent to-[rgb(7_13_24/0.75)]"
            />
            <span className="absolute bottom-2 left-2.5 text-xs font-extrabold tracking-[0.06em] text-white font-stretch-[120%] tabular-nums sm:text-sm">
              {anos}
            </span>
          </>
        )}
        <EtiquetaStatus status={carro.status} className="absolute top-2 left-2" />
        {carro.destaque && (
          <span className="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-1 text-[11px] leading-none font-bold text-[#ffc93c]">
            <span aria-hidden="true">★</span>
            <span className="max-sm:sr-only"> Destaque</span>
          </span>
        )}
        {carro.fotos.length > 1 && (
          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] leading-none font-semibold text-white">
            <Icone nome="foto" className="size-3 sm:hidden" />
            {carro.fotos.length}
            <span className="max-sm:sr-only"> fotos</span>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5 sm:gap-1 sm:px-3.5 sm:pt-3">
        <h2
          id={idTitulo}
          className="text-sm leading-tight font-extrabold font-stretch-[112%] sm:text-[17px]"
        >
          {tituloDoCarro(carro)}
        </h2>
        {carro.versao && (
          <p className="truncate text-xs text-suave sm:text-[13px]">{carro.versao}</p>
        )}
        {resumo && <p className="text-xs text-suave tabular-nums sm:text-[13px]">{resumo}</p>}
        <p className="mt-1 text-lg leading-tight font-extrabold font-stretch-[112%] tabular-nums sm:text-[22px]">
          {carro.precoVenda === null ? "Sem preço" : formatarDinheiro(carro.precoVenda)}
        </p>
        {carro.vendedorNome && (
          <p className="truncate text-[11px] text-suave sm:text-xs">
            Vendedor: {carro.vendedorNome}
          </p>
        )}
        {internos.length > 0 && (
          <p className="text-[11px] leading-snug text-suave tabular-nums sm:text-xs">
            {internos.join(" · ")}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 rounded-b-[13px] border-t border-linha bg-painel p-2">
        <Selecao
          rotulo="Status"
          valor={carro.status}
          opcoes={OPCOES_DE_STATUS}
          aoMudar={onStatus}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Link to={`/dashboard/cars/${carro.id}`} className="botao botao-pequeno flex-1">
            <Icone nome="editar" />
            <span className="max-sm:sr-only">Editar</span>
          </Link>
          <button
            type="button"
            onClick={onFicha}
            title="Copiar ficha para WhatsApp"
            className="botao botao-pequeno flex-1"
          >
            <Icone nome="copiar" />
            <span className="max-sm:sr-only">Ficha</span>
          </button>
          <BotaoConfirmar
            pergunta="Excluir este carro?"
            onConfirmar={onExcluir}
            rotulo="Excluir"
            className="botao botao-pequeno flex-1 text-perigo sm:flex-none"
          >
            <Icone nome="lixeira" />
          </BotaoConfirmar>
        </div>
      </div>
    </article>
  );
}

function DialogoDaFicha({ texto, onFechar }: { texto: string; onFechar: () => void }) {
  const idTitulo = useId();
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-[rgb(7_13_24/0.6)] p-4"
      onKeyDown={(evento) => {
        if (evento.key === "Escape") onFechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="w-full max-w-lg rounded-2xl bg-papel p-5 shadow-cartao"
      >
        <h2 id={idTitulo} className="text-lg font-extrabold font-stretch-[112%]">
          Ficha do veículo
        </h2>
        <p className="mt-1 text-sm text-suave">
          Não foi possível copiar automaticamente. Selecione e copie o texto abaixo:
        </p>
        <textarea
          readOnly
          autoFocus
          aria-label="Texto da ficha"
          value={texto}
          rows={12}
          onFocus={(evento) => evento.currentTarget.select()}
          className="entrada mt-3 font-mono text-[13px]"
        />
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={onFechar} className="botao">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
