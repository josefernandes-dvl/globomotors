interface AnosDoCarro {
  anoFabricacao: number | null;
  anoModelo: number | null;
}

interface ResumoDoCarro {
  km: number | null;
  cambio: string | null;
}

interface FichaDoCarro extends AnosDoCarro, ResumoDoCarro {
  combustivel: string | null;
  cor: string | null;
  motor: string | null;
  carroceria: string | null;
  portas: number | null;
}

const dinheiroSemCentavos = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const dinheiroComCentavos = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR");
const numeroComCentavos = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dataEmSaoPaulo = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatarDinheiro(centavos: number) {
  const formato = centavos % 100 === 0 ? dinheiroSemCentavos : dinheiroComCentavos;
  return formato.format(centavos / 100);
}

export function formatarPreco(centavos: number | null) {
  return centavos === null ? "Consulte" : formatarDinheiro(centavos);
}

export function formatarNumero(valor: number) {
  return numero.format(valor);
}

export function formatarReais(centavos: number | null) {
  if (centavos === null) return "";
  return (centavos % 100 === 0 ? numero : numeroComCentavos).format(centavos / 100);
}

export function formatarKm(km: number | null) {
  if (km === null) return null;
  return km === 0 ? "0 km" : `${numero.format(km)} km`;
}

export function formatarAnos({ anoFabricacao, anoModelo }: AnosDoCarro) {
  if (anoFabricacao !== null && anoModelo !== null && anoFabricacao !== anoModelo) {
    return `${anoFabricacao}/${anoModelo}`;
  }
  const ano = anoModelo ?? anoFabricacao;
  return ano === null ? null : String(ano);
}

export function tituloDoCarro(carro: { marca: string; modelo: string }) {
  return `${carro.marca} ${carro.modelo}`;
}

export function resumoDoCarro(carro: ResumoDoCarro) {
  return [formatarKm(carro.km), carro.cambio].filter(Boolean).join(" · ");
}

export function fichaTecnica(carro: FichaDoCarro) {
  const itens: [string, string | null][] = [
    ["Ano", formatarAnos(carro)],
    ["Quilometragem", formatarKm(carro.km)],
    ["Câmbio", carro.cambio],
    ["Combustível", carro.combustivel],
    ["Cor", carro.cor],
    ["Motor", carro.motor],
    ["Carroceria", carro.carroceria],
    ["Portas", carro.portas === null ? null : String(carro.portas)],
  ];
  return itens.flatMap(([rotulo, valor]) => (valor ? [{ rotulo, valor }] : []));
}

export function formatarData(valor: string | Date) {
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return dataEmSaoPaulo.format(new Date(valor));
}

export function formatarTelefone(telefone: string) {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length === 11)
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  if (digitos.length === 10)
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return telefone;
}

export function plural(quantidade: number, singular: string, varios: string) {
  return `${formatarNumero(quantidade)} ${quantidade === 1 ? singular : varios}`;
}
