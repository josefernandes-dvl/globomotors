const TRACOS = {
  mais: "M12 5v14M5 12h14",
  busca: "M20 20l-3.5-3.5M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z",
  baixar: "M12 3v12M7 10l5 5 5-5M5 21h14",
  copiar: "M9 9h11v11H9zM5 15H4V4h11v1",
  editar: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4",
  lixeira: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  fechar: "M6 6l12 12M18 6L6 18",
  esquerda: "M15 6l-6 6 6 6",
  direita: "M9 6l6 6-6 6",
  externo: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  sair: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  estrela: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z",
  foto: "M4 8h3l2-3h6l2 3h3v12H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  abrir: "M6 9l6 6 6-6",
  marcado: "M5 12l5 5L20 7",
  filtros: "M4 6h16M7 12h10M10 18h4",
} as const;

const WHATSAPP =
  "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z";

export type NomeDoIcone = keyof typeof TRACOS | "whatsapp";

export function Icone({ nome, className = "size-4" }: { nome: NomeDoIcone; className?: string }) {
  if (nome === "whatsapp") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={WHATSAPP} />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TRACOS[nome]} />
    </svg>
  );
}
