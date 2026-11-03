import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrarNoDeploy, montarSaidaVercel } from "./saidaVercel.ts";

const raiz = fileURLToPath(new URL("../..", import.meta.url));

await montarSaidaVercel({
  pastaWeb: join(raiz, "web/dist"),
  pastaSaida: join(raiz, ".vercel/output"),
});
console.log("Saída da Vercel montada em .vercel/output.");

if (await migrarNoDeploy(process.env)) console.log("Migrations aplicadas no banco de produção.");
