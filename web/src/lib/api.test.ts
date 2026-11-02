import { describe, expect, it, vi } from "vitest";
import { api, ErroApi } from "./api.ts";

function responderCom(resposta: Response) {
  const fetchFalso = vi.fn<typeof fetch>().mockResolvedValue(resposta);
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

describe("api", () => {
  it("faz GET no caminho com prefixo /api e devolve o JSON", async () => {
    const fetchFalso = responderCom(Response.json({ status: "ok", banco: "ok" }));

    await expect(api.get("/health")).resolves.toEqual({ status: "ok", banco: "ok" });
    expect(fetchFalso).toHaveBeenCalledWith("/api/health", {
      method: "GET",
      headers: undefined,
      body: undefined,
    });
  });

  it("envia o corpo como JSON", async () => {
    const fetchFalso = responderCom(Response.json({ id: "1" }, { status: 201 }));

    await expect(api.post("/dashboard/cars", { modelo: "Onix" })).resolves.toEqual({ id: "1" });
    expect(fetchFalso).toHaveBeenCalledWith("/api/dashboard/cars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelo: "Onix" }),
    });
  });

  it("envia arquivo como corpo binário, com o tipo do próprio arquivo", async () => {
    const fetchFalso = responderCom(Response.json({ foto: { id: "f1" } }, { status: 201 }));
    const foto = new Blob(["jpeg"], { type: "image/jpeg" });

    await api.post("/dashboard/cars/c1/photos", foto);

    expect(fetchFalso).toHaveBeenCalledWith("/api/dashboard/cars/c1/photos", {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: foto,
    });
  });

  it("devolve undefined quando a resposta é 204", async () => {
    responderCom(new Response(null, { status: 204 }));

    await expect(api.delete("/dashboard/cars/1")).resolves.toBeUndefined();
  });

  it("transforma o envelope de erro da API em ErroApi com código e campos", async () => {
    const campos = [{ campo: "preco", mensagem: "Obrigatório" }];
    responderCom(
      Response.json(
        { erro: { codigo: "validacao", mensagem: "Dados inválidos.", campos } },
        { status: 400 },
      ),
    );

    const erro = await api.patch("/dashboard/cars/1", {}).catch((motivo: unknown) => motivo);

    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({
      status: 400,
      codigo: "validacao",
      message: "Dados inválidos.",
      campos,
    });
  });

  it("usa mensagem genérica quando o erro não vem no envelope", async () => {
    responderCom(new Response("<html>Bad Gateway</html>", { status: 502 }));

    await expect(api.get("/health")).rejects.toMatchObject({
      status: 502,
      codigo: undefined,
      message: "O servidor não respondeu como esperado. Tente novamente.",
    });
  });

  it("avisa quando não há conexão com o servidor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(api.get("/health")).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("Sem conexão") as unknown,
    });
  });
});
