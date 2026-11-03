import { errosDeCampo, esquemaLoja, type Loja } from "@globomotors/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { CampoMarcar, CampoTexto } from "../../componentes/Campo.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { api } from "../../lib/api.ts";
import { useAvisos } from "../../lib/avisos.ts";
import { formatarTelefone } from "../../lib/formatacao.ts";
import {
  errosDaApi,
  errosPorCampo,
  mensagemDeErro,
  type ErrosDoFormulario,
} from "../../lib/formularios.ts";
import { CHAVE_PAINEL, consultaLojaPainel } from "../../lib/painel.ts";
import { CarregandoPainel, ErroAoCarregar, PaginaDoPainel } from "./PartesDoPainel.tsx";

interface ValoresLoja {
  nome: string;
  cidade: string;
  slogan: string;
  whatsapp: string;
  instagram: string;
  mostrarPreco: boolean;
  mostrarVendidos: boolean;
}

type CampoDeTexto = Exclude<keyof ValoresLoja, "mostrarPreco" | "mostrarVendidos">;

const SECAO = "rounded-[14px] border border-linha bg-painel p-4";

function valoresDaLoja(loja: Loja): ValoresLoja {
  return {
    nome: loja.nome,
    cidade: loja.cidade ?? "",
    slogan: loja.slogan ?? "",
    whatsapp: loja.whatsapp ? formatarTelefone(loja.whatsapp) : "",
    instagram: loja.instagram ? `@${loja.instagram}` : "",
    mostrarPreco: loja.mostrarPreco,
    mostrarVendidos: loja.mostrarVendidos,
  };
}

export function PaginaLoja() {
  const loja = useQuery(consultaLojaPainel);
  return (
    <PaginaDoPainel titulo="Dados da loja">
      {loja.data ? (
        <FormularioLoja loja={loja.data} />
      ) : loja.isError ? (
        <ErroAoCarregar erro={loja.error} onTentar={() => void loja.refetch()} />
      ) : (
        <CarregandoPainel />
      )}
    </PaginaDoPainel>
  );
}

function FormularioLoja({ loja }: { loja: Loja }) {
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const [valores, setValores] = useState(() => valoresDaLoja(loja));
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const linkDoCatalogo = `${window.location.origin}/catalogo`;

  const salvar = useMutation({
    mutationFn: (dados: Loja) => api.put<{ loja: Loja }>("/dashboard/store", dados),
    onSuccess: ({ loja: salva }) => {
      queryClient.setQueryData(consultaLojaPainel.queryKey, salva);
      void queryClient.invalidateQueries({ queryKey: CHAVE_PAINEL });
      void queryClient.invalidateQueries({ queryKey: ["vitrine"] });
      setValores(valoresDaLoja(salva));
      avisar("Dados da loja salvos.");
    },
    onError: (erro) => {
      setErros(errosDaApi(erro));
      avisar(mensagemDeErro(erro), "erro");
    },
  });

  function campo(nome: CampoDeTexto) {
    return {
      name: nome,
      value: valores[nome],
      erro: erros[nome],
      onChange: (evento: ChangeEvent<HTMLInputElement>) =>
        setValores((atuais) => ({ ...atuais, [nome]: evento.target.value })),
    };
  }

  function marcar(nome: "mostrarPreco" | "mostrarVendidos") {
    return {
      name: nome,
      checked: valores[nome],
      onChange: (evento: ChangeEvent<HTMLInputElement>) =>
        setValores((atuais) => ({ ...atuais, [nome]: evento.target.checked })),
    };
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const resultado = esquemaLoja.safeParse(valores);
    if (!resultado.success) {
      setErros(errosPorCampo(errosDeCampo(resultado.error)));
      avisar("Confira os campos destacados.", "erro");
      return;
    }
    setErros({});
    salvar.mutate(resultado.data);
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkDoCatalogo);
      avisar("Link do catálogo copiado.");
    } catch {
      avisar("Não foi possível copiar. Selecione o link e copie manualmente.", "erro");
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <form noValidate onSubmit={aoEnviar} className={`${SECAO} flex flex-col gap-4`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoTexto rotulo="Nome da loja *" maxLength={60} {...campo("nome")} />
          <CampoTexto
            rotulo="Cidade"
            maxLength={60}
            placeholder="São Paulo, SP"
            {...campo("cidade")}
          />
          <CampoTexto
            rotulo="Slogan"
            maxLength={140}
            dica="Aparece no topo da página inicial."
            className="sm:col-span-2"
            {...campo("slogan")}
          />
          <CampoTexto
            rotulo="WhatsApp da loja"
            type="tel"
            inputMode="tel"
            placeholder="(11) 98765-4321"
            dica="Recebe as mensagens dos clientes que clicam em “Tenho interesse”."
            {...campo("whatsapp")}
          />
          <CampoTexto rotulo="Instagram" placeholder="@globomotors" {...campo("instagram")} />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="rotulo mb-1">Catálogo</legend>
          <CampoMarcar rotulo="Mostrar preços no catálogo" {...marcar("mostrarPreco")} />
          <p className="-mt-1 ml-6 text-xs text-suave">
            Desmarcado, o catálogo mostra “Consulte” e o preço não sai do servidor.
          </p>
          <CampoMarcar
            rotulo="Mostrar carros vendidos no catálogo"
            {...marcar("mostrarVendidos")}
          />
        </fieldset>
        <div className="flex justify-end">
          <button type="submit" disabled={salvar.isPending} className="botao botao-primario">
            {salvar.isPending ? "Salvando…" : "Salvar dados da loja"}
          </button>
        </div>
      </form>

      <aside className={`${SECAO} flex flex-col gap-3`}>
        <h2 className="text-base font-extrabold font-stretch-[112%]">Link do catálogo</h2>
        <p className="text-sm text-suave">
          É este o endereço que você divulga. Quem abre vê só o catálogo: carros publicados, sem
          acesso ao painel.
        </p>
        <a
          href={linkDoCatalogo}
          target="_blank"
          rel="noreferrer"
          className="truncate rounded-lg border border-linha bg-papel px-3 py-2 text-sm font-semibold text-acento"
        >
          {linkDoCatalogo}
        </a>
        <button type="button" onClick={() => void copiarLink()} className="botao">
          <Icone nome="copiar" />
          Copiar link
        </button>
      </aside>
    </div>
  );
}
