import { esquemaCarro, esquemaStatusCarro } from "@globomotors/shared";
import { Router } from "express";
import type { Repositorios } from "../../repositorios/index.ts";
import { idDaRota, naoEncontrado } from "../parametros.ts";
import { paraCarroPainel } from "./mapeadores.ts";

const CARRO_NAO_ENCONTRADO = "Carro não encontrado.";

export function rotasCarros(repositorios: Repositorios) {
  const rotas = Router();

  rotas.get("/", async (_req, res) => {
    const carros = await repositorios.carros.listarPainel();
    res.json({ carros: carros.map(paraCarroPainel) });
  });

  rotas.post("/", async (req, res) => {
    const carro = await repositorios.carros.criar(esquemaCarro.parse(req.body));
    res.status(201).json({ carro: paraCarroPainel(carro) });
  });

  rotas.get("/:id", async (req, res) => {
    const carro = await repositorios.carros.buscarPainel(
      idDaRota(req.params.id, CARRO_NAO_ENCONTRADO),
    );
    if (!carro) throw naoEncontrado(CARRO_NAO_ENCONTRADO);
    res.json({ carro: paraCarroPainel(carro) });
  });

  rotas.put("/:id", async (req, res) => {
    const id = idDaRota(req.params.id, CARRO_NAO_ENCONTRADO);
    const carro = await repositorios.carros.atualizar(id, esquemaCarro.parse(req.body));
    if (!carro) throw naoEncontrado(CARRO_NAO_ENCONTRADO);
    res.json({ carro: paraCarroPainel(carro) });
  });

  rotas.patch("/:id/status", async (req, res) => {
    const id = idDaRota(req.params.id, CARRO_NAO_ENCONTRADO);
    const { status } = esquemaStatusCarro.parse(req.body);
    const carro = await repositorios.carros.alterarStatus(id, status);
    if (!carro) throw naoEncontrado(CARRO_NAO_ENCONTRADO);
    res.json({ carro: paraCarroPainel(carro) });
  });

  rotas.delete("/:id", async (req, res) => {
    const carro = await repositorios.carros.apagar(idDaRota(req.params.id, CARRO_NAO_ENCONTRADO));
    if (!carro) throw naoEncontrado(CARRO_NAO_ENCONTRADO);
    res.status(204).end();
  });

  return rotas;
}
