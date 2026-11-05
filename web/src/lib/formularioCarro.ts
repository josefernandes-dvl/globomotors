import {
  CAMPOS_DA_IA,
  esquemaCores,
  esquemaOpcionais,
  hojeEmSaoPaulo,
  type CarroExtraido,
  type CarroPainel,
  type DadosCarro,
  type StatusCarro,
} from "@globomotors/shared";
import { formatarNumero, formatarReais, formatarTelefone } from "./formatacao.ts";

export interface ValoresCarro {
  marca: string;
  modelo: string;
  versao: string;
  anoFabricacao: string;
  anoModelo: string;
  km: string;
  cambio: string;
  combustivel: string;
  carroceria: string;
  cores: string[];
  motor: string;
  portas: string;
  opcionais: string[];
  descricao: string;
  precoVenda: string;
  destaque: boolean;
  status: StatusCarro;
  precoCompra: string;
  custoPreparacao: string;
  custoDocumentacao: string;
  custoComissao: string;
  precoMinimo: string;
  dataEntrada: string;
  placa: string;
  chassi: string;
  renavam: string;
  origem: string;
  vendedorNome: string;
  vendedorTelefone: string;
  observacoesInternas: string;
}

export function lerDinheiro(texto: string) {
  const limpo = texto.replace(/R\$|\s/g, "");
  if (limpo === "") return null;
  if (!/^[\d.,]+$/.test(limpo)) return Number.NaN;
  const decimal = /,\d{1,2}$/.test(limpo)
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo.replace(/[.,]/g, "");
  return Math.round(Number(decimal) * 100);
}

export function lerInteiro(texto: string) {
  const limpo = texto.trim();
  if (limpo === "") return null;
  if (!/^\d{1,3}(\.\d{3})+$|^\d+$/.test(limpo)) return Number.NaN;
  return Number(limpo.replace(/\./g, ""));
}

function texto(valor: string | number | null) {
  return valor === null ? "" : String(valor);
}

export function valoresDoCarro(carro?: Partial<CarroPainel>): ValoresCarro {
  return {
    marca: carro?.marca ?? "",
    modelo: carro?.modelo ?? "",
    versao: texto(carro?.versao ?? null),
    anoFabricacao: texto(carro?.anoFabricacao ?? null),
    anoModelo: texto(carro?.anoModelo ?? null),
    km: carro?.km == null ? "" : formatarNumero(carro.km),
    cambio: texto(carro?.cambio ?? null),
    combustivel: texto(carro?.combustivel ?? null),
    carroceria: texto(carro?.carroceria ?? null),
    cores: carro?.cores ?? [],
    motor: texto(carro?.motor ?? null),
    portas: texto(carro?.portas ?? null),
    opcionais: carro?.opcionais ?? [],
    descricao: texto(carro?.descricao ?? null),
    precoVenda: formatarReais(carro?.precoVenda ?? null),
    destaque: carro?.destaque ?? false,
    status: carro?.status ?? "rascunho",
    precoCompra: formatarReais(carro?.precoCompra ?? null),
    custoPreparacao: formatarReais(carro?.custoPreparacao ?? null),
    custoDocumentacao: formatarReais(carro?.custoDocumentacao ?? null),
    custoComissao: formatarReais(carro?.custoComissao ?? null),
    precoMinimo: formatarReais(carro?.precoMinimo ?? null),
    dataEntrada: carro?.dataEntrada ?? hojeEmSaoPaulo(),
    placa: texto(carro?.placa ?? null),
    chassi: texto(carro?.chassi ?? null),
    renavam: texto(carro?.renavam ?? null),
    origem: texto(carro?.origem ?? null),
    vendedorNome: texto(carro?.vendedorNome ?? null),
    vendedorTelefone: formatarTelefone(carro?.vendedorTelefone ?? ""),
    observacoesInternas: texto(carro?.observacoesInternas ?? null),
  };
}

export function valoresDaIa(atuais: ValoresCarro, carro: CarroExtraido): ValoresCarro {
  const lidos = valoresDoCarro(carro);
  const cores = esquemaCores.safeParse([...atuais.cores, ...(carro.cores ?? [])]);
  const opcionais = esquemaOpcionais.safeParse([...atuais.opcionais, ...(carro.opcionais ?? [])]);
  return {
    ...atuais,
    ...Object.fromEntries(
      CAMPOS_DA_IA.filter((campo) => carro[campo] !== undefined).map((campo) => [
        campo,
        lidos[campo],
      ]),
    ),
    cores: cores.success ? cores.data : atuais.cores,
    opcionais: opcionais.success ? opcionais.data : atuais.opcionais,
  };
}

export function paraDadosCarro(valores: ValoresCarro): DadosCarro {
  return {
    marca: valores.marca,
    modelo: valores.modelo,
    versao: valores.versao,
    anoFabricacao: lerInteiro(valores.anoFabricacao),
    anoModelo: lerInteiro(valores.anoModelo),
    km: lerInteiro(valores.km),
    cambio: valores.cambio,
    combustivel: valores.combustivel,
    carroceria: valores.carroceria,
    cores: valores.cores,
    motor: valores.motor,
    portas: lerInteiro(valores.portas),
    opcionais: valores.opcionais,
    descricao: valores.descricao,
    precoVenda: lerDinheiro(valores.precoVenda),
    destaque: valores.destaque,
    status: valores.status,
    precoCompra: lerDinheiro(valores.precoCompra),
    custoPreparacao: lerDinheiro(valores.custoPreparacao),
    custoDocumentacao: lerDinheiro(valores.custoDocumentacao),
    custoComissao: lerDinheiro(valores.custoComissao),
    precoMinimo: lerDinheiro(valores.precoMinimo),
    dataEntrada: valores.dataEntrada,
    placa: valores.placa,
    chassi: valores.chassi,
    renavam: valores.renavam,
    origem: valores.origem,
    vendedorNome: valores.vendedorNome,
    vendedorTelefone: valores.vendedorTelefone,
    observacoesInternas: valores.observacoesInternas,
  };
}
