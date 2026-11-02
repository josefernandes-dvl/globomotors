import { useCallback, useRef, useState, type ReactNode } from "react";
import { ContextoAvisos, type TipoDeAviso } from "../lib/avisos.ts";

interface Aviso {
  id: number;
  mensagem: string;
  tipo: TipoDeAviso;
}

export function ProvedorDeAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const ultimoId = useRef(0);

  const avisar = useCallback((mensagem: string, tipo: TipoDeAviso = "sucesso") => {
    ultimoId.current += 1;
    const id = ultimoId.current;
    setAvisos((atuais) => [...atuais, { id, mensagem, tipo }]);
    setTimeout(
      () => setAvisos((atuais) => atuais.filter((aviso) => aviso.id !== id)),
      tipo === "erro" ? 5200 : 3000,
    );
  }, []);

  return (
    <ContextoAvisos value={avisar}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4"
      >
        {avisos.map((aviso) => (
          <p
            key={aviso.id}
            role={aviso.tipo === "erro" ? "alert" : "status"}
            className={`max-w-md rounded-[10px] px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
              aviso.tipo === "erro" ? "bg-[#9e2215]" : "bg-tinta"
            }`}
          >
            {aviso.mensagem}
          </p>
        ))}
      </div>
    </ContextoAvisos>
  );
}
