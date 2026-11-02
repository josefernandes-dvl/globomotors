import { createHash, randomBytes } from "node:crypto";
import { CODIGOS_ERRO, type Usuario } from "@globomotors/shared";
import type { Request, RequestHandler } from "express";
import { ErroHttp } from "../erros.ts";
import type { Repositorios } from "../repositorios/index.ts";

export const NOME_COOKIE = "globomotors_sessao";
export const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;

const vendedores = new WeakMap<Request, Usuario>();

export function gerarToken() {
  return randomBytes(32).toString("base64url");
}

export function hashDoToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function lerCookie(cabecalho: string | undefined, nome: string) {
  for (const parte of (cabecalho ?? "").split(";")) {
    const separador = parte.indexOf("=");
    if (separador > 0 && parte.slice(0, separador).trim() === nome) {
      return parte.slice(separador + 1).trim() || undefined;
    }
  }
  return undefined;
}

export function exigirAutenticacao(repositorios: Repositorios): RequestHandler {
  return async (req, _res, next) => {
    const token = lerCookie(req.headers.cookie, NOME_COOKIE);
    const vendedor = token ? await repositorios.sessoes.buscarUsuario(hashDoToken(token)) : null;
    if (!vendedor) {
      throw new ErroHttp(401, CODIGOS_ERRO.NAO_AUTENTICADO, "Faça login para continuar.");
    }
    vendedores.set(req, vendedor);
    next();
  };
}

export function vendedorAutenticado(req: Request) {
  const vendedor = vendedores.get(req);
  if (!vendedor) throw new Error("A rota precisa passar por exigirAutenticacao.");
  return vendedor;
}
