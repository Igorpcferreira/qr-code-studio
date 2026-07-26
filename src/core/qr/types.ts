/** Niveis de correcao de erro do padrao QR, do menos ao mais robusto. */
export type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export const NIVEIS_CORRECAO = ['L', 'M', 'Q', 'H'] as const satisfies readonly ErrorCorrection[];

/** Fracao dos codewords que cada nivel consegue recuperar. Valores do padrao. */
export const RECUPERACAO_POR_NIVEL: Readonly<Record<ErrorCorrection, number>> = {
  L: 0.07,
  M: 0.15,
  Q: 0.25,
  H: 0.3,
};

/**
 * Zona de silencio, em modulos.
 *
 * Tipada como literal de proposito: o brief exige 4 modulos sempre, e zerar a
 * quiet zone e causa comum de falha de leitura. Aqui nao existe o parametro que
 * permitiria mudar isso — a regra e do compilador, nao de revisao de codigo.
 */
export const QUIET_ZONE = 4;
export type QuietZone = typeof QUIET_ZONE;

export const VERSAO_MINIMA = 1;
export const VERSAO_MAXIMA = 40;

/** Lado da matriz, em modulos, para uma versao. v1 = 21, v40 = 177. */
export function modulosDaVersao(versao: number): number {
  return versao * 4 + 17;
}

/** Versao correspondente a um lado em modulos. Inverso de `modulosDaVersao`. */
export function versaoDosModulos(modulos: number): number {
  return (modulos - 17) / 4;
}

/**
 * O artefato central: a matriz de modulos mais tudo que a ficha tecnica precisa.
 *
 * Todos os renderers (SVG, PNG, PDF) e a verificacao de leitura consomem isto e
 * nada mais — nenhum deles fala com a biblioteca `qrcode` diretamente.
 */
export interface QrArtifact {
  /**
   * Modulos em row-major: indice = y * size + x, valor 0 ou 1.
   *
   * Plana em vez de `boolean[][]` porque e percorrida em tres caminhos quentes
   * (gerar path, rasterizar para verificar, rasterizar para o teste de dano) e
   * numa versao 40 sao 31.329 celulas.
   */
  readonly data: Uint8Array;

  /** Lado em modulos, sem a quiet zone: 21 a 177. */
  readonly size: number;

  /** Lado em modulos, com a quiet zone dos dois lados: size + 8. */
  readonly sizeComQuietZone: number;

  readonly version: number;
  readonly errorCorrection: ErrorCorrection;
  readonly maskPattern: number;
  readonly quietZone: QuietZone;

  /** String efetivamente codificada. */
  readonly payload: string;

  /** Bytes UTF-8 do payload. */
  readonly byteLength: number;

  /** Teto de bytes desta versao neste nivel de correcao. */
  readonly capacityBytes: number;

  /** Modulo escuro? Fora dos limites devolve false (a quiet zone e clara). */
  isDark(x: number, y: number): boolean;
}
