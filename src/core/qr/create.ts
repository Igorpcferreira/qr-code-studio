import { create as criarQrCru } from 'qrcode';
import type { QrSegment } from 'qrcode';
import { capacidadeBytes, codewordsDeDados, melhorNivelPara } from './capacity';
import type { ErrorCorrection, QrArtifact } from './types';
import { QUIET_ZONE } from './types';

/**
 * `create()` devolve o nivel como `{ bit }`, e a numeracao nao segue nem ordem
 * alfabetica nem ordem de robustez. Verificado contra a propria biblioteca em
 * tests/unit/core/qr/create.test.ts — nao reescreva de memoria.
 */
const NIVEL_POR_BIT: Readonly<Record<number, ErrorCorrection>> = {
  1: 'L',
  0: 'M',
  3: 'Q',
  2: 'H',
};

export type ErroCriacao =
  | { readonly tipo: 'vazio' }
  | {
      readonly tipo: 'excede-capacidade';
      readonly bytes: number;
      readonly capacidade: number;
      readonly nivel: ErrorCorrection;
      /** Nivel mais robusto em que o conteudo caberia, se houver. */
      readonly sugestao: ErrorCorrection | null;
    }
  | { readonly tipo: 'falha-codificacao'; readonly detalhe: string };

export type ResultadoCriacao =
  { readonly ok: true; readonly artefato: QrArtifact } | { readonly ok: false; readonly erro: ErroCriacao };

const codificador = new TextEncoder();

/**
 * Bits do indicador de contagem de caracteres, por modo e faixa de versao.
 * Tabela 3 do ISO/IEC 18004.
 */
const CONTAGEM_DE_CARACTERES: Readonly<Record<string, readonly [number, number, number]>> = {
  Numeric: [10, 12, 14],
  Alphanumeric: [9, 11, 13],
  Byte: [8, 16, 16],
  Kanji: [8, 10, 12],
};

function faixaDaVersao(versao: number): 0 | 1 | 2 {
  if (versao <= 9) return 0;
  return versao <= 26 ? 1 : 2;
}

/**
 * Quantos bits o conteudo ocupa de fato.
 *
 * `getBitsLength()` de cada segmento conta so os dados; o indicador de modo
 * (4 bits) e o de contagem de caracteres entram por fora, e e a soma dos tres
 * que se compara com a capacidade da versao.
 *
 * Isto existe porque o codificador **nao usa um modo so**: ele quebra o texto e
 * escolhe o mais denso para cada trecho. Sem contar assim, um Pix de 132
 * caracteres apareceria como "132 / 98 bytes" na ficha — impossivel de ler e
 * falso. Ha teste de propriedade garantindo que o resultado nunca passa da
 * capacidade e nunca caberia na versao anterior.
 */
function bitsOcupados(segmentos: readonly QrSegment[], versao: number): number {
  const faixa = faixaDaVersao(versao);

  return segmentos.reduce((total, segmento) => {
    const contagem = CONTAGEM_DE_CARACTERES[segmento.mode.id]?.[faixa];
    /* istanbul ignore next -- a biblioteca so emite os quatro modos da tabela */
    if (contagem === undefined) return total;
    return total + 4 + contagem + segmento.getBitsLength();
  }, 0);
}

/**
 * Converte conteudo em `QrArtifact`, normalizando as armadilhas de `qrcode`.
 *
 * Devolve `Result` em vez de lancar porque isto roda a cada tecla digitada:
 * conteudo grande demais e um estado normal da interface, nao uma excecao.
 */
export function criarArtefato(conteudo: string, nivel: ErrorCorrection): ResultadoCriacao {
  if (conteudo.length === 0) {
    return { ok: false, erro: { tipo: 'vazio' } };
  }

  const byteLength = codificador.encode(conteudo).length;

  let cru;
  try {
    cru = criarQrCru(conteudo, { errorCorrectionLevel: nivel });
  } catch (causa) {
    // A biblioteca lanca quando o conteudo nao cabe nem na versao 40. Traduzimos
    // para o erro de capacidade, que e o que o usuario precisa entender.
    const capacidade = capacidadeBytes(40, nivel);
    if (byteLength > capacidade) {
      return {
        ok: false,
        erro: {
          tipo: 'excede-capacidade',
          bytes: byteLength,
          capacidade,
          nivel,
          sugestao: melhorNivelPara(byteLength),
        },
      };
    }
    return {
      ok: false,
      erro: { tipo: 'falha-codificacao', detalhe: causa instanceof Error ? causa.message : String(causa) },
    };
  }

  const nivelDevolvido = NIVEL_POR_BIT[cru.errorCorrectionLevel.bit];
  if (nivelDevolvido === undefined) {
    return {
      ok: false,
      erro: {
        tipo: 'falha-codificacao',
        detalhe: `Nivel de correcao desconhecido: bit ${cru.errorCorrectionLevel.bit}`,
      },
    };
  }

  const size = cru.modules.size;

  /*
   * Copia para um buffer proprio, indexado explicitamente por y * size + x.
   *
   * Nao chamamos `modules.get()`: a assinatura dela e (linha, coluna), e
   * escrever `get(x, y)` produz a matriz transposta — um QR espelhado, que
   * muitos leitores de celular recusam. Como espelhamento preserva os tres
   * padroes de localizacao, o erro passa despercebido a olho nu.
   */
  const data = new Uint8Array(cru.modules.data);

  return {
    ok: true,
    artefato: {
      data,
      size,
      sizeComQuietZone: size + QUIET_ZONE * 2,
      version: cru.version,
      errorCorrection: nivelDevolvido,
      maskPattern: cru.maskPattern,
      quietZone: QUIET_ZONE,
      payload: conteudo,
      byteLength,
      capacityBytes: capacidadeBytes(cru.version, nivelDevolvido),
      dataBits: codewordsDeDados(cru.version, nivelDevolvido) * 8,
      usedBits: bitsOcupados(cru.segments, cru.version),
      isDark(x: number, y: number): boolean {
        if (x < 0 || y < 0 || x >= size || y >= size) return false;
        return data[y * size + x] === 1;
      },
    },
  };
}
