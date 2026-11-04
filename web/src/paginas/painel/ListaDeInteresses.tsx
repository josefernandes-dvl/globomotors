import { ROTULOS_STATUS_CARRO, type Interesse } from "@globomotors/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { BotaoConfirmar } from "../../componentes/BotaoConfirmar.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { ImagemDoCarro } from "../../componentes/ImagemDoCarro.tsx";
import { api } from "../../lib/api.ts";
import { useAvisos } from "../../lib/avisos.ts";
import { linkWhatsApp } from "../../lib/compartilhamento.ts";
import { formatarTelefone, nomeDoVeiculo, tituloDoCarro } from "../../lib/formatacao.ts";
import { mensagemDeErro } from "../../lib/formularios.ts";
import {
  CHAVE_PAINEL,
  consultaCarrosPainel,
  consultaClientes,
  consultaInteresses,
} from "../../lib/painel.ts";
import { SeletorDeEtapa } from "./SeletorDeEtapa.tsx";

type Props = { carroId: string } | { clienteId: string };

interface Opcao {
  id: string;
  rotulo: string;
}

export function ListaDeInteresses(props: Props) {
  const doCarro = "carroId" in props;
  const filtro = doCarro ? { carroId: props.carroId } : { clienteId: props.clienteId };
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const interesses = useQuery(consultaInteresses(filtro));

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/dashboard/interests/${id}`),
    onSuccess: () => avisar("Interesse removido."),
    onError: (erro) => avisar(mensagemDeErro(erro), "erro"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHAVE_PAINEL }),
  });

  const lista = interesses.data ?? [];
  const vinculados = new Set(
    lista.map((interesse) => (doCarro ? interesse.cliente.id : interesse.carro.id)),
  );

  return (
    <section aria-labelledby="titulo-interessados" className="flex flex-col gap-3">
      <h2 id="titulo-interessados" className="text-base font-extrabold font-stretch-[112%]">
        {doCarro ? "Clientes interessados" : "Veículos de interesse"}
      </h2>
      {interesses.isPending && (
        <p role="status" className="text-sm text-suave">
          Carregando…
        </p>
      )}
      {interesses.isError && (
        <p role="alert" className="text-sm text-perigo">
          {mensagemDeErro(interesses.error)}
        </p>
      )}
      {interesses.isSuccess && lista.length === 0 && (
        <p className="text-sm text-suave">
          {doCarro
            ? "Nenhum cliente interessado ainda."
            : "Este cliente ainda não tem veículo de interesse."}
        </p>
      )}
      {lista.length > 0 && (
        <ul className="flex flex-col gap-2">
          {lista.map((interesse) => (
            <li
              key={interesse.id}
              className="flex flex-col gap-2 rounded-xl border border-linha bg-papel p-3"
            >
              {doCarro ? (
                <ClienteDoInteresse interesse={interesse} />
              ) : (
                <CarroDoInteresse interesse={interesse} />
              )}
              {interesse.etapa === "perdido" && interesse.motivoPerda && (
                <p className="text-xs text-suave">Motivo: {interesse.motivoPerda}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <SeletorDeEtapa interesse={interesse} className="w-48" />
                <BotaoConfirmar
                  pergunta="Remover este interesse?"
                  onConfirmar={() => remover.mutate(interesse.id)}
                  rotulo="Remover interesse"
                  className="botao botao-pequeno botao-fantasma ml-auto text-perigo"
                >
                  <Icone nome="lixeira" />
                </BotaoConfirmar>
              </div>
            </li>
          ))}
        </ul>
      )}
      {interesses.isSuccess &&
        (doCarro ? (
          <NovoInteresseNoCarro carroId={props.carroId} vinculados={vinculados} />
        ) : (
          <NovoInteresseNoCliente clienteId={props.clienteId} vinculados={vinculados} />
        ))}
    </section>
  );
}

function ClienteDoInteresse({ interesse }: { interesse: Interesse }) {
  const { cliente } = interesse;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <Link to={`/dashboard/customers/${cliente.id}`} className="font-bold hover:text-acento">
        {cliente.nome}
      </Link>
      <a
        href={linkWhatsApp(cliente.telefone)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-whatsapp-forte"
      >
        <Icone nome="whatsapp" className="size-3.5" />
        {formatarTelefone(cliente.telefone)}
      </a>
    </div>
  );
}

function CarroDoInteresse({ interesse }: { interesse: Interesse }) {
  const { carro } = interesse;
  return (
    <div className="flex items-center gap-3">
      <ImagemDoCarro
        url={carro.capa}
        alt=""
        className="aspect-4/3 w-16 flex-none rounded-md object-cover"
      />
      <div className="min-w-0">
        <Link
          to={`/dashboard/cars/${carro.id}`}
          className="block truncate font-bold hover:text-acento"
        >
          {[tituloDoCarro(carro), carro.anoModelo].filter(Boolean).join(" ")}
        </Link>
        <p className="truncate text-xs text-suave">
          {[carro.versao, ROTULOS_STATUS_CARRO[carro.status]].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

function NovoInteresseNoCarro({
  carroId,
  vinculados,
}: {
  carroId: string;
  vinculados: Set<string>;
}) {
  const clientes = useQuery(consultaClientes(""));
  const opcoes = (clientes.data ?? [])
    .filter((cliente) => !vinculados.has(cliente.id))
    .map((cliente) => ({
      id: cliente.id,
      rotulo: `${cliente.nome} · ${formatarTelefone(cliente.telefone)}`,
    }));
  if (clientes.isSuccess && clientes.data.length === 0) {
    return (
      <p className="text-sm text-suave">
        Nenhum cliente cadastrado.{" "}
        <Link to="/dashboard/customers/new" className="font-semibold text-acento">
          Cadastrar cliente
        </Link>
      </p>
    );
  }
  return (
    <FormularioDeInteresse
      rotulo="Cliente"
      vazio="Escolha um cliente"
      opcoes={opcoes}
      carregando={clientes.isPending}
      montar={(clienteId) => ({ clienteId, carroId })}
    />
  );
}

function NovoInteresseNoCliente({
  clienteId,
  vinculados,
}: {
  clienteId: string;
  vinculados: Set<string>;
}) {
  const carros = useQuery(consultaCarrosPainel);
  const opcoes = (carros.data ?? [])
    .filter((carro) => carro.status !== "vendido" && !vinculados.has(carro.id))
    .map((carro) => ({
      id: carro.id,
      rotulo: [nomeDoVeiculo(carro), ROTULOS_STATUS_CARRO[carro.status]].join(" · "),
    }));
  return (
    <FormularioDeInteresse
      rotulo="Veículo"
      vazio="Escolha um veículo"
      opcoes={opcoes}
      carregando={carros.isPending}
      montar={(carroId) => ({ clienteId, carroId })}
    />
  );
}

interface PropsFormulario {
  rotulo: string;
  vazio: string;
  opcoes: Opcao[];
  carregando: boolean;
  montar: (id: string) => { clienteId: string; carroId: string };
}

function FormularioDeInteresse({ rotulo, vazio, opcoes, carregando, montar }: PropsFormulario) {
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const [escolhido, setEscolhido] = useState("");

  const adicionar = useMutation({
    mutationFn: (dados: { clienteId: string; carroId: string }) =>
      api.post<{ interesse: Interesse }>("/dashboard/interests", dados),
    onSuccess: () => {
      setEscolhido("");
      avisar("Interesse registrado.");
    },
    onError: (erro) => avisar(mensagemDeErro(erro), "erro"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHAVE_PAINEL }),
  });

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (escolhido) adicionar.mutate(montar(escolhido));
  }

  return (
    <form onSubmit={aoEnviar} className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-[200px] flex-1 flex-col gap-1">
        <span className="rotulo">{rotulo}</span>
        <select
          value={escolhido}
          disabled={carregando}
          onChange={(evento) => setEscolhido(evento.target.value)}
          className="entrada"
        >
          <option value="">{carregando ? "Carregando…" : vazio}</option>
          {opcoes.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={!escolhido || adicionar.isPending}
        className="botao botao-primario"
      >
        <Icone nome="mais" />
        Registrar interesse
      </button>
    </form>
  );
}
