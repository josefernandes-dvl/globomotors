import type { CodigoErro, ErroDeCampo } from "@globomotors/shared";

export class ErroHttp extends Error {
  readonly status: number;
  readonly codigo: CodigoErro;
  readonly campos: ErroDeCampo[] | undefined;

  constructor(status: number, codigo: CodigoErro, mensagem: string, campos?: ErroDeCampo[]) {
    super(mensagem);
    this.name = "ErroHttp";
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}
