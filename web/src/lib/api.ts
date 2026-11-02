import { esquemaRespostaErro, type CodigoErro, type ErroDeCampo } from "@globomotors/shared";

export class ErroApi extends Error {
  readonly status: number;
  readonly codigo: CodigoErro | undefined;
  readonly campos: ErroDeCampo[];

  constructor(status: number, mensagem: string, codigo?: CodigoErro, campos: ErroDeCampo[] = []) {
    super(mensagem);
    this.name = "ErroApi";
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

function prepararCorpo(corpo: unknown) {
  if (corpo === undefined) return { headers: undefined, body: undefined };
  if (corpo instanceof Blob) return { headers: { "Content-Type": corpo.type }, body: corpo };
  return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) };
}

async function requisitar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`/api${caminho}`, { method: metodo, ...prepararCorpo(corpo) });
  } catch {
    throw new ErroApi(0, "Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  }

  if (resposta.status === 204) return undefined as T;
  const dados: unknown = await resposta.json().catch(() => undefined);
  if (resposta.ok) return dados as T;

  const envelope = esquemaRespostaErro.safeParse(dados);
  if (envelope.success) {
    const { mensagem, codigo, campos } = envelope.data.erro;
    throw new ErroApi(resposta.status, mensagem, codigo, campos);
  }
  throw new ErroApi(resposta.status, "O servidor não respondeu como esperado. Tente novamente.");
}

export const api = {
  get: <T>(caminho: string) => requisitar<T>("GET", caminho),
  post: <T>(caminho: string, corpo?: unknown) => requisitar<T>("POST", caminho, corpo),
  put: <T>(caminho: string, corpo?: unknown) => requisitar<T>("PUT", caminho, corpo),
  patch: <T>(caminho: string, corpo?: unknown) => requisitar<T>("PATCH", caminho, corpo),
  delete: <T>(caminho: string) => requisitar<T>("DELETE", caminho),
};
