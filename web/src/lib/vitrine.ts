import type { CarroPublico, LojaPublica } from "@globomotors/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api.ts";

export const consultaLojaPublica = queryOptions({
  queryKey: ["vitrine", "loja"],
  queryFn: async () => (await api.get<{ loja: LojaPublica }>("/showroom/store")).loja,
});

export const consultaCarrosPublicos = queryOptions({
  queryKey: ["vitrine", "carros"],
  queryFn: async () => (await api.get<{ carros: CarroPublico[] }>("/showroom/cars")).carros,
});

export function consultaCarroPublico(slug: string) {
  return queryOptions({
    queryKey: ["vitrine", "carro", slug],
    queryFn: async () =>
      (await api.get<{ carro: CarroPublico }>(`/showroom/cars/${encodeURIComponent(slug)}`)).carro,
  });
}
