import { ROTULOS_ORIGEM_CLIENTE } from "@globomotors/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { Link } from "react-router";
import { Icone } from "../../componentes/Icone.tsx";
import { linkWhatsApp } from "../../lib/compartilhamento.ts";
import { formatarData, formatarTelefone, plural } from "../../lib/formatacao.ts";
import { consultaClientes } from "../../lib/painel.ts";
import { CaixaVazia, CarregandoPainel, ErroAoCarregar, PaginaDoPainel } from "./PartesDoPainel.tsx";

export function PaginaClientes() {
  const [busca, setBusca] = useState("");
  const termo = useDeferredValue(busca.trim());
  const clientes = useQuery({ ...consultaClientes(termo), placeholderData: keepPreviousData });
  const lista = clientes.data ?? [];
  const semCadastro = clientes.isSuccess && termo === "" && lista.length === 0;

  return (
    <PaginaDoPainel
      titulo="Clientes"
      acoes={
        <Link to="/dashboard/customers/new" className="botao botao-primario">
          <Icone nome="mais" />
          Novo cliente
        </Link>
      }
    >
      {!semCadastro && !clientes.isPending && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative block w-full max-w-md">
            <span className="sr-only">Buscar clientes</span>
            <Icone
              nome="busca"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave"
            />
            <input
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail"
              className="entrada pl-9"
            />
          </label>
          {clientes.isSuccess && (
            <span className="text-sm text-suave">
              {plural(lista.length, "cliente", "clientes")}
            </span>
          )}
        </div>
      )}

      {clientes.isPending ? (
        <CarregandoPainel />
      ) : clientes.isError ? (
        <ErroAoCarregar erro={clientes.error} onTentar={() => void clientes.refetch()} />
      ) : semCadastro ? (
        <CaixaVazia titulo="Nenhum cliente cadastrado">
          <p>Cadastre quem procurou a loja para acompanhar cada negociação no funil.</p>
          <Link to="/dashboard/customers/new" className="botao botao-primario mt-4">
            <Icone nome="mais" />
            Cadastrar cliente
          </Link>
        </CaixaVazia>
      ) : lista.length === 0 ? (
        <CaixaVazia titulo="Nenhum cliente encontrado">
          <p>Nenhum cliente corresponde a “{termo}”.</p>
        </CaixaVazia>
      ) : (
        <div
          className={`overflow-x-auto rounded-[14px] border border-linha bg-papel ${
            clientes.isPlaceholderData ? "opacity-60" : ""
          }`}
        >
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-linha bg-painel text-xs tracking-wider text-suave uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">Telefone</th>
                <th className="px-4 py-3 font-semibold">Origem</th>
                <th className="px-4 py-3 font-semibold">Interesses</th>
                <th className="px-4 py-3 font-semibold">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((cliente) => (
                <tr key={cliente.id} className="border-b border-linha last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      to={`/dashboard/customers/${cliente.id}`}
                      className="font-bold hover:text-acento"
                    >
                      {cliente.nome}
                    </Link>
                    {cliente.email && (
                      <span className="block text-xs text-suave">{cliente.email}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={linkWhatsApp(cliente.telefone)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 whitespace-nowrap text-whatsapp-forte"
                    >
                      <Icone nome="whatsapp" className="size-3.5" />
                      {formatarTelefone(cliente.telefone)}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    {cliente.origem ? ROTULOS_ORIGEM_CLIENTE[cliente.origem] : "Não informada"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {plural(cliente.interesses, "veículo", "veículos")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatarData(cliente.criadoEm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PaginaDoPainel>
  );
}
