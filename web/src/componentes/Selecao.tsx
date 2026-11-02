import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icone } from "./Icone.tsx";

const TEMAS = {
  claro: {
    gatilho:
      "border-linha bg-papel text-tinta hover:border-[#b9c4d2] focus-visible:border-acento aria-expanded:border-acento",
    lista: "border-linha bg-papel text-tinta shadow-[0_18px_40px_-14px_rgb(15_26_43/0.35)]",
    ativa: "bg-painel",
    marca: "text-acento",
  },
  escuro: {
    gatilho:
      "border-[#22314b] bg-noite-campo text-noite-texto hover:border-[#33476a] focus-visible:border-acento aria-expanded:border-acento",
    lista:
      "border-noite-borda bg-noite-cartao text-noite-texto shadow-[0_18px_40px_-12px_rgb(0_0_0/0.7)]",
    ativa: "bg-white/8",
    marca: "text-acento-claro",
  },
} as const;

interface Opcao<T extends string> {
  valor: T;
  rotulo: string;
}

interface Props<T extends string> {
  rotulo: string;
  valor: T;
  opcoes: readonly Opcao<T>[];
  aoMudar: (valor: T) => void;
  tema?: keyof typeof TEMAS;
  alinhar?: "esquerda" | "direita";
  desabilitado?: boolean;
  className?: string;
}

export function Selecao<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
  tema = "claro",
  alinhar = "esquerda",
  desabilitado = false,
  className = "",
}: Props<T>) {
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(0);
  const atual = Math.max(
    0,
    opcoes.findIndex((opcao) => opcao.valor === valor),
  );
  const cores = TEMAS[tema];

  useEffect(() => {
    if (!aberta) return;
    function aoTocarFora(evento: PointerEvent) {
      if (evento.target instanceof Node && !raiz.current?.contains(evento.target)) {
        setAberta(false);
      }
    }
    document.addEventListener("pointerdown", aoTocarFora);
    return () => document.removeEventListener("pointerdown", aoTocarFora);
  }, [aberta]);

  useEffect(() => {
    if (aberta) document.getElementById(`${id}-${ativa}`)?.scrollIntoView({ block: "nearest" });
  }, [aberta, ativa, id]);

  function abrir(indice: number) {
    setAtiva(indice);
    setAberta(true);
  }

  function escolher(indice: number) {
    setAberta(false);
    const opcao = opcoes[indice];
    if (opcao && opcao.valor !== valor) aoMudar(opcao.valor);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (desabilitado) return;
    const ultima = opcoes.length - 1;
    const destinos: Partial<Record<string, number>> = aberta
      ? {
          ArrowDown: Math.min(ativa + 1, ultima),
          ArrowUp: Math.max(ativa - 1, 0),
          Home: 0,
          End: ultima,
        }
      : { ArrowDown: atual, ArrowUp: atual, Enter: atual, " ": atual, Home: 0, End: ultima };
    const destino = destinos[evento.key];
    if (aberta && (evento.key === "Enter" || evento.key === " ")) {
      evento.preventDefault();
      escolher(ativa);
    } else if (aberta && evento.key === "Escape") {
      evento.preventDefault();
      setAberta(false);
    } else if (destino !== undefined) {
      evento.preventDefault();
      abrir(destino);
    }
  }

  return (
    <div ref={raiz} className={`relative ${className}`}>
      <div
        role="combobox"
        tabIndex={desabilitado ? -1 : 0}
        aria-label={rotulo}
        aria-haspopup="listbox"
        aria-expanded={aberta}
        aria-controls={`${id}-lista`}
        aria-activedescendant={aberta ? `${id}-${ativa}` : undefined}
        aria-disabled={desabilitado || undefined}
        onClick={() => {
          if (desabilitado) return;
          if (aberta) setAberta(false);
          else abrir(atual);
        }}
        onKeyDown={aoTeclar}
        onBlur={() => setAberta(false)}
        className={`flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-sm font-semibold transition outline-none select-none focus-visible:ring-2 focus-visible:ring-acento/25 aria-disabled:cursor-not-allowed aria-disabled:opacity-55 ${cores.gatilho}`}
      >
        <span className="truncate">{opcoes[atual]?.rotulo}</span>
        <Icone
          nome="abrir"
          className={`size-4 flex-none opacity-70 transition-transform ${aberta ? "rotate-180" : ""}`}
        />
      </div>
      <ul
        id={`${id}-lista`}
        role="listbox"
        aria-label={rotulo}
        hidden={!aberta}
        onMouseDown={(evento) => evento.preventDefault()}
        className={`absolute top-full z-30 mt-1.5 max-h-72 w-max max-w-[calc(100vw-2rem)] min-w-full overflow-auto rounded-xl border p-1 transition duration-150 starting:scale-95 starting:opacity-0 ${
          alinhar === "direita" ? "right-0 origin-top-right" : "left-0 origin-top-left"
        } ${cores.lista}`}
      >
        {opcoes.map((opcao, indice) => {
          const marcada = indice === atual;
          return (
            <li
              key={opcao.valor}
              id={`${id}-${indice}`}
              role="option"
              aria-selected={marcada}
              onClick={() => escolher(indice)}
              onPointerMove={() => setAtiva(indice)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg py-2 pr-3 pl-2 text-sm whitespace-nowrap ${
                indice === ativa ? cores.ativa : ""
              } ${marcada ? "font-semibold" : ""}`}
            >
              <Icone
                nome="marcado"
                className={`size-4 flex-none ${marcada ? cores.marca : "invisible"}`}
              />
              {opcao.rotulo}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
