import { z } from "zod";
import type { StatusCarro } from "./carros.ts";
import {
  corpoInvalido,
  esquemaTelefone,
  opcional,
  textoObrigatorio,
  textoOpcional,
} from "./campos.ts";

export const ORIGENS_CLIENTE = [
  "indicacao",
  "instagram",
  "marketplace",
  "vitrine",
  "whatsapp",
  "loja",
  "outro",
] as const;
export type OrigemCliente = (typeof ORIGENS_CLIENTE)[number];

export const ROTULOS_ORIGEM_CLIENTE: Record<OrigemCliente, string> = {
  indicacao: "Indicação",
  instagram: "Instagram",
  marketplace: "Marketplace",
  vitrine: "Vitrine",
  whatsapp: "WhatsApp",
  loja: "Visita à loja",
  outro: "Outro",
};

export const ETAPAS_FUNIL = [
  "novo",
  "em_contato",
  "visita_agendada",
  "proposta",
  "negociacao",
  "vendido",
  "perdido",
] as const;
export type EtapaFunil = (typeof ETAPAS_FUNIL)[number];

export const ROTULOS_ETAPA_FUNIL: Record<EtapaFunil, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  visita_agendada: "Visita agendada",
  proposta: "Proposta",
  negociacao: "Negociação",
  vendido: "Vendido",
  perdido: "Perdido",
};

export const esquemaCliente = z.object(
  {
    nome: textoObrigatorio("o nome", 100),
    telefone: esquemaTelefone,
    email: opcional(
      z
        .string({ error: "E-mail inválido." })
        .toLowerCase()
        .pipe(z.email("E-mail inválido.").max(120, "Use no máximo 120 caracteres.")),
    ),
    origem: opcional(z.enum(ORIGENS_CLIENTE, { error: "Origem inválida." })),
    observacoes: textoOpcional(2000),
  },
  corpoInvalido,
);

export type DadosCliente = z.input<typeof esquemaCliente>;
export type ClienteValidado = z.output<typeof esquemaCliente>;

export const esquemaNovoInteresse = z.object(
  {
    clienteId: z.uuid({ error: "Escolha um cliente." }),
    carroId: z.uuid({ error: "Escolha um carro." }),
  },
  corpoInvalido,
);

export const esquemaEtapaInteresse = z
  .object(
    {
      etapa: z.enum(ETAPAS_FUNIL, { error: "Etapa inválida." }),
      motivoPerda: textoOpcional(200),
    },
    corpoInvalido,
  )
  .superRefine((dados, ctx) => {
    if (dados.etapa === "perdido" && dados.motivoPerda === null) {
      ctx.addIssue({
        code: "custom",
        path: ["motivoPerda"],
        message: "Informe o motivo da perda.",
      });
    }
  })
  .transform((dados) => ({
    etapa: dados.etapa,
    motivoPerda: dados.etapa === "perdido" ? dados.motivoPerda : null,
  }));

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  origem: OrigemCliente | null;
  observacoes: string | null;
  interesses: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Interesse {
  id: string;
  etapa: EtapaFunil;
  motivoPerda: string | null;
  criadoEm: string;
  atualizadoEm: string;
  cliente: { id: string; nome: string; telefone: string };
  carro: {
    id: string;
    marca: string;
    modelo: string;
    versao: string | null;
    anoModelo: number | null;
    status: StatusCarro;
    capa: string | null;
  };
}
