import {
  CODIGOS_ERRO,
  TAMANHO_MAXIMO_FOTO,
  TIPOS_DE_FOTO,
  esquemaOrdemFotos,
  type TipoDeFoto,
} from "@globomotors/shared";
import express, { Router } from "express";
import { ErroHttp } from "../../erros.ts";
import type { Repositorios } from "../../repositorios/index.ts";
import { idDaRota, naoEncontrado } from "../parametros.ts";
import { urlDaFoto } from "./mapeadores.ts";

const CARRO_NAO_ENCONTRADO = "Veículo não encontrado.";
const FOTO_NAO_ENCONTRADA = "Foto não encontrada.";
const ASSINATURA_JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function detectarTipoDeFoto(dados: Buffer): TipoDeFoto | null {
  if (dados.subarray(0, 3).equals(ASSINATURA_JPEG)) return "image/jpeg";
  if (dados.subarray(0, 8).equals(ASSINATURA_PNG)) return "image/png";
  if (dados.toString("latin1", 0, 4) === "RIFF" && dados.toString("latin1", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function rotasFotos(repositorios: Repositorios) {
  const rotas = Router();

  rotas.post(
    "/cars/:id/photos",
    express.raw({ type: [...TIPOS_DE_FOTO], limit: TAMANHO_MAXIMO_FOTO }),
    async (req, res) => {
      const carroId = idDaRota(req.params.id, CARRO_NAO_ENCONTRADO);
      const dados: unknown = req.body;
      const tipoMime = Buffer.isBuffer(dados) ? detectarTipoDeFoto(dados) : null;
      if (!Buffer.isBuffer(dados) || !tipoMime) {
        throw new ErroHttp(
          400,
          CODIGOS_ERRO.ARQUIVO_INVALIDO,
          "Envie uma imagem JPG, PNG ou WebP.",
        );
      }
      const foto = await repositorios.fotos.adicionar(carroId, { tipoMime, dados });
      if (!foto) throw naoEncontrado(CARRO_NAO_ENCONTRADO);
      res.status(201).json({ foto: { id: foto.id, url: urlDaFoto(foto.id) } });
    },
  );

  rotas.patch("/cars/:id/photos", async (req, res) => {
    const carroId = idDaRota(req.params.id, CARRO_NAO_ENCONTRADO);
    const { ordem } = esquemaOrdemFotos.parse(req.body);
    if (!(await repositorios.fotos.reordenar(carroId, ordem))) {
      throw naoEncontrado(CARRO_NAO_ENCONTRADO);
    }
    res.status(204).end();
  });

  rotas.delete("/cars/:id/photos/:fotoId", async (req, res) => {
    const carroId = idDaRota(req.params.id, CARRO_NAO_ENCONTRADO);
    const fotoId = idDaRota(req.params.fotoId, FOTO_NAO_ENCONTRADA);
    if (!(await repositorios.fotos.apagar(carroId, fotoId))) {
      throw naoEncontrado(FOTO_NAO_ENCONTRADA);
    }
    res.status(204).end();
  });

  rotas.get("/photos/:id", async (req, res) => {
    const foto = await repositorios.fotos.buscar(idDaRota(req.params.id, FOTO_NAO_ENCONTRADA));
    if (!foto) throw naoEncontrado(FOTO_NAO_ENCONTRADA);
    res.set("Cache-Control", "private, max-age=86400").type(foto.tipoMime).send(foto.dados);
  });

  return rotas;
}
