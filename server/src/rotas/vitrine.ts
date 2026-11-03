import type { CarroPublico, Loja, LojaPublica, StatusPublico } from "@globomotors/shared";
import { Router } from "express";
import type { LinhaCarroVitrine } from "../repositorios/carros.ts";
import type { Repositorios } from "../repositorios/index.ts";
import { idDaRota, naoEncontrado } from "./parametros.ts";

function statusVisiveis(loja: Loja): StatusPublico[] {
  return loja.mostrarVendidos ? ["disponivel", "vendido"] : ["disponivel"];
}

function paraLojaPublica(loja: Loja): LojaPublica {
  return {
    nome: loja.nome,
    cidade: loja.cidade,
    slogan: loja.slogan,
    whatsapp: loja.whatsapp,
    instagram: loja.instagram,
    mostrarPreco: loja.mostrarPreco,
  };
}

function paraCarroPublico(carro: LinhaCarroVitrine, loja: Loja): CarroPublico {
  return {
    slug: carro.slug,
    marca: carro.marca,
    modelo: carro.modelo,
    versao: carro.versao,
    anoFabricacao: carro.anoFabricacao,
    anoModelo: carro.anoModelo,
    km: carro.km,
    cambio: carro.cambio,
    combustivel: carro.combustivel,
    carroceria: carro.carroceria,
    cor: carro.cor,
    motor: carro.motor,
    portas: carro.portas,
    opcionais: carro.opcionais,
    descricao: carro.descricao,
    preco: loja.mostrarPreco ? carro.precoVenda : null,
    status: carro.status,
    destaque: carro.destaque,
    fotos: carro.fotos.map((id) => ({ id, url: `/api/showroom/photos/${id}` })),
  };
}

export function rotasVitrine(repositorios: Repositorios) {
  const rotas = Router();

  rotas.get("/store", async (_req, res) => {
    res.json({ loja: paraLojaPublica(await repositorios.loja.obter()) });
  });

  rotas.get("/cars", async (_req, res) => {
    const loja = await repositorios.loja.obter();
    const carros = await repositorios.carros.listarPublicos(statusVisiveis(loja));
    res.json({ carros: carros.map((carro) => paraCarroPublico(carro, loja)) });
  });

  rotas.get("/cars/:slug", async (req, res) => {
    const loja = await repositorios.loja.obter();
    const carro = await repositorios.carros.buscarPublico(req.params.slug, statusVisiveis(loja));
    if (!carro) throw naoEncontrado("Carro não encontrado.");
    res.json({ carro: paraCarroPublico(carro, loja) });
  });

  rotas.get("/photos/:id", async (req, res) => {
    const id = idDaRota(req.params.id, "Foto não encontrada.");
    const loja = await repositorios.loja.obter();
    const foto = await repositorios.fotos.buscarPublica(id, statusVisiveis(loja));
    if (!foto) throw naoEncontrado("Foto não encontrada.");
    res
      .set("Cache-Control", "public, max-age=86400, s-maxage=86400")
      .type(foto.tipoMime)
      .send(foto.dados);
  });

  return rotas;
}
