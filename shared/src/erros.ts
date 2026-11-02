import { z } from "zod";

export const CODIGOS_ERRO = {
  REQUISICAO_INVALIDA: "requisicao_invalida",
  VALIDACAO: "validacao",
  NAO_AUTENTICADO: "nao_autenticado",
  CREDENCIAIS_INVALIDAS: "credenciais_invalidas",
  MUITAS_TENTATIVAS: "muitas_tentativas",
  ORIGEM_RECUSADA: "origem_recusada",
  NAO_ENCONTRADO: "nao_encontrado",
  CONFLITO: "conflito",
  ARQUIVO_INVALIDO: "arquivo_invalido",
  ERRO_INTERNO: "erro_interno",
} as const;

export type CodigoErro = (typeof CODIGOS_ERRO)[keyof typeof CODIGOS_ERRO];

export const esquemaErroDeCampo = z.object({
  campo: z.string(),
  mensagem: z.string(),
});

export type ErroDeCampo = z.infer<typeof esquemaErroDeCampo>;

export function errosDeCampo(erro: z.ZodError): ErroDeCampo[] {
  return erro.issues.map((issue) => ({
    campo: issue.path.map(String).join("."),
    mensagem: issue.message,
  }));
}

export const esquemaRespostaErro = z.object({
  erro: z.object({
    codigo: z.enum(CODIGOS_ERRO),
    mensagem: z.string(),
    campos: z.array(esquemaErroDeCampo).optional(),
  }),
});

export type RespostaErro = z.infer<typeof esquemaRespostaErro>;
