import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

const TEMAS = {
  claro: {
    lista: "shadow-[inset_0_-1px_0_var(--color-linha)]",
    aba: "text-suave hover:text-tinta aria-selected:border-acento aria-selected:text-tinta",
  },
  escuro: {
    lista: "shadow-[inset_0_-1px_0_var(--color-noite-linha)]",
    aba: "text-noite-prata hover:text-white aria-selected:border-acento-claro aria-selected:text-white",
  },
} as const;

interface Aba<T> {
  valor: T;
  rotulo: string;
}

interface Props<T> {
  rotulo: string;
  abas: readonly Aba<T>[];
  valor: T;
  aoMudar: (valor: T) => void;
  tema?: keyof typeof TEMAS;
  className?: string;
  children: ReactNode;
}

export function Abas<T>({
  rotulo,
  abas,
  valor,
  aoMudar,
  tema = "claro",
  className = "",
  children,
}: Props<T>) {
  const id = useId();
  const lista = useRef<HTMLDivElement>(null);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const atual = Math.max(
    0,
    abas.findIndex((aba) => aba.valor === valor),
  );
  const comAbas = abas.length > 1;
  const cores = TEMAS[tema];

  useEffect(() => {
    const caixa = lista.current;
    const botao = botoes.current[atual];
    if (!caixa || !botao) return;
    const margem = parseFloat(getComputedStyle(caixa).paddingLeft) || 0;
    const fora = caixa.getBoundingClientRect();
    const dentro = botao.getBoundingClientRect();
    caixa.scrollLeft +=
      Math.max(0, dentro.right + margem - fora.right) -
      Math.max(0, fora.left + margem - dentro.left);
  }, [atual]);

  function escolher(indice: number) {
    const aba = abas[indice];
    if (aba && aba.valor !== valor) aoMudar(aba.valor);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    const ultima = abas.length - 1;
    const destinos: Partial<Record<string, number>> = {
      ArrowLeft: atual === 0 ? ultima : atual - 1,
      ArrowRight: atual === ultima ? 0 : atual + 1,
      Home: 0,
      End: ultima,
    };
    const destino = destinos[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    escolher(destino);
    botoes.current[destino]?.focus();
  }

  return (
    <>
      {comAbas && (
        <div
          ref={lista}
          role="tablist"
          aria-label={rotulo}
          onKeyDown={aoTeclar}
          className={`flex [scrollbar-width:none] overflow-x-auto ${cores.lista} ${className}`}
        >
          {abas.map((aba, indice) => (
            <button
              key={aba.rotulo}
              ref={(botao) => {
                botoes.current[indice] = botao;
              }}
              type="button"
              role="tab"
              id={`${id}-${indice}`}
              aria-selected={indice === atual}
              aria-controls={`${id}-painel`}
              tabIndex={indice === atual ? 0 : -1}
              onClick={() => escolher(indice)}
              className={`flex-none cursor-pointer border-b-2 border-transparent px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition focus-visible:-outline-offset-4 ${cores.aba}`}
            >
              {aba.rotulo}
            </button>
          ))}
        </div>
      )}
      <div
        role={comAbas ? "tabpanel" : undefined}
        id={comAbas ? `${id}-painel` : undefined}
        aria-labelledby={comAbas ? `${id}-${atual}` : undefined}
      >
        {children}
      </div>
    </>
  );
}
