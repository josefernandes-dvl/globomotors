import type { RespostaSaude } from "@globomotors/shared";
import { Router } from "express";
import type { Repositorios } from "../repositorios/index.ts";

export function rotasSaude(repositorios: Repositorios): Router {
  const rotas = Router();

  rotas.get("/", async (_req, res) => {
    const bancoOk = await repositorios.sistema.bancoDisponivel();
    const corpo: RespostaSaude = bancoOk
      ? { status: "ok", banco: "ok" }
      : { status: "degradado", banco: "indisponivel" };
    res.status(bancoOk ? 200 : 503).json(corpo);
  });

  return rotas;
}
