import { Link } from "react-router";

export function PaginaNaoEncontrada() {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-md place-content-center gap-3 p-6 text-center">
      <img src="/emblema.webp" alt="" className="mx-auto size-16" />
      <h1 className="text-2xl font-extrabold font-stretch-[115%]">Página não encontrada</h1>
      <p className="text-suave">O endereço pode ter mudado ou o veículo já saiu do catálogo.</p>
      <Link to="/catalogo" className="botao botao-primario mx-auto">
        Ver os veículos
      </Link>
    </main>
  );
}
