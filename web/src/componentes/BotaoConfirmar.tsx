import { useState, type ReactNode } from "react";

interface Props {
  pergunta: string;
  onConfirmar: () => void;
  desabilitado?: boolean;
  className?: string;
  rotulo?: string;
  children: ReactNode;
}

export function BotaoConfirmar({
  pergunta,
  onConfirmar,
  desabilitado = false,
  className = "botao",
  rotulo,
  children,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        className={className}
        disabled={desabilitado}
        aria-label={rotulo}
        title={rotulo}
        onClick={() => setConfirmando(true)}
      >
        {children}
      </button>
    );
  }

  return (
    <span
      role="group"
      aria-label={pergunta}
      className="inline-flex flex-wrap items-center gap-1.5 text-[13px]"
    >
      <span className="font-semibold text-perigo">{pergunta}</span>
      <button
        type="button"
        className="botao botao-pequeno border-perigo text-perigo"
        disabled={desabilitado}
        onClick={() => {
          setConfirmando(false);
          onConfirmar();
        }}
      >
        Sim
      </button>
      <button type="button" className="botao botao-pequeno" onClick={() => setConfirmando(false)}>
        Não
      </button>
    </span>
  );
}
