import { useEffect, useState } from "react";
import { useLocation } from "react-router";

function ler<T>(chave: string, inicial: T): T {
  try {
    const salvo = sessionStorage.getItem(chave);
    return salvo === null ? inicial : (JSON.parse(salvo) as T);
  } catch {
    return inicial;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    sessionStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export function useEstadoDaPagina<T>(nome: string, inicial: T) {
  const { key } = useLocation();
  const chave = `globomotors:${nome}:${key}`;
  const [valor, setValor] = useState(() => ler(chave, inicial));

  useEffect(() => {
    gravar(chave, valor);
  }, [chave, valor]);

  return [valor, setValor] as const;
}
