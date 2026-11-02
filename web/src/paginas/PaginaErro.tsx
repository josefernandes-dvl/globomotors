export function PaginaErro() {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-md place-content-center gap-3 p-6 text-center">
      <img src="/emblema.webp" alt="" className="mx-auto size-16" />
      <h1 className="text-2xl font-extrabold font-stretch-[115%]">Algo deu errado</h1>
      <p className="text-suave">Recarregue a página para tentar de novo.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="botao botao-primario mx-auto"
      >
        Recarregar
      </button>
    </main>
  );
}
