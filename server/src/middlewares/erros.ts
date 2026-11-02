import { CODIGOS_ERRO, errosDeCampo, type RespostaErro } from "@globomotors/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";
import { ErroHttp } from "../erros.ts";

interface ErroTraduzido {
  status: number;
  corpo: RespostaErro;
}

function ehErroDoCliente(erro: unknown): erro is { status: number } {
  return (
    typeof erro === "object" &&
    erro !== null &&
    "status" in erro &&
    typeof erro.status === "number" &&
    erro.status >= 400 &&
    erro.status < 500 &&
    "expose" in erro &&
    erro.expose === true
  );
}

export function paraRespostaErro(erro: unknown): ErroTraduzido {
  if (erro instanceof ErroHttp) {
    return {
      status: erro.status,
      corpo: {
        erro: {
          codigo: erro.codigo,
          mensagem: erro.message,
          ...(erro.campos && { campos: erro.campos }),
        },
      },
    };
  }
  if (erro instanceof z.ZodError) {
    return {
      status: 400,
      corpo: {
        erro: {
          codigo: CODIGOS_ERRO.VALIDACAO,
          mensagem: "Dados inválidos.",
          campos: errosDeCampo(erro),
        },
      },
    };
  }
  if (ehErroDoCliente(erro)) {
    return {
      status: erro.status,
      corpo: {
        erro: { codigo: CODIGOS_ERRO.REQUISICAO_INVALIDA, mensagem: "Requisição inválida." },
      },
    };
  }
  return {
    status: 500,
    corpo: {
      erro: { codigo: CODIGOS_ERRO.ERRO_INTERNO, mensagem: "Erro interno. Tente novamente." },
    },
  };
}

export const rotaNaoEncontrada: RequestHandler = (_req, _res, next) => {
  next(new ErroHttp(404, CODIGOS_ERRO.NAO_ENCONTRADO, "Rota não encontrada."));
};

export const tratarErros: ErrorRequestHandler = (erro, req, res, next) => {
  if (res.headersSent) {
    next(erro);
    return;
  }
  const { status, corpo } = paraRespostaErro(erro);
  if (status >= 500) req.log.error({ err: erro }, "Erro não tratado");
  res.status(status).json(corpo);
};
