const formatoData = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dataEmSaoPaulo(data: Date) {
  return formatoData.format(data);
}

export function hojeEmSaoPaulo() {
  return dataEmSaoPaulo(new Date());
}

export function diasEntre(inicio: string, fim: string) {
  return Math.round((Date.parse(fim) - Date.parse(inicio)) / 86_400_000);
}
