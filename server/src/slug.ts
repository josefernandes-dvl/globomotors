import { randomBytes } from "node:crypto";

export function gerarSlug(partes: (string | number | null)[]) {
  const base = partes
    .filter((parte) => parte !== null)
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return `${base || "carro"}-${randomBytes(3).toString("hex")}`;
}
