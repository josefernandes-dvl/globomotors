import { esquemaLoja } from "@globomotors/shared";
import { Router } from "express";
import type { Repositorios } from "../../repositorios/index.ts";

export function rotasLoja(repositorios: Repositorios) {
  const rotas = Router();

  rotas.get("/", async (_req, res) => {
    res.json({ loja: await repositorios.loja.obter() });
  });

  rotas.put("/", async (req, res) => {
    res.json({ loja: await repositorios.loja.salvar(esquemaLoja.parse(req.body)) });
  });

  return rotas;
}
