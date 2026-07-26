import jsQR from 'jsqr';
import type { Bitmap } from '../render/raster';

/**
 * Decodificacao de volta.
 *
 * Isolado atras de uma interface por um motivo concreto: `jsqr` esta parado na
 * 1.4.0 ha anos. Se um dia precisar sair, trocar por `zxing-wasm` e reescrever
 * este arquivo, nada mais. Na investigacao os dois concordaram em 24 de 24
 * casos, e o WASM custava 440 KB gzip contra 56 KB — por isso o JS puro venceu.
 *
 * JS puro tambem e o que permite a suite de ida e volta rodar no Node, e esse
 * teste e o argumento central do produto.
 */
export interface Decodificador {
  readonly nome: string;
  decodificar(bitmap: Bitmap): string | null;
}

export const decodificadorJsQr: Decodificador = {
  nome: 'jsQR 1.4.0',
  decodificar(bitmap: Bitmap): string | null {
    /*
     * `dontInvert`: o produto avisa quando a polaridade esta invertida, entao
     * aceitar codigo invertido aqui esconderia justamente o problema que a
     * verificacao existe para revelar. Boa parte dos leitores de celular
     * tambem nao inverte.
     */
    const achado = jsQR(bitmap.data, bitmap.width, bitmap.height, { inversionAttempts: 'dontInvert' });
    return achado === null ? null : achado.data;
  },
};

/**
 * Pixels por modulo usados na rasterizacao de verificacao.
 *
 * Seis e folgado o bastante para nao introduzir falha propria de amostragem, e
 * baixo o bastante para a verificacao caber no tempo entre duas teclas
 * digitadas. A verificacao mede o desenho, nao a resolucao da exportacao.
 */
export const PX_POR_MODULO_VERIFICACAO = 6;

/** Escala em px/mm que da `pxPorModulo` pixels em cada modulo do codigo. */
export function escalaParaVerificacao(
  ladoDoCodigoMm: number,
  modulosComQuietZone: number,
  pxPorModulo: number = PX_POR_MODULO_VERIFICACAO,
): number {
  return (modulosComQuietZone * pxPorModulo) / ladoDoCodigoMm;
}
