import type { QrArtifact } from '../qr/types';
import type { Paint, Scene, SceneMeta } from './types';
import { paint } from './types';

/**
 * Cores padrao dos modulos.
 *
 * Fixas de proposito e independentes do tema da interface. Regra do brand
 * board: "No modo escuro, invertemos apenas a interface. O codigo continua
 * escuro sobre claro para nao falhar em scanners."
 */
export const MODULO_ESCURO_PADRAO: Paint = paint('#0e0f14', [0, 0, 0, 1]);
export const MODULO_CLARO_PADRAO: Paint = paint('#ffffff', [0, 0, 0, 0]);

export interface EstiloCodigo {
  readonly dark?: Paint;
  readonly light?: Paint;
}

export function metaDoArtefato(artefato: QrArtifact): SceneMeta {
  return {
    version: artefato.version,
    modules: artefato.size,
    errorCorrection: artefato.errorCorrection,
    capacityBytes: artefato.capacityBytes,
    dataBits: artefato.dataBits,
    usedBits: artefato.usedBits,
    byteLength: artefato.byteLength,
    quietZone: artefato.quietZone,
    payload: artefato.payload,
  };
}

/**
 * Cena do codigo nu, sem moldura: o lado inteiro e o QR mais sua quiet zone.
 *
 * E a base sobre a qual as 14 molduras do incremento 6 compoem, e ja atende a
 * primeira delas ("sem moldura · nu · uso digital").
 */
export function construirCenaBasica(artefato: QrArtifact, ladoMm: number, estilo: EstiloCodigo = {}): Scene {
  if (!(ladoMm > 0) || !Number.isFinite(ladoMm)) {
    throw new RangeError(`Lado precisa ser um numero positivo: ${ladoMm}`);
  }

  const dark = estilo.dark ?? MODULO_ESCURO_PADRAO;
  const light = estilo.light ?? MODULO_CLARO_PADRAO;

  return {
    width: ladoMm,
    height: ladoMm,
    // O fundo da cena e o proprio modulo claro: a quiet zone precisa ser da
    // mesma cor dos modulos claros, senao deixa de funcionar como quiet zone.
    background: light,
    nodes: [{ kind: 'qr', x: 0, y: 0, side: ladoMm, artifact: artefato, dark, light }],
    meta: metaDoArtefato(artefato),
  };
}
