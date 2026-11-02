const LADO_MAXIMO = 1600;
const QUALIDADE = 0.82;

export function medidasReduzidas(largura: number, altura: number, maximo = LADO_MAXIMO) {
  const escala = Math.min(1, maximo / Math.max(largura, altura));
  return { largura: Math.round(largura * escala), altura: Math.round(altura * escala) };
}

export async function comprimirFoto(arquivo: Blob) {
  let imagem: ImageBitmap;
  try {
    imagem = await createImageBitmap(arquivo);
  } catch (erro) {
    throw new Error("Não foi possível ler esta imagem. Use JPG, PNG ou WebP.", { cause: erro });
  }
  const { largura, altura } = medidasReduzidas(imagem.width, imagem.height);
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const contexto = tela.getContext("2d");
  if (!contexto) {
    imagem.close();
    throw new Error("Seu navegador não conseguiu processar a foto.");
  }
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, largura, altura);
  contexto.drawImage(imagem, 0, 0, largura, altura);
  imagem.close();
  return new Promise<Blob>((resolver, rejeitar) => {
    tela.toBlob(
      (blob) => {
        if (blob) resolver(blob);
        else rejeitar(new Error("Seu navegador não conseguiu processar a foto."));
      },
      "image/jpeg",
      QUALIDADE,
    );
  });
}
