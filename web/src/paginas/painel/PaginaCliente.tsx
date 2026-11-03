import {
  errosDeCampo,
  esquemaCliente,
  ORIGENS_CLIENTE,
  ROTULOS_ORIGEM_CLIENTE,
  type Cliente,
  type ClienteValidado,
} from "@globomotors/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { BotaoConfirmar } from "../../componentes/BotaoConfirmar.tsx";
import { CampoAreaTexto, CampoSelecao, CampoTexto } from "../../componentes/Campo.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { api, ErroApi } from "../../lib/api.ts";
import { useAvisos } from "../../lib/avisos.ts";
import { formatarData, formatarTelefone } from "../../lib/formatacao.ts";
import {
  errosDaApi,
  errosPorCampo,
  mensagemDeErro,
  type ErrosDoFormulario,
} from "../../lib/formularios.ts";
import { CHAVE_PAINEL, consultaCliente } from "../../lib/painel.ts";
import { ListaDeInteresses } from "./ListaDeInteresses.tsx";
import { CaixaVazia, CarregandoPainel, ErroAoCarregar, PaginaDoPainel } from "./PartesDoPainel.tsx";

interface ValoresCliente {
  nome: string;
  telefone: string;
  email: string;
  origem: string;
  observacoes: string;
}

const SECAO = "rounded-[14px] border border-linha bg-painel p-4";

function valoresDoCliente(cliente?: Cliente): ValoresCliente {
  return {
    nome: cliente?.nome ?? "",
    telefone: cliente ? formatarTelefone(cliente.telefone) : "",
    email: cliente?.email ?? "",
    origem: cliente?.origem ?? "",
    observacoes: cliente?.observacoes ?? "",
  };
}

export function PaginaCliente() {
  const { id } = useParams();
  return id ? <EdicaoDoCliente key={id} id={id} /> : <FormularioCliente />;
}

function EdicaoDoCliente({ id }: { id: string }) {
  const [excluido, setExcluido] = useState(false);
  const consulta = useQuery({ ...consultaCliente(id), enabled: !excluido });
  const naoExiste = consulta.error instanceof ErroApi && consulta.error.status === 404;
  if (consulta.data && !naoExiste)
    return <FormularioCliente cliente={consulta.data} onExcluido={() => setExcluido(true)} />;
  if (consulta.isError) {
    return (
      <PaginaDoPainel titulo="Cliente">
        {naoExiste ? (
          <CaixaVazia titulo="Cliente não encontrado">
            <p>Ele pode ter sido excluído.</p>
            <Link to="/dashboard/customers" className="botao mt-4">
              Voltar aos clientes
            </Link>
          </CaixaVazia>
        ) : (
          <ErroAoCarregar erro={consulta.error} onTentar={() => void consulta.refetch()} />
        )}
      </PaginaDoPainel>
    );
  }
  return (
    <PaginaDoPainel titulo="Cliente">
      <CarregandoPainel />
    </PaginaDoPainel>
  );
}

function FormularioCliente({
  cliente,
  onExcluido,
}: {
  cliente?: Cliente;
  onExcluido?: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const [valores, setValores] = useState(() => valoresDoCliente(cliente));
  const [erros, setErros] = useState<ErrosDoFormulario>({});

  const salvar = useMutation({
    mutationFn: (dados: ClienteValidado) =>
      cliente
        ? api.put<{ cliente: Cliente }>(`/dashboard/customers/${cliente.id}`, dados)
        : api.post<{ cliente: Cliente }>("/dashboard/customers", dados),
    onSuccess: ({ cliente: salvo }) => {
      queryClient.setQueryData(consultaCliente(salvo.id).queryKey, salvo);
      void queryClient.invalidateQueries({ queryKey: CHAVE_PAINEL });
      if (cliente) {
        setValores(valoresDoCliente(salvo));
        avisar("Alterações salvas.");
        return;
      }
      avisar("Cliente cadastrado.");
      void navigate(`/dashboard/customers/${salvo.id}`, { replace: true });
    },
    onError: (erro) => {
      setErros(errosDaApi(erro));
      avisar(mensagemDeErro(erro), "erro");
    },
  });

  const excluir = useMutation({
    mutationFn: (id: string) => api.delete(`/dashboard/customers/${id}`),
    onSuccess: async (_resposta, id) => {
      onExcluido?.();
      avisar("Cliente excluído.");
      await navigate("/dashboard/customers");
      queryClient.removeQueries({ queryKey: consultaCliente(id).queryKey });
      await queryClient.invalidateQueries({ queryKey: CHAVE_PAINEL, refetchType: "none" });
    },
    onError: (erro) => avisar(mensagemDeErro(erro), "erro"),
  });

  function campo(nome: keyof ValoresCliente) {
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
    const resultado = esquemaCliente.safeParse(valores);
    if (!resultado.success) {
      setErros(errosPorCampo(errosDeCampo(resultado.error)));
      avisar("Confira os campos destacados.", "erro");
      return;
    }
    setErros({});
    salvar.mutate(resultado.data);
  }

  return (
    <PaginaDoPainel
      titulo={cliente ? cliente.nome : "Novo cliente"}
      acoes={
        cliente && (
          <BotaoConfirmar
            pergunta="Excluir este cliente?"
            onConfirmar={() => excluir.mutate(cliente.id)}
            desabilitado={excluir.isPending}
            className="botao text-perigo"
          >
            <Icone nome="lixeira" />
            Excluir cliente
          </BotaoConfirmar>
        )
      }
    >
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <form noValidate onSubmit={aoEnviar} className={`${SECAO} flex flex-col gap-4`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto
              rotulo="Nome *"
              autoComplete="off"
              maxLength={100}
              className="sm:col-span-2"
              {...campo("nome")}
            />
            <CampoTexto
              rotulo="Telefone (WhatsApp) *"
              type="tel"
              inputMode="tel"
              placeholder="(11) 98765-4321"
              {...campo("telefone")}
            />
            <CampoTexto rotulo="E-mail" type="email" maxLength={120} {...campo("email")} />
            <CampoSelecao rotulo="Como conheceu a loja" {...campo("origem")}>
              <option value="">Selecione</option>
              {ORIGENS_CLIENTE.map((origem) => (
                <option key={origem} value={origem}>
                  {ROTULOS_ORIGEM_CLIENTE[origem]}
                </option>
              ))}
            </CampoSelecao>
            <CampoAreaTexto
              rotulo="Observações"
              rows={4}
              maxLength={2000}
              dica="O que o cliente procura, faixa de preço, se tem carro na troca…"
              className="sm:col-span-2"
              {...campo("observacoes")}
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {cliente && (
              <span className="mr-auto text-xs text-suave">
                Cadastrado em {formatarData(cliente.criadoEm)}
              </span>
            )}
            <Link to="/dashboard/customers" className="botao">
              Cancelar
            </Link>
            <button type="submit" disabled={salvar.isPending} className="botao botao-primario">
              {salvar.isPending ? "Salvando…" : cliente ? "Salvar alterações" : "Cadastrar cliente"}
            </button>
          </div>
        </form>

        <aside className={SECAO}>
          {cliente ? (
            <ListaDeInteresses clienteId={cliente.id} />
          ) : (
            <p className="text-sm text-suave">
              Depois de cadastrar o cliente, você pode registrar os carros de interesse dele.
            </p>
          )}
        </aside>
      </div>
    </PaginaDoPainel>
  );
}
