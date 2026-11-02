import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { criarBanco } from "../db/banco.ts";
import { migrar } from "../db/migrar.ts";

async function executarComoAdmin(urlBase: string, comando: string) {
  const cliente = new Client({ connectionString: urlBase });
  await cliente.connect();
  try {
    await cliente.query(comando);
  } finally {
    await cliente.end();
  }
}

export async function criarBancoDeTeste({ migrar: aplicarMigrations = true } = {}) {
  const urlBase = process.env.DATABASE_URL;
  if (!urlBase) {
    throw new Error("DATABASE_URL não definida: crie server/.env a partir de server/.env.example");
  }

  const nome = `globomotors_teste_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await executarComoAdmin(urlBase, `CREATE DATABASE "${nome}"`);

  const url = new URL(urlBase);
  url.pathname = `/${nome}`;
  const { db, pool } = criarBanco(url.toString());

  async function destruir() {
    await pool.end();
    await executarComoAdmin(urlBase!, `DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`);
  }

  if (aplicarMigrations) {
    try {
      await migrar(db);
    } catch (erro) {
      await destruir();
      throw erro;
    }
  }

  return { url: url.toString(), db, pool, destruir };
}
