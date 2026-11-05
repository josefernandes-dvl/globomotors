import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarBancoDeTeste } from "../testes/bancoDeTeste.ts";
import { migrar, PASTA_MIGRATIONS } from "./migrar.ts";

interface Diario {
  entries: { tag: string }[];
}

function migrationsAte(ultima: string) {
  const pasta = mkdtempSync(join(tmpdir(), "globomotors-migrations-"));
  const diario = JSON.parse(
    readFileSync(join(PASTA_MIGRATIONS, "meta", "_journal.json"), "utf8"),
  ) as Diario;
  const entradas = diario.entries.slice(
    0,
    diario.entries.findIndex(({ tag }) => tag === ultima) + 1,
  );
  mkdirSync(join(pasta, "meta"));
  writeFileSync(
    join(pasta, "meta", "_journal.json"),
    JSON.stringify({ ...diario, entries: entradas }),
  );
  for (const { tag } of entradas) {
    cpSync(join(PASTA_MIGRATIONS, `${tag}.sql`), join(pasta, `${tag}.sql`));
  }
  return pasta;
}

describe("migration 0006_cores_do_veiculo", () => {
  let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
  const pasta = migrationsAte("0005_carros_descartados");

  beforeAll(async () => {
    banco = await criarBancoDeTeste({ migrar: false });
    await migrate(banco.db, { migrationsFolder: pasta });
    await banco.pool.query(
      `insert into carros (slug, marca, modelo, data_entrada, cor) values
        ('a', 'Fiat', 'Argo', '2026-11-01', ' Prata '),
        ('b', 'Fiat', 'Mobi', '2026-11-01', null),
        ('c', 'Fiat', 'Uno', '2026-11-01', '  ')`,
    );
    await migrar(banco.db);
  });

  afterAll(async () => {
    await banco.destruir();
    rmSync(pasta, { recursive: true, force: true });
  });

  it("copia a cor de cada veículo para a lista de cores e mantém a coluna antiga", async () => {
    const { rows } = await banco.pool.query<{ slug: string; cor: string | null; cores: string[] }>(
      "select slug, cor, cores from carros order by slug",
    );

    expect(rows).toEqual([
      { slug: "a", cor: " Prata ", cores: ["Prata"] },
      { slug: "b", cor: null, cores: [] },
      { slug: "c", cor: "  ", cores: [] },
    ]);
  });

  it("deixa a lista vazia por padrão nos veículos novos", async () => {
    const { rows } = await banco.pool.query<{ cores: string[] }>(
      "insert into carros (slug, marca, modelo, data_entrada) values ('d', 'Fiat', 'Toro', '2026-11-01') returning cores",
    );

    expect(rows).toEqual([{ cores: [] }]);
  });
});
