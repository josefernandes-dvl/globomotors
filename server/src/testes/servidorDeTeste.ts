import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Express } from "express";

export async function iniciarServidorDeTeste(app: Express) {
  const servidor = app.listen(0);
  await once(servidor, "listening");
  const { port } = servidor.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    fechar: () =>
      new Promise<void>((resolve, reject) => {
        servidor.close((erro) => (erro ? reject(erro) : resolve()));
      }),
  };
}
