import {
  errosDeCampo,
  esquemaEtapaInteresse,
  ETAPAS_FUNIL,
  ROTULOS_ETAPA_FUNIL,
  type EtapaFunil,
  type Interesse,
} from "@globomotors/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Selecao } from "../../componentes/Selecao.tsx";
import { api } from "../../lib/api.ts";
import { useAvisos } from "../../lib/avisos.ts";
import { tituloDoCarro } from "../../lib/formatacao.ts";
import { mensagemDeErro } from "../../lib/formularios.ts";
import { CHAVE_PAINEL } from "../../lib/painel.ts";

const OPCOES_DE_ETAPA = ETAPAS_FUNIL.map((valor) => ({
  valor,
  rotulo: ROTULOS_ETAPA_FUNIL[valor],
}));

export function SeletorDeEtapa({
  interesse,
  className = "",
}: {
  interesse: Interesse;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const [perdendo, setPerdendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const mudar = useMutation({
    mutationFn: (dados: { etapa: EtapaFunil; motivoPerda: string | null }) =>
      api.patch<{ interesse: Interesse }>(`/dashboard/interests/${interesse.id}`, dados),
    onSuccess: ({ interesse: atualizado }) => {
      setPerdendo(false);
      setMotivo("");
      avisar(`Etapa alterada para ${ROTULOS_ETAPA_FUNIL[atualizado.etapa]}.`);
    },
    onError: (falha) => avisar(mensagemDeErro(falha), "erro"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHAVE_PAINEL }),
  });

  function confirmarPerda(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const resultado = esquemaEtapaInteresse.safeParse({ etapa: "perdido", motivoPerda: motivo });
    if (!resultado.success) {
      setErro(errosDeCampo(resultado.error)[0]?.mensagem ?? null);
      return;
    }
    setErro(null);
    mudar.mutate(resultado.data);
  }

  if (perdendo) {
    return (
      <form
        noValidate
        onSubmit={confirmarPerda}
        className={`flex w-full flex-col gap-1.5 ${className}`}
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-suave">Motivo da perda</span>
          <input
            autoFocus
            value={motivo}
            maxLength={200}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Ex.: comprou em outra loja"
            aria-invalid={erro ? true : undefined}
            className="entrada min-h-0 py-1.5 text-[13px]"
          />
        </label>
        {erro && <span className="text-xs font-medium text-perigo">{erro}</span>}
        <div className="flex gap-1.5">
          <button type="submit" disabled={mudar.isPending} className="botao botao-pequeno">
            Marcar como perdido
          </button>
          <button
            type="button"
            onClick={() => {
              setPerdendo(false);
              setErro(null);
            }}
            className="botao botao-pequeno botao-fantasma"
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <Selecao
      rotulo={`Etapa de ${interesse.cliente.nome}, ${tituloDoCarro(interesse.carro)}`}
      valor={interesse.etapa}
      opcoes={OPCOES_DE_ETAPA}
      aoMudar={(etapa) => {
        if (etapa === "perdido") setPerdendo(true);
        else mudar.mutate({ etapa, motivoPerda: null });
      }}
      desabilitado={mudar.isPending}
      className={className}
    />
  );
}
