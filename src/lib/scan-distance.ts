import { mmParaPx } from './units';

/**
 * Distancia de leitura e tamanho minimo de modulo.
 *
 * Informacao que quase nenhum gerador da e que decide se o codigo funciona no
 * mundo fisico: um QR de 2 cm numa fachada nao le, e um modulo abaixo de 0,4 mm
 * some na impressao comum por espalhamento de tinta.
 */

/** Regra pratica da industria: distancia maxima ~= 10x o lado do codigo. */
export const RAZAO_DISTANCIA_LEITURA = 10;

/** Abaixo disso o modulo comeca a falhar em impressao comum. */
export const MODULO_MINIMO_MM = 0.4;

/** Lado inclui a quiet zone — e o que de fato vai para o papel. */
export function distanciaMaximaMm(ladoMm: number): number {
  return ladoMm * RAZAO_DISTANCIA_LEITURA;
}

export function ladoMinimoMm(distanciaMm: number): number {
  return distanciaMm / RAZAO_DISTANCIA_LEITURA;
}

export interface AvaliacaoImpressao {
  /** Lado de um modulo em milimetros. */
  readonly moduloMm: number;
  /** Lado de um modulo em pixels no DPI escolhido. */
  readonly moduloPx: number;
  readonly distanciaMaximaMm: number;
  /** O modulo alcanca o minimo de 0,4 mm? */
  readonly imprimivel: boolean;
  readonly aviso: string | null;
}

export function avaliarImpressao(params: {
  /** Lado total do codigo, com quiet zone, em milimetros. */
  ladoMm: number;
  /** Modulos por lado incluindo a quiet zone: `artefato.sizeComQuietZone`. */
  modulosComQuietZone: number;
  dpi: number;
}): AvaliacaoImpressao {
  const { ladoMm, modulosComQuietZone, dpi } = params;

  if (ladoMm <= 0 || modulosComQuietZone <= 0 || dpi <= 0) {
    throw new RangeError('Lado, contagem de modulos e DPI precisam ser positivos.');
  }

  const moduloMm = ladoMm / modulosComQuietZone;
  const moduloPx = mmParaPx(moduloMm, dpi);
  const imprimivel = moduloMm >= MODULO_MINIMO_MM;

  const aviso = imprimivel
    ? null
    : `Cada módulo tem ${moduloMm.toFixed(2).replace('.', ',')} mm, abaixo do mínimo de 0,4 mm. ` +
      `Aumente o lado para ao menos ${Math.ceil(modulosComQuietZone * MODULO_MINIMO_MM)} mm ou reduza o conteúdo.`;

  return {
    moduloMm,
    moduloPx,
    distanciaMaximaMm: distanciaMaximaMm(ladoMm),
    imprimivel,
    aviso,
  };
}

/** Frase pronta para a interface, na unidade que faz sentido para a escala. */
export function descreverDistancia(ladoMm: number): string {
  const maxima = distanciaMaximaMm(ladoMm);
  if (maxima >= 1000) {
    return `Lê até cerca de ${(maxima / 1000).toFixed(1).replace('.', ',')} m de distância.`;
  }
  return `Lê até cerca de ${Math.round(maxima / 10)} cm de distância.`;
}
