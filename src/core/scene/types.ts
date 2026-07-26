import type { QrArtifact } from '../qr/types';

/**
 * A display list que separa composicao de desenho.
 *
 * Sem ela, as 14 molduras x 3 formatos de saida seriam 42 implementacoes que
 * precisariam concordar pixel a pixel. Com ela, cada moldura e escrita uma vez
 * como funcao pura `(QrArtifact, opcoes) => Scene`, e os renderers viram um
 * `switch` sobre `kind`, sem regra de negocio.
 *
 * UNIDADE: milimetro, sempre. O produto existe para impressao; pixel e uma
 * conversao de saida, nao a fonte da verdade. A origem fica no canto superior
 * esquerdo, com y crescendo para baixo (o PDF inverte isso internamente).
 */

/**
 * Cor com as duas representacoes que o projeto precisa.
 *
 * SVG e PNG usam `rgb`. O PDF usa `cmyk` quando o usuario pede preto 100% K —
 * grafica e serigrafia rejeitam preto rico. Carregar as duas juntas e o que
 * permite a opcao existir sem duplicar nenhuma moldura.
 */
export interface Paint {
  /** `#rrggbb`, minusculo. */
  readonly rgb: string;
  /** Ciano, magenta, amarelo e preto, cada um de 0 a 1. */
  readonly cmyk?: readonly [number, number, number, number];
}

export interface RectNode {
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly fill?: Paint;
  readonly stroke?: Paint;
  /** Espessura do traco em mm. */
  readonly strokeWidth?: number;
}

/**
 * O codigo em si.
 *
 * No plano este no era `{ kind: 'path', d }`, com o caminho ja resolvido. Virou
 * um no dedicado por um motivo pratico: com o caminho pronto, o rasterizador
 * precisaria de um interpretador de SVG path completo para poder verificar a
 * leitura. Guardando o artefato, cada renderer resolve do jeito que lhe convem
 * — SVG emite um `<path>` unico, o rasterizador percorre modulos, o PDF desenha
 * retangulos — e nenhum deles precisa entender a sintaxe do outro.
 */
export interface QrNode {
  readonly kind: 'qr';
  readonly x: number;
  readonly y: number;
  /** Lado do quadrado em mm, ja incluindo a quiet zone. */
  readonly side: number;
  readonly artifact: QrArtifact;
  readonly dark: Paint;
  readonly light: Paint;
}

export interface TextNode {
  readonly kind: 'text';
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly font: 'display' | 'mono';
  /** Corpo em mm. */
  readonly size: number;
  readonly weight: 400 | 500 | 600 | 700 | 800 | 900;
  /** Espacamento entre letras, em ems. */
  readonly tracking: number;
  readonly align: 'start' | 'middle' | 'end';
  readonly fill: Paint;
  /** -90 para a etiqueta vertical. */
  readonly rotate?: 0 | -90;
}

/** Logo central. `href` e sempre `data:` — nada externo entra no arquivo. */
export interface ImageNode {
  readonly kind: 'image';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly href: string;
}

export type SceneNode = RectNode | QrNode | TextNode | ImageNode;

/** Dados da ficha tecnica, para as molduras que a imprimem. */
export interface SceneMeta {
  readonly version: number;
  readonly modules: number;
  readonly errorCorrection: string;
  readonly capacityBytes: number;
  readonly byteLength: number;
  readonly quietZone: number;
  readonly payload: string;
}

export interface Scene {
  /** Milimetros. */
  readonly width: number;
  readonly height: number;
  readonly background: Paint | null;
  readonly nodes: readonly SceneNode[];
  readonly meta: SceneMeta;
}

export const PRETO_K: Paint = { rgb: '#000000', cmyk: [0, 0, 0, 1] };

export function paint(rgb: string, cmyk?: readonly [number, number, number, number]): Paint {
  return cmyk === undefined ? { rgb: rgb.toLowerCase() } : { rgb: rgb.toLowerCase(), cmyk };
}

/** Retangulo ocupado por um no, para checagens de sobreposicao. */
export function limitesDoNo(no: SceneNode): { x: number; y: number; w: number; h: number } | null {
  switch (no.kind) {
    case 'rect':
    case 'image':
      return { x: no.x, y: no.y, w: no.w, h: no.h };
    case 'qr':
      return { x: no.x, y: no.y, w: no.side, h: no.side };
    case 'text':
      // Texto nao tem caixa conhecida sem metrica de fonte. Quem precisa de
      // sobreposicao trata texto a parte.
      return null;
  }
}
