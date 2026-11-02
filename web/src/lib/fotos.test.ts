import { describe, expect, it, vi } from "vitest";
import { comprimirFoto, medidasReduzidas } from "./fotos.ts";

function simularImagem(largura: number, altura: number) {
  const fechar = vi.fn();
  const imagem: ImageBitmap = { width: largura, height: altura, close: fechar };
  vi.stubGlobal("createImageBitmap", vi.fn<typeof createImageBitmap>().mockResolvedValue(imagem));
  return { imagem, fechar };
}

function simularTela(blob: Blob | null) {
  const contexto = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    contexto as unknown as CanvasRenderingContext2D,
  );
  const gerarBlob = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((retorno) => {
      retorno(blob);
    });
  return { contexto, gerarBlob };
}

describe("medidasReduzidas", () => {
  it("reduz o lado maior para 1600 px mantendo a proporção", () => {
    expect(medidasReduzidas(4000, 3000)).toEqual({ largura: 1600, altura: 1200 });
    expect(medidasReduzidas(1080, 1920)).toEqual({ largura: 900, altura: 1600 });
  });

  it("não amplia foto menor que o limite", () => {
    expect(medidasReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 });
  });

  it("aceita outro limite e arredonda os pixels", () => {
    expect(medidasReduzidas(1000, 333, 300)).toEqual({ largura: 300, altura: 100 });
  });
});

describe("comprimirFoto", () => {
  it("reduz a foto, pinta fundo branco e gera JPEG com qualidade 0,82", async () => {
    const { imagem, fechar } = simularImagem(4000, 3000);
    const jpeg = new Blob(["jpeg"], { type: "image/jpeg" });
    const { contexto, gerarBlob } = simularTela(jpeg);

    await expect(comprimirFoto(new Blob(["png"], { type: "image/png" }))).resolves.toBe(jpeg);

    expect(contexto.fillStyle).toBe("#ffffff");
    expect(contexto.fillRect).toHaveBeenCalledWith(0, 0, 1600, 1200);
    expect(contexto.drawImage).toHaveBeenCalledWith(imagem, 0, 0, 1600, 1200);
    expect(fechar).toHaveBeenCalled();
    expect(gerarBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.82);
  });

  it("recusa arquivo que o navegador não consegue ler como imagem", async () => {
    const falha = new DOMException("The source image could not be decoded.");
    vi.stubGlobal("createImageBitmap", vi.fn<typeof createImageBitmap>().mockRejectedValue(falha));

    await expect(comprimirFoto(new Blob(["pdf"]))).rejects.toMatchObject({
      message: "Não foi possível ler esta imagem. Use JPG, PNG ou WebP.",
      cause: falha,
    });
  });

  it("avisa quando o navegador não oferece a tela de desenho e libera a imagem", async () => {
    const { fechar } = simularImagem(800, 600);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    await expect(comprimirFoto(new Blob(["png"]))).rejects.toThrow(
      "Seu navegador não conseguiu processar a foto.",
    );
    expect(fechar).toHaveBeenCalled();
  });

  it("avisa quando o navegador não gera o JPEG", async () => {
    simularImagem(800, 600);
    simularTela(null);

    await expect(comprimirFoto(new Blob(["png"]))).rejects.toThrow(
      "Seu navegador não conseguiu processar a foto.",
    );
  });
});
