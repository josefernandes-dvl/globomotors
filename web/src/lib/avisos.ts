import { createContext, useContext } from "react";

export type TipoDeAviso = "sucesso" | "erro";

export type Avisar = (mensagem: string, tipo?: TipoDeAviso) => void;

export const ContextoAvisos = createContext<Avisar>(() => undefined);

export function useAvisos() {
  return useContext(ContextoAvisos);
}
