import type { ArtefatoSerializado } from '../qr/serialize';
import { reidratarArtefato, serializarArtefato } from '../qr/serialize';
import type { Bitmap } from '../render/raster';
import type { ImageNode, QrNode, RectNode, Scene, TextNode } from '../scene/types';
import type { MargemDano } from './damage';
import type { Veredicto } from './verify';

/**
 * Protocolo entre a thread principal e o Worker de verificacao.
 *
 * A `Scene` viaja quase inteira; so o `QrArtifact` precisa perder o metodo
 * `isDark` no caminho, porque a clonagem estruturada do `postMessage` descarta
 * funcoes. Assim o worker verifica qualquer cena — inclusive as molduras do
 * incremento 6 — sem precisar saber como ela foi composta.
 */

export type QrNodeSerializado = Omit<QrNode, 'artifact'> & { readonly artifact: ArtefatoSerializado };
export type NoSerializado = RectNode | TextNode | ImageNode | QrNodeSerializado;

export interface CenaSerializada extends Omit<Scene, 'nodes'> {
  readonly nodes: readonly NoSerializado[];
}

export function serializarCena(cena: Scene): CenaSerializada {
  return {
    ...cena,
    nodes: cena.nodes.map((no) =>
      no.kind === 'qr' ? { ...no, artifact: serializarArtefato(no.artifact) } : no,
    ),
  };
}

export function reidratarCena(cena: CenaSerializada): Scene {
  return {
    ...cena,
    nodes: cena.nodes.map((no) =>
      no.kind === 'qr' ? { ...no, artifact: reidratarArtefato(no.artifact) } : no,
    ),
  };
}

export interface PedidoVerificacao {
  readonly id: number;
  readonly cena: CenaSerializada;
  /** Bitmaps ja decodificados dos logos, indexados pelo `href`. */
  readonly imagens?: readonly (readonly [string, Bitmap])[];
  /** Medir tambem a margem de dano, que custa varias decodificacoes a mais. */
  readonly medirDano?: boolean;
}

export interface RespostaVerificacao {
  readonly id: number;
  readonly veredicto: Veredicto | null;
  readonly margens: readonly MargemDano[] | null;
  readonly erro: string | null;
}
