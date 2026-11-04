import {
  errosDeCampo,
  esquemaDesejo,
  ROTULOS_ETAPA_FUNIL,
  ROTULOS_STATUS_CARRO,
  TAMANHO_MAXIMO_DESEJO,
  type CarroPainel,
  type ClienteComDesejos,
  type Desejo,
  type DesejoValidado,
  type Interesse,
  type VeiculoPossivel,
} from "@globomotors/shared";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router";
import { BotaoConfirmar } from "../../componentes/BotaoConfirmar.tsx";
import { CampoAreaTexto, CampoSelecao, CampoTexto } from "../../componentes/Campo.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { api } from "../../lib/api.ts";
import { useAvisos } from "../../lib/avisos.ts";
import { linkWhatsApp } from "../../lib/compartilhamento.ts";
import {
  formatarDinheiro,
  formatarPreco,
  formatarTelefone,
  nomeDoVeiculo,
  plural,
} from "../../lib/formatacao.ts";
import { lerDinheiro, lerInteiro } from "../../lib/formularioCarro.ts";
import {
  errosDaApi,
  errosPorCampo,
  mensagemDeErro,
  type ErrosDoFormulario,
} from "../../lib/formularios.ts";
import {
  CHAVE_PAINEL,
  consultaCarrosPainel,
  consultaClientes,
  consultaDesejos,
} from "../../lib/painel.ts";
import { CaixaVazia, CarregandoPainel, ErroAoCarregar, PaginaDoPainel } from "./PartesDoPainel.tsx";

interface ValoresDesejo {
  clienteId: string;
  nome: string;
  anoMinimo: string;
  precoMaximo: string;
  observacoes: string;
}

const VALORES_INICIAIS: ValoresDesejo = {
  clienteId: "",
  nome: "",
  anoMinimo: "",
  precoMaximo: "",
  observacoes: "",
};

const SECAO = "rounded-[14px] border border-linha bg-painel p-4";

export function PaginaInteresses() {
  return (
    <PaginaDoPainel titulo="Interesses">
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <NovoDesejo />
        <ListaDeDesejos />
      </div>
    </PaginaDoPainel>
  );
}

function NovoDesejo() {
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const clientes = useQuery(consultaClientes(""));
  const [valores, setValores] = useState(VALORES_INICIAIS);
  const [erros, setErros] = useState<ErrosDoFormulario>({});

  const cadastrar = useMutation({
    mutationFn: (dados: DesejoValidado) => api.post<{ desejo: Desejo }>("/dashboard/wishes", dados),
    onSuccess: ({ desejo }) => {
      setValores(({ clienteId }) => ({ ...VALORES_INICIAIS, clienteId }));
      const combinam = desejo.possiveis.length;
      avisar(
        combinam > 0
          ? `Interesse cadastrado. ${plural(combinam, "veículo do catálogo combina", "veículos do catálogo combinam")}.`
          : "Interesse cadastrado.",
      );
    },
    onError: (erro) => {
      setErros(errosDaApi(erro));
      avisar(mensagemDeErro(erro), "erro");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHAVE_PAINEL }),
  });

  function campo(nome: keyof ValoresDesejo) {
    return {
      name: nome,
      value: valores[nome],
      erro: erros[nome],
      onChange: (evento: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setValores((atuais) => ({ ...atuais, [nome]: evento.target.value })),
    };
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const resultado = esquemaDesejo.safeParse({
      ...valores,
      anoMinimo: lerInteiro(valores.anoMinimo),
      precoMaximo: lerDinheiro(valores.precoMaximo),
    });
    if (!resultado.success) {
      setErros(errosPorCampo(errosDeCampo(resultado.error)));
      avisar("Confira os campos destacados.", "erro");
      return;
    }
    setErros({});
    cadastrar.mutate(resultado.data);
  }

  return (
    <form
      noValidate
      onSubmit={aoEnviar}
      aria-labelledby="titulo-novo-interesse"
      className={`${SECAO} flex flex-col gap-3`}
    >
      <h2 id="titulo-novo-interesse" className="text-base font-extrabold font-stretch-[112%]">
        Novo interesse
      </h2>
      {clientes.isError ? (
        <ErroAoCarregar erro={clientes.error} onTentar={() => void clientes.refetch()} />
      ) : clientes.data?.length === 0 ? (
        <p className="text-sm text-suave">
          Cadastre um cliente antes de registrar um interesse.{" "}
          <Link to="/dashboard/customers/new" className="font-semibold text-acento">
            Cadastrar cliente
          </Link>
        </p>
      ) : (
        <>
          <CampoSelecao rotulo="Cliente *" disabled={clientes.isPending} {...campo("clienteId")}>
            <option value="">{clientes.isPending ? "Carregando…" : "Escolha um cliente"}</option>
            {clientes.data?.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {`${cliente.nome} · ${formatarTelefone(cliente.telefone)}`}
              </option>
            ))}
          </CampoSelecao>
          <CampoTexto
            rotulo="Veículo procurado *"
            placeholder="Onix automático"
            autoComplete="off"
            maxLength={TAMANHO_MAXIMO_DESEJO}
            dica="Palavras que o veículo precisa ter, como “Onix automático” ou “SUV diesel”."
            {...campo("nome")}
          />
          <div className="grid grid-cols-2 gap-3">
            <CampoTexto
              rotulo="Ano mínimo"
              inputMode="numeric"
              placeholder="2019"
              {...campo("anoMinimo")}
            />
            <CampoTexto
              rotulo="Preço máximo (R$)"
              inputMode="decimal"
              placeholder="80.000"
              {...campo("precoMaximo")}
            />
          </div>
          <CampoAreaTexto rotulo="Observações" rows={2} maxLength={500} {...campo("observacoes")} />
          <button
            type="submit"
            disabled={cadastrar.isPending}
            className="botao botao-primario self-end"
          >
            <Icone nome="mais" />
            {cadastrar.isPending ? "Cadastrando…" : "Cadastrar interesse"}
          </button>
        </>
      )}
    </form>
  );
}

function ListaDeDesejos() {
  const consulta = useQuery(consultaDesejos);
  if (consulta.data) {
    return consulta.data.length === 0 ? (
      <CaixaVazia titulo="Nenhum interesse cadastrado">
        <p>
          Cadastre o que cada cliente procura. Quando um veículo compatível entrar no catálogo, o
          cliente sobe para o topo desta lista.
        </p>
      </CaixaVazia>
    ) : (
      <ul aria-label="Clientes com interesses" className="flex flex-col gap-3">
        {consulta.data.map((item) => (
          <CartaoDoCliente key={item.cliente.id} item={item} />
        ))}
      </ul>
    );
  }
  if (consulta.isError) {
    return <ErroAoCarregar erro={consulta.error} onTentar={() => void consulta.refetch()} />;
  }
  return <CarregandoPainel />;
}

function CartaoDoCliente({ item }: { item: ClienteComDesejos }) {
  const { cliente, possivelDesde, desejos } = item;
  return (
    <li
      className={`flex flex-col gap-3 rounded-[14px] border p-4 ${possivelDesde ? "border-alerta bg-[#fffaf0]" : "border-linha bg-painel"}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Link
          to={`/dashboard/customers/${cliente.id}`}
          className="min-w-0 font-bold wrap-break-word hover:text-acento"
        >
          {cliente.nome}
        </Link>
        {possivelDesde && (
          <span className="rounded-full bg-[#fdf1d6] px-[9px] py-[5px] text-[11px] leading-none font-bold tracking-[0.07em] text-[#8a5e00] uppercase">
            Possível interesse
          </span>
        )}
        <a
          href={linkWhatsApp(cliente.telefone)}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-sm text-whatsapp-forte"
        >
          <Icone nome="whatsapp" className="size-3.5" />
          {formatarTelefone(cliente.telefone)}
        </a>
      </div>
      <ul className="flex flex-col gap-2">
        {desejos.map((desejo) => (
          <ItemDoDesejo key={desejo.id} cliente={cliente} desejo={desejo} />
        ))}
      </ul>
    </li>
  );
}

function ItemDoDesejo({
  cliente,
  desejo,
}: {
  cliente: ClienteComDesejos["cliente"];
  desejo: Desejo;
}) {
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const [atendendo, setAtendendo] = useState(false);

  const excluir = useMutation({
    mutationFn: () => api.delete(`/dashboard/wishes/${desejo.id}`),
    onSuccess: () => avisar("Interesse excluído."),
    onError: (erro) => avisar(mensagemDeErro(erro), "erro"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHAVE_PAINEL }),
  });

  const atender = useMutation({
    mutationFn: (carroId: string) =>
      api.post<{ interesse: Interesse }>(`/dashboard/wishes/${desejo.id}/attend`, { carroId }),
    onSuccess: ({ interesse }) =>
      avisar(
        `Interesse atendido. ${cliente.nome} está em “${ROTULOS_ETAPA_FUNIL[interesse.etapa]}” no funil.`,
      ),
    onError: (erro) => avisar(mensagemDeErro(erro), "erro"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHAVE_PAINEL }),
  });

  const descartar = useMutation({
    mutationFn: (veiculo: VeiculoPossivel) =>
      api.post(`/dashboard/wishes/${desejo.id}/dismiss`, { carroId: veiculo.id }),
    onSuccess: (_, veiculo) =>
      avisar(`O interesse continua registrado, sem o veículo ${nomeDoVeiculo(veiculo)}.`),
    onError: (erro) => avisar(mensagemDeErro(erro), "erro"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHAVE_PAINEL }),
  });

  const ocupado = excluir.isPending || atender.isPending || descartar.isPending;

  const criterios = [
    desejo.anoMinimo !== null && `A partir de ${desejo.anoMinimo}`,
    desejo.precoMaximo !== null && `Até ${formatarDinheiro(desejo.precoMaximo)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-linha bg-papel p-3">
      <div className="min-w-0">
        <p className="font-semibold wrap-break-word">{desejo.nome}</p>
        {criterios && <p className="text-xs text-suave">{criterios}</p>}
        {desejo.observacoes && (
          <p className="text-xs wrap-break-word text-suave">{desejo.observacoes}</p>
        )}
      </div>
      {desejo.possiveis.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold text-[#8a5e00]">Combina com:</p>
          <ul className="flex flex-col gap-1.5">
            {desejo.possiveis.map((veiculo) => (
              <li key={veiculo.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  to={`/dashboard/cars/${veiculo.id}`}
                  className="min-w-0 wrap-break-word hover:text-acento"
                >
                  {`${nomeDoVeiculo(veiculo)} · ${formatarPreco(veiculo.precoVenda)}`}
                </Link>
                <div
                  role="group"
                  aria-label={`${nomeDoVeiculo(veiculo)} atende ao interesse?`}
                  className="ml-auto flex items-center gap-1.5"
                >
                  <span className="text-xs font-semibold text-suave">Atende ao interesse?</span>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => atender.mutate(veiculo.id)}
                    className="botao botao-pequeno"
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => descartar.mutate(veiculo)}
                    className="botao botao-pequeno"
                  >
                    Não
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {atendendo ? (
        <FormularioAtender
          desejo={desejo}
          atender={atender}
          onCancelar={() => setAtendendo(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <BotaoConfirmar
            pergunta="Excluir este interesse?"
            onConfirmar={() => excluir.mutate()}
            desabilitado={ocupado}
            rotulo="Excluir interesse"
            className="botao botao-pequeno botao-fantasma text-perigo"
          >
            <Icone nome="lixeira" />
          </BotaoConfirmar>
          <button
            type="button"
            onClick={() => setAtendendo(true)}
            className="botao botao-pequeno botao-primario"
          >
            <Icone nome="marcado" />
            Atender
          </button>
        </div>
      )}
    </li>
  );
}

function FormularioAtender({
  desejo,
  atender,
  onCancelar,
}: {
  desejo: Desejo;
  atender: UseMutationResult<{ interesse: Interesse }, Error, string>;
  onCancelar: () => void;
}) {
  const carros = useQuery(consultaCarrosPainel);
  const [carroId, setCarroId] = useState(desejo.possiveis[0]?.id ?? "");

  const possiveis = new Set(desejo.possiveis.map(({ id }) => id));
  const disponiveis = (carros.data ?? []).filter((carro) => carro.status !== "vendido");
  const combinam = disponiveis.filter((carro) => possiveis.has(carro.id));
  const outros = disponiveis.filter((carro) => !possiveis.has(carro.id));

  function opcao(carro: CarroPainel) {
    return (
      <option key={carro.id} value={carro.id}>
        {[nomeDoVeiculo(carro), ROTULOS_STATUS_CARRO[carro.status]].join(" · ")}
      </option>
    );
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (carroId) atender.mutate(carroId);
  }

  return (
    <form
      aria-label={`Atender ${desejo.nome}`}
      onSubmit={aoEnviar}
      className="flex flex-col gap-2 border-t border-linha pt-3"
    >
      <CampoSelecao
        rotulo="Veículo"
        value={carroId}
        disabled={carros.isPending}
        onChange={(evento) => setCarroId(evento.target.value)}
      >
        <option value="">{carros.isPending ? "Carregando…" : "Escolha um veículo"}</option>
        {combinam.length > 0 ? (
          <>
            <optgroup label="Combinam com o interesse">{combinam.map(opcao)}</optgroup>
            {outros.length > 0 && <optgroup label="Outros veículos">{outros.map(opcao)}</optgroup>}
          </>
        ) : (
          outros.map(opcao)
        )}
      </CampoSelecao>
      <p className="text-xs text-suave">
        O cliente entra no funil deste veículo em “{ROTULOS_ETAPA_FUNIL.em_contato}”, se ainda não
        estiver mais adiante.
      </p>
      <div className="flex flex-wrap justify-end gap-1.5">
        <button type="button" onClick={onCancelar} className="botao botao-pequeno">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!carroId || atender.isPending}
          className="botao botao-pequeno botao-primario"
        >
          {atender.isPending ? "Confirmando…" : "Confirmar"}
        </button>
      </div>
    </form>
  );
}
