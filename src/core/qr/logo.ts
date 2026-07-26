import type { QrArtifact } from './types';

/**
 * Limites do logo central.
 *
 * O numero que o mercado repete — "com correcao H o logo pode cobrir 25% da
 * area" — nao passa em decodificador nenhum. Ele confunde 30% de recuperacao de
 * **codewords** com 30% de **area**, ignorando que uma oclusao central concentra
 * o dano em blocos contiguos.
 *
 * Medido com jsQR e ZXing, que concordaram em 24 de 24 casos:
 *
 *   nivel  10%   16%   20%   25%
 *   L       x     x     x     x
 *   M       v     x     x     x
 *   Q       v     x     x     x
 *   H       v     v     v     x
 *
 * Dai o teto de 16%: o limite real fica em 20%, e 16% deixa margem. Ainda
 * assim, quem decide e a verificacao de leitura sobre o desenho final — este
 * limite so evita que o usuario perca tempo numa configuracao condenada.
 *
 * IMPORTANTE: a area e relativa a **matriz**, nao ao artefato com a quiet zone.
 * Medir contra o lado total daria um logo maior do que o testado, porque a
 * quiet zone acrescenta 8 modulos que nao carregam dado nenhum.
 */
export const LIMITE_AREA_LOGO = 0.16;

/** Logo central so e viavel no nivel mais robusto. */
export const NIVEL_EXIGIDO_PARA_LOGO = 'H';

/** Lado da matriz em mm, descontada a quiet zone do lado total do codigo. */
export function ladoDaMatrizMm(artefato: QrArtifact, ladoDoCodigoMm: number): number {
  return (ladoDoCodigoMm * artefato.size) / artefato.sizeComQuietZone;
}

/** Maior lado de logo aceito, em mm. */
export function ladoMaximoDoLogoMm(artefato: QrArtifact, ladoDoCodigoMm: number): number {
  return Math.sqrt(LIMITE_AREA_LOGO) * ladoDaMatrizMm(artefato, ladoDoCodigoMm);
}

/** Fracao da area da matriz ocupada por um logo de lado `ladoLogoMm`. */
export function areaRelativaDoLogo(artefato: QrArtifact, ladoDoCodigoMm: number, ladoLogoMm: number): number {
  const lado = ladoDaMatrizMm(artefato, ladoDoCodigoMm);
  return (ladoLogoMm / lado) ** 2;
}

export type VeredictoLogo =
  | { readonly permitido: true }
  | { readonly permitido: false; readonly motivo: string; readonly sugestao: string };

export function avaliarLogo(artefato: QrArtifact, ladoDoCodigoMm: number, ladoLogoMm: number): VeredictoLogo {
  if (artefato.errorCorrection !== NIVEL_EXIGIDO_PARA_LOGO) {
    return {
      permitido: false,
      motivo: `Logo central exige correção H; a atual é ${artefato.errorCorrection}.`,
      sugestao: 'Mude o nível de correção para H antes de aplicar um logo.',
    };
  }

  const maximo = ladoMaximoDoLogoMm(artefato, ladoDoCodigoMm);

  /*
   * Compara lados, nao areas. Comparar areas obriga a elevar ao quadrado o que
   * saiu de uma raiz, e no limite exato o resultado vira 0.16000000000000003:
   * o logo de tamanho maximo seria recusado por erro de ponto flutuante. O
   * epsilon cobre o residuo de arredondamento que ainda sobra.
   */
  if (ladoLogoMm > maximo * (1 + 1e-9)) {
    const area = areaRelativaDoLogo(artefato, ladoDoCodigoMm, ladoLogoMm);

    /*
     * Trunca para baixo, nao arredonda. `toFixed` levaria 13,26 para "13,3",
     * e o valor sugerido passaria do proprio limite — a sugestao seria recusada
     * pela funcao que a produziu.
     */
    const sugerido = Math.floor(maximo * 10) / 10;

    return {
      permitido: false,
      motivo: `O logo ocupa ${Math.round(area * 100)}% da área do código, acima do limite de ${Math.round(LIMITE_AREA_LOGO * 100)}%.`,
      sugestao: `Reduza para no máximo ${sugerido.toFixed(1).replace('.', ',')} mm de lado.`,
    };
  }

  return { permitido: true };
}
