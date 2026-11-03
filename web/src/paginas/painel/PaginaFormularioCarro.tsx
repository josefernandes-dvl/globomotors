import {
  calcularMargem,
  CAMBIOS,
  CARROCERIAS,
  COMBUSTIVEIS,
  diasEntre,
  errosDeCampo,
  esquemaCarro,
  esquemaOpcionais,
  esquemaPedidoIa,
  hojeEmSaoPaulo,
  MAX_FOTOS_POR_CARRO,
  ROTULOS_STATUS_CARRO,
  STATUS_CARRO,
  TIPOS_DE_FOTO,
  type CarroExtraido,
  type CarroPainel,
  type CarroValidado,
  type FotoCarro,
} from "@globomotors/shared";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { CampoAreaTexto, CampoMarcar, CampoSelecao, CampoTexto } from "../../componentes/Campo.tsx";
import { Icone } from "../../componentes/Icone.tsx";
import { api, ErroApi } from "../../lib/api.ts";
import { useAvisos } from "../../lib/avisos.ts";
import { formatarDinheiro, plural } from "../../lib/formatacao.ts";
import {
  lerDinheiro,
  paraDadosCarro,
  valoresDaIa,
  valoresDoCarro,
  type ValoresCarro,
} from "../../lib/formularioCarro.ts";
import {
  errosDaApi,
  errosPorCampo,
  mensagemDeErro,
  type ErrosDoFormulario,
} from "../../lib/formularios.ts";
import { comprimirFoto } from "../../lib/fotos.ts";
import { CHAVE_PAINEL, consultaCarroPainel } from "../../lib/painel.ts";
import { ListaDeInteresses } from "./ListaDeInteresses.tsx";
import { CaixaVazia, CarregandoPainel, ErroAoCarregar, PaginaDoPainel } from "./PartesDoPainel.tsx";

interface FotoDoFormulario {
  chave: string;
  url: string;
  id: string | null;
  arquivo: Blob | null;
}

interface Salvamento {
  id: string | null;
  dados: CarroValidado;
  fotos: FotoDoFormulario[];
  removidas: string[];
}

type CampoDeTexto = {
  [Campo in keyof ValoresCarro]: ValoresCarro[Campo] extends string ? Campo : never;
}[keyof ValoresCarro];

const CAIXA = "rounded-[14px] border p-4";
const SECAO = `${CAIXA} border-linha bg-painel`;
const SECAO_PRIVADA = `${CAIXA} border-dashed border-[#d9c38f] bg-[#fffaf0]`;
const TITULO_SECAO = "mb-3 text-base font-extrabold font-stretch-[112%]";
const GRADE = "grid grid-cols-2 gap-3 sm:grid-cols-6";
const ETIQUETA =
  "flex max-w-full items-center gap-1 rounded-2xl border border-linha bg-papel py-1 pr-1 pl-3 text-[13px] font-semibold";
const BOTAO_TIRAR =
  "grid size-6 flex-none cursor-pointer place-items-center rounded-full text-suave transition hover:bg-black/5 hover:text-perigo";

async function salvarCarro({ id, dados, fotos, removidas }: Salvamento) {
  const { carro } = id
    ? await api.put<{ carro: CarroPainel }>(`/dashboard/cars/${id}`, dados)
    : await api.post<{ carro: CarroPainel }>("/dashboard/cars", dados);
  const falhas: string[] = [];
  const apagadas = new Set<string>();
  for (const fotoId of removidas) {
    try {
      await api.delete(`/dashboard/cars/${carro.id}/photos/${fotoId}`);
      apagadas.add(fotoId);
    } catch (erro) {
      falhas.push(mensagemDeErro(erro));
    }
  }
  const ordem: string[] = [];
  const enviadas: string[] = [];
  for (const foto of fotos) {
    if (foto.id) {
      ordem.push(foto.id);
      continue;
    }
    if (!foto.arquivo) continue;
    try {
      const resposta = await api.post<{ foto: FotoCarro }>(
        `/dashboard/cars/${carro.id}/photos`,
        foto.arquivo,
      );
      ordem.push(resposta.foto.id);
      enviadas.push(resposta.foto.id);
    } catch (erro) {
      falhas.push(mensagemDeErro(erro));
    }
  }
  const noServidor = [
    ...carro.fotos.map((foto) => foto.id).filter((fotoId) => !apagadas.has(fotoId)),
    ...enviadas,
  ];
  if (falhas.length === 0 && ordem.join() !== noServidor.join()) {
    try {
      await api.patch(`/dashboard/cars/${carro.id}/photos`, { ordem });
    } catch (erro) {
      falhas.push(mensagemDeErro(erro));
    }
  }
  return { carro, falhas };
}

export function PaginaFormularioCarro() {
  const { id } = useParams();
  return id ? <EdicaoDoCarro id={id} /> : <FormularioCarro />;
}

function EdicaoDoCarro({ id }: { id: string }) {
  const consulta = useQuery(consultaCarroPainel(id));
  const naoExiste = consulta.error instanceof ErroApi && consulta.error.status === 404;
  if (consulta.data && !naoExiste) {
    const carro = consulta.data;
    return <FormularioCarro key={`${carro.id}:${carro.atualizadoEm}`} carro={carro} />;
  }
  if (consulta.isError) {
    return (
      <PaginaDoPainel titulo="Editar carro">
        {naoExiste ? (
          <CaixaVazia titulo="Carro não encontrado">
            <p>Ele pode ter sido excluído.</p>
            <Link to="/dashboard/cars" className="botao mt-4">
              Voltar ao catálogo
            </Link>
          </CaixaVazia>
        ) : (
          <ErroAoCarregar erro={consulta.error} onTentar={() => void consulta.refetch()} />
        )}
      </PaginaDoPainel>
    );
  }
  return (
    <PaginaDoPainel titulo="Editar carro">
      <CarregandoPainel />
    </PaginaDoPainel>
  );
}

function FormularioCarro({ carro }: { carro?: CarroPainel }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const [valores, setValores] = useState(() => valoresDoCarro(carro));
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const [fotos, setFotos] = useState<FotoDoFormulario[]>(() =>
    (carro?.fotos ?? []).map((foto) => ({
      chave: foto.id,
      url: foto.url,
      id: foto.id,
      arquivo: null,
    })),
  );
  const [removidas, setRemovidas] = useState<string[]>([]);
  const [processando, setProcessando] = useState(0);
  const lerComIa = useMutation({ mutationFn: lerCarroComIa });
  const urlsCriadas = useRef(new Set<string>());

  useEffect(() => {
    const urls = urlsCriadas.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const salvar = useMutation({
    mutationFn: salvarCarro,
    onSuccess: ({ carro: salvo, falhas }) => {
      void queryClient.invalidateQueries({ queryKey: CHAVE_PAINEL });
      if (falhas.length > 0) {
        avisar(`O carro foi salvo, mas houve um problema com as fotos: ${falhas[0]}`, "erro");
        void navigate(`/dashboard/cars/${salvo.id}`, { replace: true });
        return;
      }
      avisar(carro ? "Alterações salvas." : "Carro adicionado ao catálogo.");
      void navigate("/dashboard/cars");
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
      onChange: (evento: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setValores((atuais) => ({ ...atuais, [nome]: evento.target.value })),
    };
  }

  async function adicionarFotos(arquivos: File[]) {
    const vagas = MAX_FOTOS_POR_CARRO - fotos.length - processando;
    if (arquivos.length > vagas) {
      avisar(`Cada carro pode ter no máximo ${MAX_FOTOS_POR_CARRO} fotos.`, "erro");
    }
    const escolhidos = arquivos.slice(0, Math.max(0, vagas));
    setProcessando((atual) => atual + escolhidos.length);
    for (const arquivo of escolhidos) {
      try {
        const reduzida = await comprimirFoto(arquivo);
        const url = URL.createObjectURL(reduzida);
        urlsCriadas.current.add(url);
        setFotos((atuais) => [...atuais, { chave: url, url, id: null, arquivo: reduzida }]);
      } catch (erro) {
        avisar(`${arquivo.name}: ${mensagemDeErro(erro)}`, "erro");
      } finally {
        setProcessando((atual) => atual - 1);
      }
    }
  }

  function moverFoto(indice: number, destino: number) {
    setFotos((atuais) => {
      const copia = [...atuais];
      copia.splice(destino, 0, ...copia.splice(indice, 1));
      return copia;
    });
  }

  function removerFoto(indice: number) {
    const foto = fotos[indice];
    if (!foto) return;
    const { id } = foto;
    if (id) {
      setRemovidas((atuais) => [...atuais, id]);
    } else {
      URL.revokeObjectURL(foto.url);
      urlsCriadas.current.delete(foto.url);
    }
    setFotos((atuais) => atuais.filter((_, posicao) => posicao !== indice));
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const resultado = esquemaCarro.safeParse(paraDadosCarro(valores));
    if (!resultado.success) {
      setErros(errosPorCampo(errosDeCampo(resultado.error)));
      avisar("Confira os campos destacados.", "erro");
      return;
    }
    setErros({});
    salvar.mutate({ id: carro?.id ?? null, dados: resultado.data, fotos, removidas });
  }

  const custos = {
    precoVenda: lerDinheiro(valores.precoVenda),
    precoCompra: lerDinheiro(valores.precoCompra),
    custoPreparacao: lerDinheiro(valores.custoPreparacao),
    custoDocumentacao: lerDinheiro(valores.custoDocumentacao),
    custoComissao: lerDinheiro(valores.custoComissao),
  };
  const margem = Object.values(custos).some(Number.isNaN) ? null : calcularMargem(custos);
  const dias = /^\d{4}-\d{2}-\d{2}$/.test(valores.dataEntrada)
    ? diasEntre(valores.dataEntrada, hojeEmSaoPaulo())
    : null;
  const publicado = carro?.status === "disponivel";
  const ocupado = salvar.isPending || processando > 0 || lerComIa.isPending;

  return (
    <PaginaDoPainel
      titulo={carro ? "Editar carro" : "Novo carro"}
      acoes={
        carro &&
        publicado && (
          <a href={`/catalogo/${carro.slug}`} target="_blank" rel="noreferrer" className="botao">
            <Icone nome="externo" />
            Ver no catálogo
          </a>
        )
      }
    >
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-4">
          <PreenchimentoComIa
            ler={lerComIa}
            onPreencher={(lido) => {
              setValores((atuais) => valoresDaIa(atuais, lido));
              setErros({});
            }}
          />

          <GerenciadorDeFotos
            fotos={fotos}
            processando={processando}
            onAdicionar={(arquivos) => void adicionarFotos(arquivos)}
            onMover={moverFoto}
            onRemover={removerFoto}
          />

          <section className={SECAO}>
            <h2 className={TITULO_SECAO}>Veículo</h2>
            <div className={GRADE}>
              <CampoTexto rotulo="Marca *" className="sm:col-span-2" {...campo("marca")} />
              <CampoTexto rotulo="Modelo *" className="sm:col-span-2" {...campo("modelo")} />
              <CampoTexto rotulo="Versão" className="col-span-2" {...campo("versao")} />
              <CampoTexto
                rotulo="Ano de fabricação"
                inputMode="numeric"
                {...campo("anoFabricacao")}
              />
              <CampoTexto rotulo="Ano modelo" inputMode="numeric" {...campo("anoModelo")} />
              <CampoTexto rotulo="Quilometragem" inputMode="numeric" {...campo("km")} />
              <CampoSelecao rotulo="Câmbio" {...campo("cambio")}>
                <Opcoes valores={CAMBIOS} />
              </CampoSelecao>
              <CampoSelecao rotulo="Combustível" {...campo("combustivel")}>
                <Opcoes valores={COMBUSTIVEIS} />
              </CampoSelecao>
              <CampoSelecao rotulo="Carroceria" {...campo("carroceria")}>
                <Opcoes valores={CARROCERIAS} />
              </CampoSelecao>
              <CampoTexto rotulo="Cor" className="sm:col-span-2" {...campo("cor")} />
              <CampoTexto
                rotulo="Motor"
                className="sm:col-span-2"
                placeholder="1.0 Turbo"
                {...campo("motor")}
              />
              <CampoTexto
                rotulo="Portas"
                inputMode="numeric"
                className="sm:col-span-2"
                {...campo("portas")}
              />
            </div>
          </section>

          <section className={SECAO}>
            <h2 className={TITULO_SECAO}>Anúncio</h2>
            <div className={GRADE}>
              <CampoTexto
                rotulo="Preço de venda (R$)"
                inputMode="decimal"
                placeholder="89.900"
                dica="Em branco, o catálogo mostra “Consulte”."
                className="col-span-2"
                {...campo("precoVenda")}
              />
              <CampoSelecao rotulo="Status" className="col-span-2" {...campo("status")}>
                {STATUS_CARRO.map((status) => (
                  <option key={status} value={status}>
                    {ROTULOS_STATUS_CARRO[status]}
                  </option>
                ))}
              </CampoSelecao>
              <div className="col-span-2 flex items-end pb-2.5">
                <CampoMarcar
                  rotulo="Destaque no catálogo"
                  name="destaque"
                  checked={valores.destaque}
                  onChange={(evento) =>
                    setValores((atuais) => ({ ...atuais, destaque: evento.target.checked }))
                  }
                />
              </div>
              <CampoDeAdicionais
                itens={valores.opcionais}
                erro={erros.opcionais}
                onMudar={(opcionais) => setValores((atuais) => ({ ...atuais, opcionais }))}
              />
              <CampoAreaTexto
                rotulo="Descrição"
                className="col-span-2 sm:col-span-6"
                {...campo("descricao")}
              />
            </div>
          </section>

          <section className={SECAO_PRIVADA}>
            <h2 className="text-base font-extrabold font-stretch-[112%]">Só para você</h2>
            <p className="mt-0.5 mb-3 text-[13px] text-suave">
              Nada desta parte aparece no catálogo.
            </p>
            <div className={GRADE}>
              <fieldset className="col-span-2 rounded-xl border border-[#ecdcb4] bg-papel/70 p-3 sm:col-span-6">
                <legend className="float-left mb-2 w-full text-sm font-bold">Vendedor</legend>
                <div className="clear-left grid gap-3 sm:grid-cols-2">
                  <CampoTexto
                    rotulo="Nome"
                    placeholder="Loja ou pessoa que está vendendo"
                    {...campo("vendedorNome")}
                  />
                  <CampoTexto
                    rotulo="Telefone"
                    type="tel"
                    inputMode="tel"
                    placeholder="(11) 98765-4321"
                    {...campo("vendedorTelefone")}
                  />
                </div>
              </fieldset>
              <CampoTexto
                rotulo="Preço de compra (R$)"
                inputMode="decimal"
                className="col-span-2"
                {...campo("precoCompra")}
              />
              <CampoTexto
                rotulo="Preparação (R$)"
                inputMode="decimal"
                className="col-span-2"
                {...campo("custoPreparacao")}
              />
              <CampoTexto
                rotulo="Documentação (R$)"
                inputMode="decimal"
                className="col-span-2"
                {...campo("custoDocumentacao")}
              />
              <CampoTexto
                rotulo="Comissão (R$)"
                inputMode="decimal"
                className="col-span-2"
                {...campo("custoComissao")}
              />
              <CampoTexto
                rotulo="Preço mínimo (R$)"
                inputMode="decimal"
                className="col-span-2"
                {...campo("precoMinimo")}
              />
              <CampoTexto
                rotulo="Data de entrada"
                type="date"
                className="col-span-2"
                {...campo("dataEntrada")}
              />
              <CampoTexto
                rotulo="Placa"
                className="col-span-2"
                placeholder="ABC1D23"
                {...campo("placa")}
              />
              <CampoTexto rotulo="Chassi" className="col-span-2" {...campo("chassi")} />
              <CampoTexto
                rotulo="Renavam"
                inputMode="numeric"
                className="col-span-2"
                {...campo("renavam")}
              />
              <CampoTexto
                rotulo="Origem"
                placeholder="Troca, leilão, compra direta…"
                className="col-span-2 sm:col-span-6"
                {...campo("origem")}
              />
              <CampoAreaTexto
                rotulo="Observações internas"
                rows={3}
                className="col-span-2 sm:col-span-6"
                {...campo("observacoesInternas")}
              />
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex gap-1.5">
                <dt className="text-suave">Margem estimada:</dt>
                <dd
                  className={`font-bold tabular-nums ${margem !== null && margem < 0 ? "text-perigo" : ""}`}
                >
                  {margem === null ? "informe venda e compra" : formatarDinheiro(margem)}
                </dd>
              </div>
              {dias !== null && dias >= 0 && (
                <div className="flex gap-1.5">
                  <dt className="text-suave">Em estoque há:</dt>
                  <dd className="font-bold tabular-nums">{plural(dias, "dia", "dias")}</dd>
                </div>
              )}
            </dl>
          </section>

          <div className="flex flex-wrap justify-end gap-2">
            <Link to="/dashboard/cars" className="botao">
              Cancelar
            </Link>
            <button type="submit" disabled={ocupado} className="botao botao-primario">
              {salvar.isPending
                ? "Salvando…"
                : carro
                  ? "Salvar alterações"
                  : "Adicionar ao catálogo"}
            </button>
          </div>
        </form>

        <aside className={SECAO}>
          {carro ? (
            <ListaDeInteresses carroId={carro.id} />
          ) : (
            <p className="text-sm text-suave">
              Depois de salvar o carro, você pode registrar os clientes interessados nele.
            </p>
          )}
        </aside>
      </div>
    </PaginaDoPainel>
  );
}

function Opcoes({ valores }: { valores: readonly string[] }) {
  return (
    <>
      <option value="">Selecione</option>
      {valores.map((valor) => (
        <option key={valor} value={valor}>
          {valor}
        </option>
      ))}
    </>
  );
}

interface PropsAdicionais {
  itens: string[];
  erro: string | undefined;
  onMudar: (itens: string[]) => void;
}

function CampoDeAdicionais({ itens, erro, onMudar }: PropsAdicionais) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [novo, setNovo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const mensagem = aviso ?? erro;

  function adicionar() {
    entrada.current?.focus();
    const resultado = esquemaOpcionais.safeParse([...itens, novo]);
    if (!resultado.success) {
      setAviso(errosDeCampo(resultado.error)[0]?.mensagem ?? null);
      return;
    }
    if (resultado.data.length === itens.length) {
      setAviso(`“${novo.trim()}” já está na lista.`);
      return;
    }
    onMudar(resultado.data);
    setNovo("");
    setAviso(null);
  }

  function remover(item: string) {
    onMudar(itens.filter((atual) => atual !== item));
    setAviso(null);
  }

  return (
    <fieldset className="col-span-2 sm:col-span-6">
      <legend className="rotulo float-left mb-1.5 w-full">Adicionais</legend>
      <div className="clear-left flex flex-col gap-2">
        {itens.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {itens.map((item) => (
              <li key={item} className={ETIQUETA}>
                <span className="min-w-0 wrap-break-word">{item}</span>
                <button
                  type="button"
                  aria-label={`Remover ${item}`}
                  onClick={() => remover(item)}
                  className={BOTAO_TIRAR}
                >
                  <Icone nome="fechar" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            ref={entrada}
            aria-label="Novo adicional"
            placeholder="Ar-condicionado"
            enterKeyHint="enter"
            value={novo}
            onChange={(evento) => {
              setNovo(evento.target.value);
              setAviso(null);
            }}
            onKeyDown={(evento) => {
              if (evento.key !== "Enter") return;
              evento.preventDefault();
              if (novo.trim()) adicionar();
            }}
            aria-invalid={mensagem ? true : undefined}
            aria-describedby={mensagem ? `${id}-erro` : undefined}
            className="entrada min-w-0 flex-1"
          />
          <button
            type="button"
            disabled={!novo.trim()}
            onClick={adicionar}
            className="botao flex-none"
          >
            <Icone nome="mais" />
            Adicionar
          </button>
        </div>
        {mensagem && (
          <span id={`${id}-erro`} className="text-xs font-medium text-perigo">
            {mensagem}
          </span>
        )}
      </div>
    </fieldset>
  );
}

interface PedidoComIa {
  texto: string;
  imagens: File[];
}

async function lerCarroComIa({ texto, imagens }: PedidoComIa) {
  const formulario = new FormData();
  formulario.set("texto", texto);
  for (const imagem of imagens) {
    let reduzida: Blob;
    try {
      reduzida = await comprimirFoto(imagem);
    } catch (erro) {
      throw new Error(`${imagem.name}: ${mensagemDeErro(erro)}`, { cause: erro });
    }
    formulario.append("imagens", reduzida, imagem.name);
  }
  return api.post<{ carro: CarroExtraido }>("/dashboard/ai/extract-car", formulario);
}

interface PropsPreenchimento {
  ler: UseMutationResult<{ carro: CarroExtraido }, Error, PedidoComIa>;
  onPreencher: (carro: CarroExtraido) => void;
}

function PreenchimentoComIa({ ler, onPreencher }: PropsPreenchimento) {
  const avisar = useAvisos();
  const [texto, setTexto] = useState("");
  const [imagens, setImagens] = useState<File[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  function preencher() {
    const resultado = esquemaPedidoIa.safeParse({ texto, imagens: imagens.length });
    if (!resultado.success) {
      setErro(errosDeCampo(resultado.error)[0]?.mensagem ?? null);
      return;
    }
    setErro(null);
    ler.mutate(
      { texto: resultado.data.texto, imagens },
      {
        onSuccess: ({ carro }) => {
          const quantidade = Object.keys(carro).length;
          if (quantidade === 0) {
            setErro(
              "A IA não achou dados do carro. Escreva mais detalhes ou escolha outra imagem.",
            );
            return;
          }
          onPreencher(carro);
          avisar(
            `A IA preencheu ${plural(quantidade, "campo", "campos")}. Confira antes de salvar.`,
          );
        },
        onError: (falha) => {
          setErro(
            falha instanceof ErroApi && falha.status === 413
              ? "As imagens ficaram grandes demais. Escolha menos imagens."
              : mensagemDeErro(falha),
          );
        },
      },
    );
  }

  return (
    <section className={SECAO}>
      <h2 className="text-base font-extrabold font-stretch-[112%]">Preencher com IA</h2>
      <p className="mt-0.5 mb-3 text-[13px] text-suave">
        Cole o anúncio, a conversa ou as anotações do carro, ou escolha fotos dele e do documento. A
        IA escreve nos campos o que conseguir ler.
      </p>
      <CampoAreaTexto
        rotulo="Texto sobre o carro"
        placeholder="Onix LTZ 1.0 Turbo 2020/2021, 42 mil km, automático, R$ 89.900"
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value);
          setErro(null);
        }}
      />
      {imagens.length > 0 && (
        <ul aria-label="Imagens para a IA" className="mt-3 flex flex-wrap gap-1.5">
          {imagens.map((imagem, indice) => (
            <li key={`${indice}:${imagem.name}`} className={ETIQUETA}>
              <span className="min-w-0 truncate">{imagem.name}</span>
              <button
                type="button"
                aria-label={`Remover ${imagem.name}`}
                onClick={() => {
                  setImagens((atuais) => atuais.filter((_, posicao) => posicao !== indice));
                  setErro(null);
                }}
                className={BOTAO_TIRAR}
              >
                <Icone nome="fechar" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="botao has-focus-visible:outline-2 has-focus-visible:outline-acento">
          <Icone nome="foto" />
          Escolher imagens
          <input
            type="file"
            multiple
            accept={TIPOS_DE_FOTO.join(",")}
            onChange={(evento) => {
              const arquivos = [...(evento.target.files ?? [])];
              evento.target.value = "";
              setImagens((atuais) => [...atuais, ...arquivos]);
              setErro(null);
            }}
            className="sr-only"
          />
        </label>
        <button
          type="button"
          disabled={ler.isPending}
          onClick={preencher}
          className="botao botao-primario"
        >
          {ler.isPending ? "Lendo…" : "Preencher com IA"}
        </button>
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-sm font-medium text-perigo">
          {erro}
        </p>
      )}
    </section>
  );
}

interface PropsFotos {
  fotos: FotoDoFormulario[];
  processando: number;
  onAdicionar: (arquivos: File[]) => void;
  onMover: (indice: number, destino: number) => void;
  onRemover: (indice: number) => void;
}

function GerenciadorDeFotos({ fotos, processando, onAdicionar, onMover, onRemover }: PropsFotos) {
  const cheio = fotos.length + processando >= MAX_FOTOS_POR_CARRO;
  const botao =
    "grid size-7 cursor-pointer place-items-center rounded-md bg-black/60 text-white hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section className={SECAO}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-extrabold font-stretch-[112%]">Fotos</h2>
        <span className="text-xs text-suave tabular-nums">
          {fotos.length} de {MAX_FOTOS_POR_CARRO}
        </span>
      </div>
      <label
        onDragOver={(evento) => evento.preventDefault()}
        onDrop={(evento) => {
          evento.preventDefault();
          if (!cheio) onAdicionar([...evento.dataTransfer.files]);
        }}
        className={`flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-[#b5c0cf] bg-papel px-4 py-6 text-center ${
          cheio ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:border-acento"
        }`}
      >
        <Icone nome="foto" className="size-6 text-suave" />
        <span className="font-semibold">Adicionar fotos</span>
        <span className="text-xs text-suave">
          JPG, PNG ou WebP. Arraste ou clique. A primeira foto é a capa do anúncio.
        </span>
        <input
          type="file"
          multiple
          accept={TIPOS_DE_FOTO.join(",")}
          disabled={cheio}
          onChange={(evento) => {
            const arquivos = [...(evento.target.files ?? [])];
            evento.target.value = "";
            onAdicionar(arquivos);
          }}
          className="sr-only"
        />
      </label>
      {processando > 0 && (
        <p role="status" className="mt-2 text-sm text-suave">
          Preparando {plural(processando, "foto", "fotos")}…
        </p>
      )}
      {fotos.length > 0 && (
        <ol className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
          {fotos.map((foto, indice) => (
            <li
              key={foto.chave}
              className="relative overflow-hidden rounded-lg border border-linha bg-[#e2e7ee]"
            >
              <img
                src={foto.url}
                alt={`Foto ${indice + 1}`}
                className="aspect-4/3 w-full object-cover"
              />
              {indice === 0 && (
                <span className="absolute top-1 left-1 rounded bg-acento px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                  Capa
                </span>
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <span className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Mover foto ${indice + 1} para a esquerda`}
                    disabled={indice === 0}
                    onClick={() => onMover(indice, indice - 1)}
                    className={botao}
                  >
                    <Icone nome="esquerda" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Mover foto ${indice + 1} para a direita`}
                    disabled={indice === fotos.length - 1}
                    onClick={() => onMover(indice, indice + 1)}
                    className={botao}
                  >
                    <Icone nome="direita" />
                  </button>
                </span>
                <button
                  type="button"
                  aria-label={`Remover foto ${indice + 1}`}
                  onClick={() => onRemover(indice)}
                  className={botao}
                >
                  <Icone nome="fechar" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
