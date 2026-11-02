import { LOJA_PADRAO, type Loja } from "@globomotors/shared";
import type { Banco } from "../db/banco.ts";
import { loja } from "../db/schema.ts";

const colunas = {
  nome: loja.nome,
  cidade: loja.cidade,
  slogan: loja.slogan,
  whatsapp: loja.whatsapp,
  instagram: loja.instagram,
  mostrarPreco: loja.mostrarPreco,
  mostrarVendidos: loja.mostrarVendidos,
};

export function criarRepositorioLoja(db: Banco) {
  return {
    async obter(): Promise<Loja> {
      const [configuracao] = await db.select(colunas).from(loja);
      return configuracao ?? LOJA_PADRAO;
    },

    async salvar(dados: Loja): Promise<Loja> {
      await db
        .insert(loja)
        .values({ id: 1, ...dados })
        .onConflictDoUpdate({ target: loja.id, set: { ...dados, atualizadoEm: new Date() } });
      return dados;
    },
  };
}
