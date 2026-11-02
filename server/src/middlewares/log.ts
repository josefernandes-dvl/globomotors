import type { Request, Response } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

function semConsulta(url: string) {
  return url.replace(/\?.*/s, "");
}

export function logDeRequisicoes(logger: Logger) {
  return pinoHttp<Request, Response>({
    logger,
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: semConsulta(req.url),
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    customLogLevel: (_req, res) => (res.statusCode >= 500 ? "error" : "info"),
    customSuccessMessage: (req, res, tempo) =>
      `${req.method} ${semConsulta(req.originalUrl)} ${res.statusCode} ${tempo}ms`,
    customErrorMessage: (req, res) =>
      `${req.method} ${semConsulta(req.originalUrl)} ${res.statusCode}`,
    customErrorObject: (_req, _res, _erro, objeto: Record<string, unknown>) => ({
      ...objeto,
      err: undefined,
    }),
  });
}
