import {
  calcularMargem,
  dataEmSaoPaulo,
  diasEntre,
  hojeEmSaoPaulo,
  type CarroPainel,
  type Cliente,
  type ClienteComDesejos,
  type Desejo,
  type Interesse,
} from "@globomotors/shared";
import type { LinhaCarroPainel } from "../../repositorios/carros.ts";
import type { LinhaCliente } from "../../repositorios/clientes.ts";
import type { LinhaClienteComDesejos, LinhaDesejo } from "../../repositorios/desejos.ts";
import type { LinhaInteresse } from "../../repositorios/interesses.ts";

export function urlDaFoto(id: string) {
  return `/api/dashboard/photos/${id}`;
}

export function paraCarroPainel({
  fotos,
  vendidoEm,
  publicadoEm,
  criadoEm,
  atualizadoEm,
  ...carro
}: LinhaCarroPainel): CarroPainel {
  const fimDoEstoque = vendidoEm ? dataEmSaoPaulo(vendidoEm) : hojeEmSaoPaulo();
  return {
    ...carro,
    margem: calcularMargem(carro),
    diasEmEstoque: Math.max(0, diasEntre(carro.dataEntrada, fimDoEstoque)),
    fotos: fotos.map((id) => ({ id, url: urlDaFoto(id) })),
    vendidoEm: vendidoEm?.toISOString() ?? null,
    publicadoEm: publicadoEm?.toISOString() ?? null,
    criadoEm: criadoEm.toISOString(),
    atualizadoEm: atualizadoEm.toISOString(),
  };
}

export function paraCliente({ criadoEm, atualizadoEm, ...cliente }: LinhaCliente): Cliente {
  return {
    ...cliente,
    criadoEm: criadoEm.toISOString(),
    atualizadoEm: atualizadoEm.toISOString(),
  };
}

export function paraInteresse({
  carro,
  criadoEm,
  atualizadoEm,
  ...interesse
}: LinhaInteresse): Interesse {
  return {
    ...interesse,
    carro: { ...carro, capa: carro.capa && urlDaFoto(carro.capa) },
    criadoEm: criadoEm.toISOString(),
    atualizadoEm: atualizadoEm.toISOString(),
  };
}

export function paraDesejo({
  id,
  nome,
  anoMinimo,
  precoMaximo,
  observacoes,
  criadoEm,
  possiveis,
}: LinhaDesejo): Desejo {
  return {
    id,
    nome,
    anoMinimo,
    precoMaximo,
    observacoes,
    criadoEm: criadoEm.toISOString(),
    possiveis: possiveis.map((veiculo) => ({
      id: veiculo.id,
      marca: veiculo.marca,
      modelo: veiculo.modelo,
      versao: veiculo.versao,
      anoFabricacao: veiculo.anoFabricacao,
      anoModelo: veiculo.anoModelo,
      precoVenda: veiculo.precoVenda,
    })),
  };
}

export function paraClienteComDesejos({
  cliente,
  possivelDesde,
  desejos,
}: LinhaClienteComDesejos): ClienteComDesejos {
  return {
    cliente,
    possivelDesde: possivelDesde?.toISOString() ?? null,
    desejos: desejos.map(paraDesejo),
  };
}
