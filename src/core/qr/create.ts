import { create as criarQrCru } from 'qrcode';
import { capacidadeBytes, melhorNivelPara } from './capacity';
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
      isDark(x: number, y: number): boolean {
        if (x < 0 || y < 0 || x >= size || y >= size) return false;
        return data[y * size + x] === 1;
      },
    },
  };
}
