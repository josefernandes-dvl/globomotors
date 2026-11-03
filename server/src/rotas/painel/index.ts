import { Router } from "express";
import type { Ia } from "../../ia.ts";
import { exigirAutenticacao } from "../../middlewares/autenticacao.ts";
import type { Repositorios } from "../../repositorios/index.ts";
import { rotasCarros } from "./carros.ts";
import { rotasClientes } from "./clientes.ts";
import { rotasFotos } from "./fotos.ts";
import { rotasIa } from "./ia.ts";
import { rotasInteresses } from "./interesses.ts";
import { rotasLoja } from "./loja.ts";

export function rotasPainel(repositorios: Repositorios, ia: Ia | null) {
  const rotas = Router();

  rotas.use(exigirAutenticacao(repositorios));
  rotas.use("/cars", rotasCarros(repositorios));
  rotas.use(rotasFotos(repositorios));
  rotas.use("/customers", rotasClientes(repositorios));
  rotas.use("/interests", rotasInteresses(repositorios));
  rotas.use("/store", rotasLoja(repositorios));
  rotas.use("/ai", rotasIa(ia));

  return rotas;
}
