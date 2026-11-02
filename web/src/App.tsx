import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { criarClienteDeConsultas } from "./lib/consultas.ts";
import { rotas } from "./rotas.ts";

const queryClient = criarClienteDeConsultas();
const router = createBrowserRouter(rotas);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
