import type { QrArtifact } from './types';

/**
 * `QrArtifact` carrega o metodo `isDark`, e metodo nao atravessa
 * `postMessage` — o algoritmo de clonagem estruturada descarta funcoes.
 *
 * Serializar e reidratar permite que a `Scene` inteira, molduras inclusive,
 * seja enviada ao Web Worker sem que o worker precise saber como ela foi
 * montada. A alternativa seria mandar a configuracao e recompor tudo la dentro,
 * duplicando a logica de composicao em dois lugares.
 */
export type ArtefatoSerializado = Omit<QrArtifact, 'isDark'>;

export function serializarArtefato(artefato: QrArtifact): ArtefatoSerializado {
  const { isDark: _isDark, ...dados } = artefato;
  return dados;
}

export function reidratarArtefato(dados: ArtefatoSerializado): QrArtifact {
  const { data, size } = dados;
  return {
    ...dados,
    isDark(x: number, y: number): boolean {
      if (x < 0 || y < 0 || x >= size || y >= size) return false;
      return data[y * size + x] === 1;
    },
  };
}
