import { z } from "zod";

const esquemaConfig = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export type Config = z.infer<typeof esquemaConfig>;

export function lerConfig(env: NodeJS.ProcessEnv): Config {
  const resultado = esquemaConfig.safeParse(env);
  if (!resultado.success) {
    throw new Error(
      `Configuração inválida (confira server/.env):\n${z.prettifyError(resultado.error)}`,
    );
  }
  return resultado.data;
}
