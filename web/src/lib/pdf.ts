import { dataEmSaoPaulo, type CarroPublico, type LojaPublica } from "@globomotors/shared";
import type { jsPDF } from "jspdf";
import { api } from "./api.ts";
import { ordenarCarros } from "./catalogo.ts";
import { linkDoCarro, linkWhatsApp, mensagemDeInteresse } from "./compartilhamento.ts";
import {
  fichaTecnica,
  formatarAnos,
  formatarData,
  formatarKm,
  formatarPreco,
  formatarTelefone,
  plural,
  tituloDoCarro,
} from "./formatacao.ts";

type Cor = [number, number, number];

export interface ImagensDoCarro {
  capa: string | null;
  principal: string | null;
  miniaturas: string[];
}

export interface ImagensDoCatalogo {
  logo: string | null;
  emblema: string | null;
  carros: ImagensDoCarro[];
}

export interface DadosDoCatalogo {
  carros: CarroPublico[];
  loja: LojaPublica;
  geradoEm: Date;
  origem: string;
}

interface OpcoesDoDesenho {
  fundo?: string;
  conter?: boolean;
}

const CORES = {
  fundo: [10, 18, 32],
  topo: [13, 23, 41],
  cartao: [17, 28, 46],
  cartaoFoto: [22, 35, 58],
  linha: [34, 49, 75],
  prata: [230, 235, 242],
  suave: [143, 155, 174],
  azul: [111, 168, 240],
  acento: [47, 111, 192],
  verde: [31, 168, 85],
  vendido: [74, 85, 104],
  descricao: [200, 208, 220],
  branco: [255, 255, 255],
} satisfies Record<string, Cor>;

const MARGEM = 32;
const POR_PAGINA = 6;
const FOTOS_POR_CARRO = 5;
const CARACTERES_EXTRAS = new Set("–—‘’“”•…‹›€");

export function textoPdf(valor: string | null | undefined) {
  return [
    ...(valor ?? "")
      .normalize("NFC")
      .replace(/[\u2010-\u2012]/g, "-")
      .replace(/[\u00a0\u202f]/g, " "),
  ]
    .filter((caractere) => caractere.charCodeAt(0) <= 0xff || CARACTERES_EXTRAS.has(caractere))
    .join("")
    .replace(/\s+\n/g, "\n")
    .trim();
}

export function truncarLinhas(linhas: string[], maximo: number) {
  if (linhas.length <= maximo) return linhas;
  const visiveis = linhas.slice(0, Math.max(0, maximo));
  const ultima = visiveis.at(-1);
  if (ultima !== undefined) visiveis[visiveis.length - 1] = ultima.replace(/\s*\S*$/, "…");
  return visiveis;
}

export function nomeDoArquivoPdf(nomeDaLoja: string, geradoEm: Date) {
  const slug =
    nomeDaLoja
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "loja";
  return `catalogo-${slug}-${dataEmSaoPaulo(geradoEm)}.pdf`;
}

export function montarCatalogoPdf(
  JsPDF: typeof jsPDF,
  { carros, loja, geradoEm, origem }: DadosDoCatalogo,
  imagens: ImagensDoCatalogo,
) {
  const doc = new JsPDF({ unit: "pt", format: "a4", compress: true });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const larguraUtil = largura - 2 * MARGEM;
  const paginasDeGrade = Math.ceil(carros.length / POR_PAGINA);
  const paginaDaGrade = (indice: number) => 2 + Math.floor(indice / POR_PAGINA);
  const paginaDoCarro = (indice: number) => 2 + paginasDeGrade + indice;
  const dataDeGeracao = formatarData(geradoEm);
  const contato = textoPdf(
    [
      loja.whatsapp && `WhatsApp ${formatarTelefone(loja.whatsapp)}`,
      loja.instagram && `@${loja.instagram}`,
      loja.cidade,
    ]
      .filter(Boolean)
      .join("   •   "),
  );

  const preencher = (cor: Cor) => doc.setFillColor(...cor);
  const pintarTexto = (cor: Cor) => doc.setTextColor(...cor);
  const contornar = (cor: Cor) => doc.setDrawColor(...cor);
  const fonte = (tamanho: number, estilo: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", estilo);
    doc.setFontSize(tamanho);
  };
  const linhas = (texto: string, larguraMaxima: number) =>
    doc.splitTextToSize(texto, larguraMaxima) as string[];
  const primeiraLinha = (texto: string, larguraMaxima: number) =>
    linhas(texto, larguraMaxima)[0] ?? "";
  const centralizarEspacado = (texto: string, y: number, espaco: number) => {
    const larguraTexto = doc.getTextWidth(texto) + espaco * (texto.length - 1);
    doc.text(texto, (largura - larguraTexto) / 2, y, { charSpace: espaco });
  };
  const fundoDaPagina = () => {
    preencher(CORES.fundo);
    doc.rect(0, 0, largura, altura, "F");
  };
  const cabecalho = (textoDireita: string, paginaDoLink?: number) => {
    preencher(CORES.topo);
    doc.rect(0, 0, largura, 54, "F");
    contornar(CORES.linha);
    doc.setLineWidth(0.6);
    doc.line(0, 54, largura, 54);
    const recuo = imagens.emblema ? 42 : 0;
    if (imagens.emblema) doc.addImage(imagens.emblema, "JPEG", MARGEM, 11, 32, 32);
    fonte(13, "bold");
    pintarTexto(CORES.prata);
    doc.text(textoPdf(loja.nome).toUpperCase(), MARGEM + recuo, 26, { charSpace: 0.6 });
    fonte(7, "bold");
    pintarTexto(CORES.azul);
    doc.text("CATÁLOGO DE VEÍCULOS", MARGEM + recuo, 38, { charSpace: 1.6 });
    fonte(9, "bold");
    pintarTexto(paginaDoLink ? CORES.azul : CORES.suave);
    const larguraTexto = doc.getTextWidth(textoDireita);
    doc.text(textoDireita, largura - MARGEM - larguraTexto, 31);
    if (paginaDoLink) {
      doc.link(largura - MARGEM - larguraTexto - 6, 16, larguraTexto + 12, 24, {
        pageNumber: paginaDoLink,
      });
    }
  };
  const rodape = () => {
    contornar(CORES.linha);
    doc.setLineWidth(0.6);
    doc.line(MARGEM, altura - 34, largura - MARGEM, altura - 34);
    fonte(8);
    pintarTexto(CORES.suave);
    doc.text(contato || textoPdf(loja.nome), MARGEM, altura - 20);
    doc.text(`Gerado em ${dataDeGeracao}`, largura - MARGEM, altura - 20, { align: "right" });
  };
  const etiqueta = (x: number, y: number, texto: string, fundo: Cor) => {
    fonte(7, "bold");
    const larguraTexto = doc.getTextWidth(texto) + texto.length * 0.8;
    preencher(fundo);
    doc.roundedRect(x, y, larguraTexto + 12, 15, 3, 3, "F");
    pintarTexto(CORES.branco);
    doc.text(texto, x + 6, y + 10.4, { charSpace: 0.8 });
  };
  const etiquetaDoStatus = (carro: CarroPublico, x: number, y: number, comDestaque: boolean) => {
    if (carro.status === "vendido") etiqueta(x, y, "VENDIDO", CORES.vendido);
    else if (comDestaque && carro.destaque) etiqueta(x, y, "DESTAQUE", CORES.acento);
  };
  const foto = (imagem: string | null, x: number, y: number, w: number, h: number) => {
    if (imagem) {
      doc.addImage(imagem, "JPEG", x, y, w, h);
      return;
    }
    preencher(CORES.cartaoFoto);
    doc.rect(x, y, w, h, "F");
    fonte(9);
    pintarTexto(CORES.suave);
    doc.text("Sem foto", x + w / 2, y + h / 2 + 3, { align: "center" });
  };

  fundoDaPagina();
  const larguraLogo = 340;
  const alturaLogo = (larguraLogo * 647) / 760;
  if (imagens.logo) {
    doc.addImage(imagens.logo, "JPEG", (largura - larguraLogo) / 2, 120, larguraLogo, alturaLogo);
  } else {
    fonte(40, "bold");
    pintarTexto(CORES.prata);
    doc.text(textoPdf(loja.nome).toUpperCase(), largura / 2, 300, { align: "center" });
  }
  let y = 120 + alturaLogo + 34;
  fonte(10, "bold");
  pintarTexto(CORES.azul);
  centralizarEspacado("CATÁLOGO DE VEÍCULOS", y, 3);
  y += 34;
  fonte(26, "bold");
  pintarTexto(CORES.prata);
  const disponiveis = carros.filter((carro) => carro.status === "disponivel").length;
  doc.text(plural(disponiveis, "veículo disponível", "veículos disponíveis"), largura / 2, y, {
    align: "center",
  });
  if (loja.slogan) {
    y += 22;
    fonte(11);
    pintarTexto(CORES.suave);
    doc.text(linhas(textoPdf(loja.slogan), largura - 160), largura / 2, y, { align: "center" });
  }
  y += 42;
  preencher(CORES.acento);
  doc.roundedRect((largura - 210) / 2, y, 210, 40, 8, 8, "F");
  fonte(11, "bold");
  pintarTexto(CORES.branco);
  centralizarEspacado("VER OS VEÍCULOS  ›", y + 25, 1);
  doc.link((largura - 210) / 2, y, 210, 40, { pageNumber: 2 });
  y += 60;
  fonte(9);
  pintarTexto(CORES.suave);
  doc.text("Toque em um veículo para ver fotos, ficha completa e preço.", largura / 2, y, {
    align: "center",
  });
  if (contato) {
    fonte(10, "bold");
    pintarTexto(CORES.prata);
    doc.text(contato, largura / 2, altura - 70, { align: "center" });
    if (loja.whatsapp) {
      const larguraContato = doc.getTextWidth(contato);
      doc.link((largura - larguraContato) / 2, altura - 84, larguraContato, 20, {
        url: linkWhatsApp(loja.whatsapp),
      });
    }
  }
  fonte(8);
  pintarTexto(CORES.suave);
  doc.text(`Atualizado em ${dataDeGeracao}`, largura / 2, altura - 48, { align: "center" });

  const espaco = 16;
  const larguraCartao = (larguraUtil - espaco) / 2;
  const topoDaGrade = 74;
  const alturaCartao = (altura - 46 - topoDaGrade - 2 * espaco) / 3;
  const alturaCapa = ((larguraCartao * 11) / 16) * 0.86;
  for (let pagina = 0; pagina < paginasDeGrade; pagina++) {
    doc.addPage();
    fundoDaPagina();
    cabecalho(`Página ${pagina + 1} de ${paginasDeGrade}`);
    carros.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).forEach((carro, posicao) => {
      const indice = pagina * POR_PAGINA + posicao;
      const x = MARGEM + (posicao % 2) * (larguraCartao + espaco);
      const topo = topoDaGrade + Math.floor(posicao / 2) * (alturaCartao + espaco);
      preencher(CORES.cartao);
      contornar(CORES.linha);
      doc.setLineWidth(0.6);
      doc.roundedRect(x, topo, larguraCartao, alturaCartao, 8, 8, "FD");
      foto(imagens.carros[indice]?.capa ?? null, x + 1, topo + 1, larguraCartao - 2, alturaCapa);
      etiquetaDoStatus(carro, x + 10, topo + 10, true);
      let linhaY = topo + alturaCapa + 20;
      fonte(12.5, "bold");
      pintarTexto(CORES.prata);
      doc.text(
        primeiraLinha(textoPdf(tituloDoCarro(carro)).toUpperCase(), larguraCartao - 24),
        x + 12,
        linhaY,
      );
      if (carro.versao) {
        linhaY += 13;
        fonte(9);
        pintarTexto(CORES.suave);
        doc.text(primeiraLinha(textoPdf(carro.versao), larguraCartao - 24), x + 12, linhaY);
      }
      linhaY += 14;
      fonte(8.5);
      pintarTexto(CORES.prata);
      const resumo = [formatarAnos(carro), formatarKm(carro.km), carro.cambio, carro.combustivel];
      doc.text(
        primeiraLinha(textoPdf(resumo.filter(Boolean).join("  •  ")), larguraCartao - 24),
        x + 12,
        linhaY,
      );
      fonte(8, "bold");
      pintarTexto(CORES.azul);
      const chamada = carro.preco === null ? "VER DETALHES  ›" : "VER DETALHES E PREÇO  ›";
      doc.text(chamada, x + 12, topo + alturaCartao - 12, { charSpace: 0.8 });
      doc.link(x, topo, larguraCartao, alturaCartao, { pageNumber: paginaDoCarro(indice) });
    });
    rodape();
  }

  carros.forEach((carro, indice) => {
    const fotos = imagens.carros[indice] ?? { capa: null, principal: null, miniaturas: [] };
    doc.addPage();
    fundoDaPagina();
    cabecalho("‹  VOLTAR AO CATÁLOGO", paginaDaGrade(indice));
    let y = 70;
    const alturaFoto = fotos.miniaturas.length > 0 ? 270 : 300;
    foto(fotos.principal, MARGEM, y, larguraUtil, alturaFoto);
    etiquetaDoStatus(carro, MARGEM + 12, y + 12, false);
    y += alturaFoto;
    if (fotos.miniaturas.length > 0) {
      y += 8;
      const larguraMiniatura = (larguraUtil - 3 * 8) / 4;
      const alturaMiniatura = (larguraMiniatura * 3) / 4;
      fotos.miniaturas.slice(0, 4).forEach((miniatura, posicao) => {
        const x = MARGEM + posicao * (larguraMiniatura + 8);
        doc.addImage(miniatura, "JPEG", x, y, larguraMiniatura, alturaMiniatura);
      });
      y += alturaMiniatura;
    }
    y += 38;
    fonte(22, "bold");
    pintarTexto(CORES.prata);
    const titulo = linhas(textoPdf(tituloDoCarro(carro)).toUpperCase(), larguraUtil * 0.62);
    doc.text(titulo, MARGEM, y);
    fonte(9, "bold");
    pintarTexto(CORES.suave);
    doc.text("PREÇO", largura - MARGEM, y - 20, { align: "right", charSpace: 1.4 });
    fonte(24, "bold");
    pintarTexto(CORES.azul);
    doc.text(textoPdf(formatarPreco(carro.preco)), largura - MARGEM, y + 2, { align: "right" });
    y += (titulo.length - 1) * 24;
    if (carro.versao) {
      y += 16;
      fonte(11);
      pintarTexto(CORES.suave);
      doc.text(primeiraLinha(textoPdf(carro.versao), larguraUtil * 0.62), MARGEM, y);
    }
    const ficha = fichaTecnica(carro);
    if (ficha.length > 0) {
      y += 18;
      const larguraCaixa = (larguraUtil - 3 * 6) / 4;
      ficha.forEach(({ rotulo, valor }, posicao) => {
        const x = MARGEM + (posicao % 4) * (larguraCaixa + 6);
        const topo = y + Math.floor(posicao / 4) * 44;
        preencher(CORES.cartao);
        contornar(CORES.linha);
        doc.roundedRect(x, topo, larguraCaixa, 38, 5, 5, "FD");
        fonte(6.5, "bold");
        pintarTexto(CORES.suave);
        doc.text(rotulo.toUpperCase(), x + 9, topo + 14, { charSpace: 1 });
        fonte(10.5, "bold");
        pintarTexto(CORES.prata);
        doc.text(primeiraLinha(textoPdf(valor), larguraCaixa - 16), x + 9, topo + 29);
      });
      y += Math.ceil(ficha.length / 4) * 44;
    }
    const whatsapp = carro.status === "vendido" ? null : loja.whatsapp;
    const limite = whatsapp ? altura - 104 : altura - 50;
    if (carro.opcionais.length > 0 && y < limite - 30) {
      y += 18;
      fonte(7.5, "bold");
      pintarTexto(CORES.azul);
      doc.text("POSSUI:", MARGEM, y, { charSpace: 1.4 });
      y += 13;
      fonte(9.5);
      pintarTexto(CORES.prata);
      const opcionais = linhas(textoPdf(carro.opcionais.join("   •   ")), larguraUtil);
      const maximo = Math.min(3, Math.max(1, Math.floor((limite - y - 20) / 13)));
      doc.text(opcionais.slice(0, maximo), MARGEM, y);
      y += (Math.min(maximo, opcionais.length) - 1) * 13;
    }
    if (carro.descricao && y < limite - 30) {
      y += 22;
      fonte(7.5, "bold");
      pintarTexto(CORES.azul);
      doc.text("SOBRE O VEÍCULO", MARGEM, y, { charSpace: 1.4 });
      y += 14;
      fonte(10);
      pintarTexto(CORES.descricao);
      const descricao = truncarLinhas(
        linhas(textoPdf(carro.descricao), larguraUtil),
        Math.floor((limite - y) / 13.5),
      );
      doc.text(descricao, MARGEM, y, { lineHeightFactor: 1.35 });
    }
    if (whatsapp) {
      const topo = altura - 90;
      preencher(CORES.verde);
      doc.roundedRect(MARGEM, topo, larguraUtil, 36, 8, 8, "F");
      fonte(11.5, "bold");
      pintarTexto(CORES.branco);
      centralizarEspacado("TENHO INTERESSE: CHAMAR NO WHATSAPP", topo + 22.5, 0.6);
      doc.link(MARGEM, topo, larguraUtil, 36, {
        url: linkWhatsApp(whatsapp, mensagemDeInteresse(carro, linkDoCarro(carro.slug, origem))),
      });
    }
    rodape();
  });

  return doc;
}

async function carregarImagem(url: string) {
  const imagem = new Image();
  imagem.src = url;
  await imagem.decode();
  return imagem;
}

function desenharJpeg(
  imagem: HTMLImageElement,
  proporcao: number,
  larguraFinal: number,
  qualidade: number,
  { fundo = "#0A1220", conter = false }: OpcoesDoDesenho = {},
) {
  const alturaFinal = Math.round(larguraFinal / proporcao);
  const tela = document.createElement("canvas");
  tela.width = larguraFinal;
  tela.height = alturaFinal;
  const contexto = tela.getContext("2d");
  if (!contexto) return null;
  contexto.fillStyle = fundo;
  contexto.fillRect(0, 0, larguraFinal, alturaFinal);
  const { naturalWidth: largura, naturalHeight: altura } = imagem;
  if (conter) {
    const escala = Math.min(larguraFinal / largura, alturaFinal / altura);
    const [w, h] = [largura * escala, altura * escala];
    contexto.drawImage(imagem, (larguraFinal - w) / 2, (alturaFinal - h) / 2, w, h);
  } else {
    const recorteLargura = Math.min(largura, altura * proporcao);
    const recorteAltura = Math.min(altura, largura / proporcao);
    contexto.drawImage(
      imagem,
      (largura - recorteLargura) / 2,
      (altura - recorteAltura) / 2,
      recorteLargura,
      recorteAltura,
      0,
      0,
      larguraFinal,
      alturaFinal,
    );
  }
  return tela.toDataURL("image/jpeg", qualidade);
}

async function imagensDoCarro(carro: CarroPublico): Promise<ImagensDoCarro> {
  const [primeira, ...outras] = await Promise.all(
    carro.fotos.slice(0, FOTOS_POR_CARRO).map((item) => carregarImagem(item.url).catch(() => null)),
  );
  return {
    capa: primeira ? desenharJpeg(primeira, 16 / 11, 700, 0.78) : null,
    principal: primeira ? desenharJpeg(primeira, 531 / 300, 1200, 0.82, { conter: true }) : null,
    miniaturas: outras.flatMap((imagem) => {
      const jpeg = imagem && desenharJpeg(imagem, 4 / 3, 420, 0.76);
      return jpeg ? [jpeg] : [];
    }),
  };
}

async function marcaDaLoja(url: string, proporcao: number, larguraFinal: number, fundo: string) {
  const imagem = await carregarImagem(url).catch(() => null);
  return imagem && desenharJpeg(imagem, proporcao, larguraFinal, 0.9, { fundo, conter: true });
}

export async function gerarCatalogoPdf(origem = window.location.origin) {
  const [{ carros }, { loja }, { jsPDF }] = await Promise.all([
    api.get<{ carros: CarroPublico[] }>("/showroom/cars"),
    api.get<{ loja: LojaPublica }>("/showroom/store"),
    import("jspdf"),
  ]);
  if (carros.length === 0) throw new Error("Não há carros publicados no catálogo para exportar.");
  const ordenados = ordenarCarros(carros, "destaque", (carro) => carro.preco);
  const [logo, emblema, ...fotos] = await Promise.all([
    marcaDaLoja("/logo.webp", 760 / 647, 760, "#0A1220"),
    marcaDaLoja("/emblema.webp", 1, 160, "#0D1729"),
    ...ordenados.map(imagensDoCarro),
  ]);
  const geradoEm = new Date();
  return {
    documento: montarCatalogoPdf(
      jsPDF,
      { carros: ordenados, loja, geradoEm, origem },
      { logo, emblema, carros: fotos },
    ),
    nomeDoArquivo: nomeDoArquivoPdf(loja.nome, geradoEm),
  };
}
