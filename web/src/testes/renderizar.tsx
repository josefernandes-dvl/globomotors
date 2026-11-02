import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, type InitialEntry } from "react-router";
import { RouterProvider } from "react-router/dom";
import { criarClienteDeConsultas } from "../lib/consultas.ts";
import { rotas } from "../rotas.ts";

export function renderizarRota(caminho: InitialEntry) {
  const queryClient = criarClienteDeConsultas();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] });
  const resultado = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...resultado, router, queryClient };
}
