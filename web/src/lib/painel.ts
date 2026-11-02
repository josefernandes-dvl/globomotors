import type { CarroPainel, Cliente, Interesse, Loja } from "@globomotors/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api.ts";

export const CHAVE_PAINEL = ["painel"] as const;

export interface FiltroInteresses {
  carroId?: string;
  clienteId?: string;
}

export const consultaCarrosPainel = queryOptions({
  queryKey: ["painel", "carros"],
  queryFn: async () => (await api.get<{ carros: CarroPainel[] }>("/dashboard/cars")).carros,
});

export function consultaCarroPainel(id: string) {
  return queryOptions({
    queryKey: ["painel", "carro", id],
    queryFn: async () => (await api.get<{ carro: CarroPainel }>(`/dashboard/cars/${id}`)).carro,
  });
}

export function consultaClientes(busca: string) {
  const termo = busca.trim();
  const query = termo ? `?${new URLSearchParams({ search: termo }).toString()}` : "";
  return queryOptions({
    queryKey: ["painel", "clientes", termo],
    queryFn: async () =>
      (await api.get<{ clientes: Cliente[] }>(`/dashboard/customers${query}`)).clientes,
  });
}

export function consultaCliente(id: string) {
  return queryOptions({
    queryKey: ["painel", "cliente", id],
    queryFn: async () =>
      (await api.get<{ cliente: Cliente }>(`/dashboard/customers/${id}`)).cliente,
  });
}

export function consultaInteresses(filtro: FiltroInteresses = {}) {
  const parametros = new URLSearchParams();
  if (filtro.carroId) parametros.set("carId", filtro.carroId);
  if (filtro.clienteId) parametros.set("customerId", filtro.clienteId);
  const query = parametros.size > 0 ? `?${parametros.toString()}` : "";
  return queryOptions({
    queryKey: ["painel", "interesses", filtro],
    queryFn: async () =>
      (await api.get<{ interesses: Interesse[] }>(`/dashboard/interests${query}`)).interesses,
  });
}

export const consultaLojaPainel = queryOptions({
  queryKey: ["painel", "loja"],
  queryFn: async () => (await api.get<{ loja: Loja }>("/dashboard/store")).loja,
});
