import { esquemaCarroDoDesejo, esquemaDesejo } from "@globomotors/shared";
import { Router } from "express";
import type { Repositorios } from "../../repositorios/index.ts";
import { idDaRota, naoEncontrado } from "../parametros.ts";
import { paraClienteComDesejos, paraDesejo, paraInteresse } from "./mapeadores.ts";

const DESEJO_NAO_ENCONTRADO = "Interesse não encontrado.";

export function rotasDesejos(repositorios: Repositorios) {
  const rotas = Router();

  rotas.get("/", async (_req, res) => {
    const clientes = await repositorios.desejos.listarPorCliente();
    res.json({ clientes: clientes.map(paraClienteComDesejos) });
  });

  rotas.post("/", async (req, res) => {
    const desejo = await repositorios.desejos.criar(esquemaDesejo.parse(req.body));
    res.status(201).json({ desejo: paraDesejo(desejo) });
  });

  rotas.delete("/:id", async (req, res) => {
    const desejo = await repositorios.desejos.apagar(
      idDaRota(req.params.id, DESEJO_NAO_ENCONTRADO),
    );
    if (!desejo) throw naoEncontrado(DESEJO_NAO_ENCONTRADO);
    res.status(204).end();
  });

  rotas.post("/:id/attend", async (req, res) => {
    const id = idDaRota(req.params.id, DESEJO_NAO_ENCONTRADO);
    const { carroId } = esquemaCarroDoDesejo.parse(req.body);
    const interesse = await repositorios.interesses.atender(id, carroId);
    if (!interesse) throw naoEncontrado(DESEJO_NAO_ENCONTRADO);
    res.json({ interesse: paraInteresse(interesse) });
  });

  rotas.post("/:id/dismiss", async (req, res) => {
    const id = idDaRota(req.params.id, DESEJO_NAO_ENCONTRADO);
    const { carroId } = esquemaCarroDoDesejo.parse(req.body);
    await repositorios.desejos.descartarCarro(id, carroId);
    res.status(204).end();
  });

  return rotas;
}
