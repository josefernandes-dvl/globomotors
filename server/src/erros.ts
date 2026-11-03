import type { CodigoErro, ErroDeCampo } from "@globomotors/shared";

export class ErroHttp extends Error {
  readonly status: number;
  readonly codigo: CodigoErro;
  readonly campos: ErroDeCampo[] | undefined;

  constructor(
    status: number,
    codigo: CodigoErro,
    mensagem: string,
    campos?: ErroDeCampo[],
    opcoes?: ErrorOptions,
  ) {
    super(mensagem, opcoes);
    this.name = "ErroHttp";
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}
