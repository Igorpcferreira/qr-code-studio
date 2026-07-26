/**
 * Tipos para `qrcode` 1.5.4, que nao os publica.
 *
 * Escritos a mao em vez de instalar @types/qrcode porque as armadilhas desta
 * biblioteca estao exatamente na fronteira, e declarar o formato real e o que
 * impede de errar:
 *
 *   - `errorCorrectionLevel` volta como `{ bit: number }`, nao como a letra.
 *   - `modules.get()` recebe (linha, coluna) — nessa ordem — e devolve number.
 *
 * Somente a superficie que este projeto usa esta declarada. Se algo mais for
 * necessario, acrescente aqui em vez de recorrer a `any`.
 */
declare module 'qrcode' {
  export interface QrBitMatrix {
    /** Lado da matriz em modulos: 21 a 177. */
    readonly size: number;
    /** Dados em row-major: indice = linha * size + coluna. */
    readonly data: Uint8Array;
    /** ATENCAO: (linha, coluna), nao (x, y). Devolve 0 ou 1. */
    get(row: number, col: number): number;
  }

  export interface QrErrorCorrectionLevel {
    /** L=1, M=0, Q=3, H=2. Nao segue ordem alfabetica nem de robustez. */
    readonly bit: number;
  }

  /**
   * Um trecho do conteudo num unico modo de codificacao.
   *
   * A biblioteca quebra o texto em segmentos e escolhe o modo mais denso para
   * cada um — por isso um payload pode ocupar menos bits do que teria em modo
   * Byte puro. `getBitsLength()` conta so os dados: o indicador de modo e o de
   * contagem de caracteres ficam de fora e sao somados por quem monta a ficha.
   */
  export interface QrSegment {
    readonly mode: { readonly id: string };
    getBitsLength(): number;
  }

  export interface QrCodeData {
    readonly modules: QrBitMatrix;
    readonly version: number;
    readonly errorCorrectionLevel: QrErrorCorrectionLevel;
    readonly maskPattern: number;
    readonly segments: readonly QrSegment[];
  }

  export interface QrCreateOptions {
    version?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    maskPattern?: number;
  }

  export function create(text: string, options?: QrCreateOptions): QrCodeData;
}
