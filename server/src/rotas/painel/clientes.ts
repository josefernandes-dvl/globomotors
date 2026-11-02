import { esquemaCliente } from "@globomotors/shared";
import { Router } from "express";
import { z } from "zod";
import type { Repositorios } from "../../repositorios/index.ts";
import { idDaRota, naoEncontrado } from "../parametros.ts";
import { paraCliente } from "./mapeadores.ts";

const CLIENTE_NAO_ENCONTRADO = "Cliente não encontrado.";

const esquemaBusca = z.object({
  search: z
    .string({ error: "Busca inválida." })
    .trim()
    .max(100, "Use no máximo 100 caracteres.")
    .default(""),
});

export function rotasClientes(repositorios: Repositorios) {
  const rotas = Router();

  rotas.get("/", async (req, res) => {
    const { search } = esquemaBusca.parse(req.query);
    const clientes = await repositorios.clientes.listar(search);
    res.json({ clientes: clientes.map(paraCliente) });
  });

  rotas.post("/", async (req, res) => {
    const cliente = await repositorios.clientes.criar(esquemaCliente.parse(req.body));
    res.status(201).json({ cliente: paraCliente(cliente) });
  });

  rotas.get("/:id", async (req, res) => {
    const cliente = await repositorios.clientes.buscar(
      idDaRota(req.params.id, CLIENTE_NAO_ENCONTRADO),
    );
    if (!cliente) throw naoEncontrado(CLIENTE_NAO_ENCONTRADO);
    res.json({ cliente: paraCliente(cliente) });
  });

  rotas.put("/:id", async (req, res) => {
    const id = idDaRota(req.params.id, CLIENTE_NAO_ENCONTRADO);
    const cliente = await repositorios.clientes.atualizar(id, esquemaCliente.parse(req.body));
    if (!cliente) throw naoEncontrado(CLIENTE_NAO_ENCONTRADO);
    res.json({ cliente: paraCliente(cliente) });
  });

  rotas.delete("/:id", async (req, res) => {
    const cliente = await repositorios.clientes.apagar(
      idDaRota(req.params.id, CLIENTE_NAO_ENCONTRADO),
    );
    if (!cliente) throw naoEncontrado(CLIENTE_NAO_ENCONTRADO);
    res.status(204).end();
  });

  return rotas;
}
