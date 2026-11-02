import { pino, type Logger } from "pino";
import type { Config } from "./config.ts";

export function criarLogger(config: Pick<Config, "NODE_ENV" | "LOG_LEVEL">): Logger {
  return pino({
    level: config.LOG_LEVEL ?? (config.NODE_ENV === "test" ? "silent" : "info"),
    transport:
      config.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { ignore: "pid,hostname,req,res,responseTime" } }
        : undefined,
  });
}
