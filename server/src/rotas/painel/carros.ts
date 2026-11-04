import { esquemaCarro, esquemaStatusCarro, type CarroSalvo } from "@globomotors/shared";
import { Router } from "express";
import type { LinhaCarroPainel } from "../../repositorios/carros.ts";
import type { Repositorios } from "../../repositorios/index.ts";
import { idDaRota, naoEncontrado } from "../parametros.ts";
import { paraCarroPainel } from "./mapeadores.ts";

const CARRO_NAO_ENCONTRADO = "Veículo não encontrado.";

export function rotasCarros(repositorios: Repositorios) {
  const rotas = Router();

  async function carroSalvo(carro: LinhaCarroPainel, agora: Date): Promise<CarroSalvo> {
    return {
      carro: paraCarroPainel(carro),
      possiveisInteressados:
        carro.publicadoEm?.getTime() === agora.getTime()
          ? await repositorios.desejos.contarInteressados(carro)
          : 0,
    };
  }

  rotas.get("/", async (_req, res) => {
    const carros = await repositorios.carros.listarPainel();
    res.json({ carros: carros.map(paraCarroPainel) });
  });

  rotas.post("/", async (req, res) => {
    const agora = new Date();
    const carro = await repositorios.carros.criar(esquemaCarro.parse(req.body), agora);
    res.status(201).json(await carroSalvo(carro, agora));
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
    const agora = new Date();
    const carro = await repositorios.carros.atualizar(id, esquemaCarro.parse(req.body), agora);
    if (!carro) throw naoEncontrado(CARRO_NAO_ENCONTRADO);
    res.json(await carroSalvo(carro, agora));
  });

  rotas.patch("/:id/status", async (req, res) => {
    const id = idDaRota(req.params.id, CARRO_NAO_ENCONTRADO);
    const { status } = esquemaStatusCarro.parse(req.body);
    const agora = new Date();
    const carro = await repositorios.carros.alterarStatus(id, status, agora);
    if (!carro) throw naoEncontrado(CARRO_NAO_ENCONTRADO);
    res.json(await carroSalvo(carro, agora));
  });

  rotas.delete("/:id", async (req, res) => {
    const carro = await repositorios.carros.apagar(idDaRota(req.params.id, CARRO_NAO_ENCONTRADO));
    if (!carro) throw naoEncontrado(CARRO_NAO_ENCONTRADO);
    res.status(204).end();
  });

  return rotas;
}
