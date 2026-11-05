import type {
  Cambio,
  Carroceria,
  Combustivel,
  EtapaFunil,
  OrigemCliente,
  StatusCarro,
  TipoDeFoto,
} from "@globomotors/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const dataHora = () => timestamp({ withTimezone: true, mode: "date" });
const criadoEm = () => dataHora().notNull().defaultNow();
const atualizadoEm = () =>
  dataHora()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const usuarios = pgTable("usuarios", {
  id: uuid().primaryKey().defaultRandom(),
  nome: text().notNull(),
  email: text().notNull().unique(),
  senhaHash: text().notNull(),
  criadoEm: criadoEm(),
});

export const sessoes = pgTable(
  "sessoes",
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    tokenHash: text().notNull().unique("sessoes_token_hash_unique"),
    criadoEm: criadoEm(),
    expiraEm: dataHora().notNull(),
  },
  (t) => [index().on(t.usuarioId)],
);

export const tentativasLogin = pgTable(
  "tentativas_login",
  {
    chave: text().primaryKey(),
    tentativas: integer().notNull(),
    expiraEm: dataHora().notNull(),
  },
  (t) => [index().on(t.expiraEm)],
);

export const carros = pgTable("carros", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  marca: text().notNull(),
  modelo: text().notNull(),
  versao: text(),
  anoFabricacao: smallint(),
  anoModelo: smallint(),
  km: integer(),
  cambio: text().$type<Cambio>(),
  combustivel: text().$type<Combustivel>(),
  carroceria: text().$type<Carroceria>(),
  cores: text().array().notNull().default([]),
  motor: text(),
  portas: smallint(),
  opcionais: text().array().notNull().default([]),
  descricao: text(),
  precoVenda: integer(),
  destaque: boolean().notNull().default(false),
  status: text().$type<StatusCarro>().notNull().default("rascunho"),
  precoCompra: integer(),
  custoPreparacao: integer(),
  custoDocumentacao: integer(),
  custoComissao: integer(),
  precoMinimo: integer(),
  dataEntrada: date({ mode: "string" }).notNull(),
  placa: text().unique(),
  chassi: text().unique(),
  renavam: text().unique(),
  origem: text(),
  vendedorNome: text(),
  vendedorTelefone: text(),
  observacoesInternas: text(),
  vendidoEm: dataHora(),
  publicadoEm: dataHora(),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

export const fotosCarro = pgTable(
  "fotos_carro",
  {
    id: uuid().primaryKey().defaultRandom(),
    carroId: uuid()
      .notNull()
      .references(() => carros.id, { onDelete: "cascade" }),
    ordem: integer().notNull(),
    tipoMime: text().$type<TipoDeFoto>().notNull(),
    dados: bytea().notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [index().on(t.carroId, t.ordem)],
);

export const clientes = pgTable("clientes", {
  id: uuid().primaryKey().defaultRandom(),
  nome: text().notNull(),
  telefone: text().notNull().unique(),
  email: text(),
  origem: text().$type<OrigemCliente>(),
  observacoes: text(),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

export const interesses = pgTable(
  "interesses",
  {
    id: uuid().primaryKey().defaultRandom(),
    clienteId: uuid()
      .notNull()
      .references(() => clientes.id, { onDelete: "cascade" }),
    carroId: uuid()
      .notNull()
      .references(() => carros.id, { onDelete: "cascade" }),
    etapa: text().$type<EtapaFunil>().notNull().default("novo"),
    motivoPerda: text(),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    unique("interesses_cliente_id_carro_id_unique").on(t.clienteId, t.carroId),
    index().on(t.carroId),
  ],
);

export const desejos = pgTable(
  "desejos",
  {
    id: uuid().primaryKey().defaultRandom(),
    clienteId: uuid()
      .notNull()
      .references(() => clientes.id, { onDelete: "cascade" }),
    nome: text().notNull(),
    anoMinimo: smallint(),
    precoMaximo: integer(),
    observacoes: text(),
    ordem: integer().generatedAlwaysAsIdentity(),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("desejos_cliente_id_nome_unique").on(t.clienteId, sql`lower(${t.nome})`)],
);

export const carrosDescartados = pgTable(
  "carros_descartados",
  {
    desejoId: uuid()
      .notNull()
      .references(() => desejos.id, { onDelete: "cascade" }),
    carroId: uuid()
      .notNull()
      .references(() => carros.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.desejoId, t.carroId] }), index().on(t.carroId)],
);

export const loja = pgTable(
  "loja",
  {
    id: smallint().primaryKey().default(1),
    nome: text().notNull(),
    cidade: text(),
    slogan: text(),
    whatsapp: text(),
    instagram: text(),
    mostrarPreco: boolean().notNull().default(true),
    mostrarVendidos: boolean().notNull().default(false),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [check("loja_unica", sql`${t.id} = 1`)],
);
