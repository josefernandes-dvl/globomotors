import type { CarroPainel, CarroPublico } from "@globomotors/shared";
import {
  formatarAnos,
  formatarKm,
  formatarPreco,
  formatarTelefone,
  tituloDoCarro,
} from "./formatacao.ts";

interface NomeDoCarro {
  marca: string;
  modelo: string;
  versao: string | null;
}

interface DadosDaLoja {
  nome: string;
  whatsapp: string | null;
}

function nomeCompleto(carro: NomeDoCarro) {
  return [tituloDoCarro(carro), carro.versao].filter(Boolean).join(" ");
}

export function linkWhatsApp(telefone: string, mensagem?: string) {
  const digitos = telefone.replace(/\D/g, "");
  const numero = digitos.length <= 11 ? `55${digitos}` : digitos;
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : "";
  return `https://wa.me/${numero}${texto}`;
}

export function linkDoCarro(slug: string, origem = window.location.origin) {
  return `${origem}/catalogo/${slug}`;
}

export function mensagemDeInteresse(carro: CarroPublico, link: string) {
  const nome = [nomeCompleto(carro), formatarAnos(carro)].filter(Boolean).join(" ");
  const cor = carro.cor ? `, cor ${carro.cor}` : "";
  return `Olá! Tenho interesse no ${nome}${cor}. Ainda está disponível?\n${link}`;
}

export function fichaDoCarro(carro: CarroPainel, loja: DadosDaLoja, link: string | null) {
  const anos = formatarAnos(carro);
  const km = formatarKm(carro.km);
  const linhas = [
    `🚗 *${nomeCompleto(carro)}*`,
    [anos && `📅 ${anos}`, km && `🛣️ ${km}`].filter(Boolean).join("  ·  "),
    [
      carro.cambio && `⚙️ ${carro.cambio}`,
      carro.combustivel && `⛽ ${carro.combustivel}`,
      carro.cor && `🎨 ${carro.cor}`,
    ]
      .filter(Boolean)
      .join("  ·  "),
    carro.motor ? `🔧 Motor ${carro.motor}` : "",
    `💰 *${formatarPreco(carro.precoVenda)}*`,
    carro.opcionais.length > 0 ? `✅ ${carro.opcionais.join(", ")}` : "",
  ].filter(Boolean);
  if (carro.descricao) linhas.push("", carro.descricao);
  if (link) linhas.push("", `🔗 ${link}`);
  const contato = loja.whatsapp ? ` · WhatsApp ${formatarTelefone(loja.whatsapp)}` : "";
  linhas.push("", `${loja.nome}${contato}`);
  return linhas.join("\n");
}
