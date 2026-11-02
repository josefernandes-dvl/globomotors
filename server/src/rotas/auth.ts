import { randomBytes } from "node:crypto";
import { CODIGOS_ERRO, esquemaEntrar } from "@globomotors/shared";
import { Router, type CookieOptions, type Response } from "express";
import { ErroHttp } from "../erros.ts";
import {
  DURACAO_SESSAO_MS,
  NOME_COOKIE,
  exigirAutenticacao,
  gerarToken,
  hashDoToken,
  lerCookie,
  vendedorAutenticado,
} from "../middlewares/autenticacao.ts";
import type { Repositorios } from "../repositorios/index.ts";
import { gerarHashSenha, verificarSenha } from "../senhas.ts";

const LIMITE_TENTATIVAS = 10;
const JANELA_TENTATIVAS_MS = 15 * 60 * 1000;

let hashFalso: Promise<string> | undefined;

async function registrarTentativa(repositorios: Repositorios, chaves: string[], res: Response) {
  const agora = new Date();
  await repositorios.tentativasLogin.apagarExpiradas(agora);
  for (const chave of chaves) {
    const { tentativas, expiraEm } = await repositorios.tentativasLogin.registrar(
      chave,
      agora,
      JANELA_TENTATIVAS_MS,
    );
    if (tentativas > LIMITE_TENTATIVAS) {
      const segundos = Math.ceil((expiraEm.getTime() - agora.getTime()) / 1000);
      res.set("Retry-After", String(segundos));
      throw new ErroHttp(
        429,
        CODIGOS_ERRO.MUITAS_TENTATIVAS,
        `Muitas tentativas de login. Tente de novo em ${Math.ceil(segundos / 60)} min.`,
      );
    }
  }
}

export function rotasAuth(repositorios: Repositorios, { cookieSeguro }: { cookieSeguro: boolean }) {
  const rotas = Router();
  const opcoesCookie: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSeguro,
    path: "/",
  };

  rotas.post("/login", async (req, res) => {
    const { email, senha } = esquemaEntrar.parse(req.body);
    const chaves = [`ip:${req.ip ?? ""}`, `email:${email}`];
    await registrarTentativa(repositorios, chaves, res);
    const usuario = await repositorios.usuarios.buscarPorEmail(email);
    hashFalso ??= gerarHashSenha(randomBytes(16).toString("hex"));
    const senhaConfere = await verificarSenha(senha, usuario?.senhaHash ?? (await hashFalso));
    if (!usuario || !senhaConfere) {
      throw new ErroHttp(401, CODIGOS_ERRO.CREDENCIAIS_INVALIDAS, "E-mail ou senha incorretos.");
    }

    await repositorios.tentativasLogin.limpar(chaves);
    await repositorios.sessoes.apagarExpiradas(usuario.id);
    const token = gerarToken();
    await repositorios.sessoes.criar({
      usuarioId: usuario.id,
      tokenHash: hashDoToken(token),
      expiraEm: new Date(Date.now() + DURACAO_SESSAO_MS),
    });
    res.cookie(NOME_COOKIE, token, { ...opcoesCookie, maxAge: DURACAO_SESSAO_MS });
    res.json({ usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
  });

  rotas.post("/logout", async (req, res) => {
    const token = lerCookie(req.headers.cookie, NOME_COOKIE);
    if (token) await repositorios.sessoes.apagar(hashDoToken(token));
    res.clearCookie(NOME_COOKIE, opcoesCookie);
    res.status(204).end();
  });

  rotas.get("/me", exigirAutenticacao(repositorios), (req, res) => {
    res.json({ usuario: vendedorAutenticado(req) });
  });

  return rotas;
}
