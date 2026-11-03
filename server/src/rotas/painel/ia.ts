import { CODIGOS_ERRO, TAMANHO_MAXIMO_FOTO, esquemaPedidoIa } from "@globomotors/shared";
import express, { Router } from "express";
import { ErroHttp } from "../../erros.ts";
import type { Ia, PedidoIa } from "../../ia.ts";
import { detectarTipoDeFoto } from "./fotos.ts";

export function rotasIa(ia: Ia | null) {
  const rotas = Router();

  rotas.post(
    "/extract-car",
    express.raw({ type: "multipart/form-data", limit: TAMANHO_MAXIMO_FOTO }),
    async (req, res) => {
      if (!ia) {
        throw new ErroHttp(
          503,
          CODIGOS_ERRO.IA_INDISPONIVEL,
          "A leitura com IA ainda não foi configurada no servidor.",
        );
      }
      const corpo: unknown = req.body;
      const formulario = Buffer.isBuffer(corpo)
        ? await new Response(corpo, { headers: { "content-type": req.get("content-type") ?? "" } })
            .formData()
            .catch(() => null)
        : null;
      if (!formulario) {
        throw new ErroHttp(
          400,
          CODIGOS_ERRO.REQUISICAO_INVALIDA,
          "Envie o texto ou as imagens do carro.",
        );
      }
      const texto = formulario.get("texto");
      const arquivos = formulario.getAll("imagens").filter((item) => typeof item !== "string");
      const pedido = esquemaPedidoIa.parse({
        texto: typeof texto === "string" ? texto : "",
        imagens: arquivos.length,
      });
      const imagens: PedidoIa["imagens"] = [];
      for (const arquivo of arquivos) {
        const dados = Buffer.from(await arquivo.arrayBuffer());
        const tipo = detectarTipoDeFoto(dados);
        if (!tipo) {
          throw new ErroHttp(400, CODIGOS_ERRO.ARQUIVO_INVALIDO, "Envie imagens JPG, PNG ou WebP.");
        }
        imagens.push({ tipo, dados });
      }
      res.json({ carro: await ia.lerCarro({ texto: pedido.texto, imagens }) });
    },
  );

  return rotas;
}
