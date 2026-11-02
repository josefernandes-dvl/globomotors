import { redirect, type RouteObject } from "react-router";
import { Carregando } from "./componentes/Carregando.tsx";
import { LayoutRaiz } from "./paginas/LayoutRaiz.tsx";
import { PaginaErro } from "./paginas/PaginaErro.tsx";
import { PaginaNaoEncontrada } from "./paginas/PaginaNaoEncontrada.tsx";
import { PaginaCarro } from "./paginas/vitrine/PaginaCarro.tsx";
import { PaginaInicial } from "./paginas/vitrine/PaginaInicial.tsx";
import { PaginaVitrine } from "./paginas/vitrine/PaginaVitrine.tsx";

export const rotas: RouteObject[] = [
  {
    path: "/",
    Component: LayoutRaiz,
    ErrorBoundary: PaginaErro,
    HydrateFallback: Carregando,
    children: [
      { index: true, Component: PaginaInicial },
      { path: "catalogo", Component: PaginaVitrine },
      { path: "catalogo/:slug", Component: PaginaCarro },
      {
        path: "login",
        lazy: async () => {
          const { PaginaEntrar } = await import("./paginas/PaginaEntrar.tsx");
          return { Component: PaginaEntrar };
        },
      },
      {
        path: "dashboard",
        lazy: async () => {
          const { LayoutPainel } = await import("./paginas/painel/LayoutPainel.tsx");
          return { Component: LayoutPainel };
        },
        children: [
          { index: true, loader: () => redirect("/dashboard/cars") },
          {
            path: "cars",
            lazy: async () => {
              const { PaginaCatalogo } = await import("./paginas/painel/PaginaCatalogo.tsx");
              return { Component: PaginaCatalogo };
            },
          },
          {
            path: "cars/new",
            lazy: async () => {
              const { PaginaFormularioCarro } =
                await import("./paginas/painel/PaginaFormularioCarro.tsx");
              return { Component: PaginaFormularioCarro };
            },
          },
          {
            path: "cars/:id",
            lazy: async () => {
              const { PaginaFormularioCarro } =
                await import("./paginas/painel/PaginaFormularioCarro.tsx");
              return { Component: PaginaFormularioCarro };
            },
          },
          {
            path: "customers",
            lazy: async () => {
              const { PaginaClientes } = await import("./paginas/painel/PaginaClientes.tsx");
              return { Component: PaginaClientes };
            },
          },
          {
            path: "customers/new",
            lazy: async () => {
              const { PaginaCliente } = await import("./paginas/painel/PaginaCliente.tsx");
              return { Component: PaginaCliente };
            },
          },
          {
            path: "customers/:id",
            lazy: async () => {
              const { PaginaCliente } = await import("./paginas/painel/PaginaCliente.tsx");
              return { Component: PaginaCliente };
            },
          },
          {
            path: "funnel",
            lazy: async () => {
              const { PaginaFunil } = await import("./paginas/painel/PaginaFunil.tsx");
              return { Component: PaginaFunil };
            },
          },
          {
            path: "store",
            lazy: async () => {
              const { PaginaLoja } = await import("./paginas/painel/PaginaLoja.tsx");
              return { Component: PaginaLoja };
            },
          },
        ],
      },
      { path: "*", Component: PaginaNaoEncontrada },
    ],
  },
];
