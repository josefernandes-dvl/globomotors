import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

interface Base {
  rotulo: string;
  erro?: string | undefined;
  dica?: ReactNode;
  className?: string;
}

function useIdsDoCampo(erro: string | undefined, dica: ReactNode) {
  const id = useId();
  const descricao = erro ? `${id}-erro` : dica ? `${id}-dica` : undefined;
  return { id, descricao, invalido: erro ? true : undefined };
}

function MensagemDoCampo({ id, erro, dica }: { id: string; erro?: string; dica?: ReactNode }) {
  if (erro) {
    return (
      <span id={`${id}-erro`} className="text-xs font-medium text-perigo">
        {erro}
      </span>
    );
  }
  if (!dica) return null;
  return (
    <span id={`${id}-dica`} className="text-xs text-suave">
      {dica}
    </span>
  );
}

export function CampoTexto({
  rotulo,
  erro,
  dica,
  className = "",
  ...props
}: Base & Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  const { id, descricao, invalido } = useIdsDoCampo(erro, dica);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="rotulo">
        {rotulo}
      </label>
      <input
        id={id}
        className="entrada"
        aria-invalid={invalido}
        aria-describedby={descricao}
        {...props}
      />
      <MensagemDoCampo id={id} erro={erro} dica={dica} />
    </div>
  );
}

export function CampoAreaTexto({
  rotulo,
  erro,
  dica,
  className = "",
  ...props
}: Base & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">) {
  const { id, descricao, invalido } = useIdsDoCampo(erro, dica);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="rotulo">
        {rotulo}
      </label>
      <textarea
        id={id}
        rows={4}
        className="entrada resize-y"
        aria-invalid={invalido}
        aria-describedby={descricao}
        {...props}
      />
      <MensagemDoCampo id={id} erro={erro} dica={dica} />
    </div>
  );
}

export function CampoSelecao({
  rotulo,
  erro,
  dica,
  className = "",
  children,
  ...props
}: Base & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className">) {
  const { id, descricao, invalido } = useIdsDoCampo(erro, dica);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="rotulo">
        {rotulo}
      </label>
      <select
        id={id}
        className="entrada"
        aria-invalid={invalido}
        aria-describedby={descricao}
        {...props}
      >
        {children}
      </select>
      <MensagemDoCampo id={id} erro={erro} dica={dica} />
    </div>
  );
}

export function CampoMarcar({
  rotulo,
  className = "",
  ...props
}: { rotulo: string; className?: string } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "type"
>) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 text-sm font-medium ${className}`}
    >
      <input type="checkbox" className="size-4 accent-acento" {...props} />
      {rotulo}
    </label>
  );
}
