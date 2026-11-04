import type { Banco } from "../db/banco.ts";
import { criarRepositorioCarros } from "./carros.ts";
import { criarRepositorioClientes } from "./clientes.ts";
import { criarRepositorioDesejos } from "./desejos.ts";
import { criarRepositorioFotos } from "./fotos.ts";
import { criarRepositorioInteresses } from "./interesses.ts";
import { criarRepositorioLoja } from "./loja.ts";
import { criarRepositorioSessoes } from "./sessoes.ts";
import { criarRepositorioSistema } from "./sistema.ts";
import { criarRepositorioTentativasLogin } from "./tentativasLogin.ts";
import { criarRepositorioUsuarios } from "./usuarios.ts";

export function criarRepositorios(db: Banco) {
  return {
    sistema: criarRepositorioSistema(db),
    usuarios: criarRepositorioUsuarios(db),
    sessoes: criarRepositorioSessoes(db),
    tentativasLogin: criarRepositorioTentativasLogin(db),
    carros: criarRepositorioCarros(db),
    fotos: criarRepositorioFotos(db),
    clientes: criarRepositorioClientes(db),
    interesses: criarRepositorioInteresses(db),
    desejos: criarRepositorioDesejos(db),
    loja: criarRepositorioLoja(db),
  };
}

export type Repositorios = ReturnType<typeof criarRepositorios>;
