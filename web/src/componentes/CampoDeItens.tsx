import { errosDeCampo, type EsquemaListaDeTextos } from "@globomotors/shared";
import { useId, useRef, useState } from "react";
import { Icone } from "./Icone.tsx";

export const ETIQUETA =
  "flex max-w-full items-center gap-1 rounded-2xl border border-linha bg-papel py-1 pr-1 pl-3 text-[13px] font-semibold";
export const BOTAO_TIRAR =
  "grid size-6 flex-none cursor-pointer place-items-center rounded-full text-suave transition hover:bg-black/5 hover:text-perigo";

interface PropsCampoDeItens {
  rotulo: string;
  rotuloNovo: string;
  placeholder: string;
  esquema: EsquemaListaDeTextos;
  itens: string[];
  erro: string | undefined;
  onMudar: (itens: string[]) => void;
  dica?: string;
  className?: string;
}

export function CampoDeItens({
  rotulo,
  rotuloNovo,
  placeholder,
  esquema,
  itens,
  erro,
  onMudar,
  dica,
  className,
}: PropsCampoDeItens) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [novo, setNovo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const mensagem = aviso ?? erro;
  const descricao = mensagem ? `${id}-erro` : dica ? `${id}-dica` : undefined;

  function adicionar() {
    entrada.current?.focus();
    const resultado = esquema.safeParse([...itens, novo]);
    if (!resultado.success) {
      setAviso(errosDeCampo(resultado.error)[0]?.mensagem ?? null);
      return;
    }
    if (resultado.data.length === itens.length) {
      setAviso(`“${novo.trim()}” já está na lista.`);
      return;
    }
    onMudar(resultado.data);
    setNovo("");
    setAviso(null);
  }

  function remover(item: string) {
    onMudar(itens.filter((atual) => atual !== item));
    setAviso(null);
  }

  return (
    <fieldset className={className}>
      <legend className="rotulo float-left mb-1.5 w-full">{rotulo}</legend>
      <div className="clear-left flex flex-col gap-2">
        {itens.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {itens.map((item) => (
              <li key={item} className={ETIQUETA}>
                <span className="min-w-0 wrap-break-word">{item}</span>
                <button
                  type="button"
                  aria-label={`Remover ${item}`}
                  onClick={() => remover(item)}
                  className={BOTAO_TIRAR}
                >
                  <Icone nome="fechar" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            ref={entrada}
            aria-label={rotuloNovo}
            placeholder={placeholder}
            enterKeyHint="enter"
            value={novo}
            onChange={(evento) => {
              setNovo(evento.target.value);
              setAviso(null);
            }}
            onKeyDown={(evento) => {
              if (evento.key !== "Enter") return;
              evento.preventDefault();
              if (novo.trim()) adicionar();
            }}
            aria-invalid={mensagem ? true : undefined}
            aria-describedby={descricao}
            className="entrada min-w-0 flex-1"
          />
          <button
            type="button"
            disabled={!novo.trim()}
            onClick={adicionar}
            className="botao flex-none"
          >
            <Icone nome="mais" />
            Adicionar
          </button>
        </div>
        {mensagem ? (
          <span id={`${id}-erro`} className="text-xs font-medium text-perigo">
            {mensagem}
          </span>
        ) : (
          dica && (
            <span id={`${id}-dica`} className="text-xs text-suave">
              {dica}
            </span>
          )
        )}
      </div>
    </fieldset>
  );
}
