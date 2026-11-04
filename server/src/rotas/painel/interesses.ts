import { esquemaEtapaInteresse, esquemaNovoInteresse } from "@globomotors/shared";
import { Router } from "express";
import { z } from "zod";
import type { Repositorios } from "../../repositorios/index.ts";
import { idDaRota, naoEncontrado } from "../parametros.ts";
import { paraInteresse } from "./mapeadores.ts";

const INTERESSE_NAO_ENCONTRADO = "Interesse não encontrado.";

const esquemaFiltro = z.object({
  carId: z.uuid({ error: "Veículo inválido." }).optional(),
  customerId: z.uuid({ error: "Cliente inválido." }).optional(),
});

export function rotasInteresses(repositorios: Repositorios) {
  const rotas = Router();

  rotas.get("/", async (req, res) => {
    const { carId, customerId } = esquemaFiltro.parse(req.query);
    const interesses = await repositorios.interesses.listar({
      carroId: carId,
      clienteId: customerId,
    });
    res.json({ interesses: interesses.map(paraInteresse) });
  });

  rotas.post("/", async (req, res) => {
    const interesse = await repositorios.interesses.criar(esquemaNovoInteresse.parse(req.body));
    res.status(201).json({ interesse: paraInteresse(interesse) });
  });

  rotas.patch("/:id", async (req, res) => {
    const id = idDaRota(req.params.id, INTERESSE_NAO_ENCONTRADO);
    const interesse = await repositorios.interesses.atualizar(
      id,
      esquemaEtapaInteresse.parse(req.body),
    );
    if (!interesse) throw naoEncontrado(INTERESSE_NAO_ENCONTRADO);
    res.json({ interesse: paraInteresse(interesse) });
  });

  rotas.delete("/:id", async (req, res) => {
    const interesse = await repositorios.interesses.apagar(
      idDaRota(req.params.id, INTERESSE_NAO_ENCONTRADO),
    );
    if (!interesse) throw naoEncontrado(INTERESSE_NAO_ENCONTRADO);
    res.status(204).end();
  });

  return rotas;
}
