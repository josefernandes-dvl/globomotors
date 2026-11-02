import { CODIGOS_ERRO } from "@globomotors/shared";
import type { RequestHandler } from "express";
import { ErroHttp } from "../erros.ts";

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);
const ORIGENS_ACEITAS = new Set(["same-origin", "none"]);

export const exigirMesmaOrigem: RequestHandler = (req, _res, next) => {
  const origem = req.get("sec-fetch-site");
  if (METODOS_SEGUROS.has(req.method) || origem === undefined || ORIGENS_ACEITAS.has(origem)) {
    next();
    return;
  }
  next(new ErroHttp(403, CODIGOS_ERRO.ORIGEM_RECUSADA, "Requisição vinda de outro site recusada."));
};
