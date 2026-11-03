import express from "express";
import helmet, { type HelmetOptions } from "helmet";
import type { Logger } from "pino";
import { rotaNaoEncontrada, tratarErros } from "./middlewares/erros.ts";
import { logDeRequisicoes } from "./middlewares/log.ts";
import { exigirMesmaOrigem } from "./middlewares/origem.ts";
import type { Repositorios } from "./repositorios/index.ts";
import { rotasAuth } from "./rotas/auth.ts";
import { rotasPainel } from "./rotas/painel/index.ts";
import { rotasSaude } from "./rotas/saude.ts";
import { rotasVitrine } from "./rotas/vitrine.ts";

interface OpcoesApp {
  repositorios: Repositorios;
  logger: Logger;
  pastaWeb?: string | undefined;
  cookieSeguro?: boolean;
  confiarEmProxy?: number;
}

export const opcoesHelmet: HelmetOptions = {
  contentSecurityPolicy: { directives: { imgSrc: ["'self'", "data:", "blob:"] } },
};

export function criarApp({
  repositorios,
  logger,
  pastaWeb,
  cookieSeguro = false,
  confiarEmProxy = 0,
}: OpcoesApp) {
  const app = express();
  app.set("trust proxy", confiarEmProxy);

  app.use(helmet(opcoesHelmet));
  app.use(logDeRequisicoes(logger));
  app.use(exigirMesmaOrigem);
  app.use(express.json());

  app.use(["/api/auth", "/api/dashboard"], (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api/health", rotasSaude(repositorios));
  app.use("/api/auth", rotasAuth(repositorios, { cookieSeguro }));
  app.use("/api/showroom", rotasVitrine(repositorios));
  app.use("/api/dashboard", rotasPainel(repositorios));
  app.use("/api", rotaNaoEncontrada);

  if (pastaWeb) {
    app.use(express.static(pastaWeb));
    app.use("/assets", rotaNaoEncontrada);
    app.get("/{*caminho}", (_req, res) => {
      res.sendFile("index.html", { root: pastaWeb });
    });
  }

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);

  return app;
}
