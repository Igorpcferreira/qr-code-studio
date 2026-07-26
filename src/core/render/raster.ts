import { hexParaRgb } from '@/lib/contrast';
import type { Paint, QrNode, RectNode, Scene, SceneNode } from '../scene/types';

/**
 * Rasterizador puro: cena em milimetros -> pixels RGBA, sem DOM.
 *
 * Existe para que a verificacao de leitura (`/core/verify`) rode identica no
 * Web Worker e no Node dos testes. Um rasterizador que dependesse de canvas
 * tornaria o teste de ida e volta impossivel fora do navegador — e esse teste e
 * o argumento central do produto.
 *
 * Nao desenha texto (nao ha metrica de fonte aqui) e so desenha imagem se o
 * bitmap for fornecido ja decodificado. Isso e seguro porque nenhuma moldura
 * pode cobrir o codigo com texto: `nosSobrepondoOCodigo()` transforma essa
 * suposicao em assercao verificavel.
 */

export interface Bitmap {
  /**
   * O parametro `ArrayBuffer` e explicito porque `ImageData` nao aceita um
   * buffer que possa ser `SharedArrayBuffer`, e sem ele o construtor recusa
   * este mesmo tipo em `colarBitmap`.
   */
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  readonly width: number;
  readonly height: number;
}

function canalRgb(tinta: Paint): readonly [number, number, number] {
  const rgb = hexParaRgb(tinta.rgb);
  if (rgb === null) throw new TypeError(`Cor invalida na cena: ${tinta.rgb}`);
  return [rgb.r, rgb.g, rgb.b];
}

function preencher(
  alvo: Bitmap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cor: readonly [number, number, number],
): void {
  const xa = Math.max(0, Math.min(alvo.width, Math.round(x0)));
  const xb = Math.max(0, Math.min(alvo.width, Math.round(x1)));
  const ya = Math.max(0, Math.min(alvo.height, Math.round(y0)));
  const yb = Math.max(0, Math.min(alvo.height, Math.round(y1)));

  for (let y = ya; y < yb; y++) {
    let i = (y * alvo.width + xa) * 4;
    for (let x = xa; x < xb; x++) {
      alvo.data[i] = cor[0];
      alvo.data[i + 1] = cor[1];
      alvo.data[i + 2] = cor[2];
      alvo.data[i + 3] = 255;
      i += 4;
    }
  }
}

function desenharRect(alvo: Bitmap, no: RectNode, k: number): void {
  if (no.fill !== undefined) {
    preencher(alvo, no.x * k, no.y * k, (no.x + no.w) * k, (no.y + no.h) * k, canalRgb(no.fill));
  }
  if (no.stroke !== undefined) {
    const cor = canalRgb(no.stroke);
    const e = (no.strokeWidth ?? 0.25) * k;
    const x0 = no.x * k;
    const y0 = no.y * k;
    const x1 = (no.x + no.w) * k;
    const y1 = (no.y + no.h) * k;
    // Traco centrado na borda, como o SVG faz.
    preencher(alvo, x0 - e / 2, y0 - e / 2, x1 + e / 2, y0 + e / 2, cor);
    preencher(alvo, x0 - e / 2, y1 - e / 2, x1 + e / 2, y1 + e / 2, cor);
    preencher(alvo, x0 - e / 2, y0 - e / 2, x0 + e / 2, y1 + e / 2, cor);
    preencher(alvo, x1 - e / 2, y0 - e / 2, x1 + e / 2, y1 + e / 2, cor);
  }
}

function desenharQr(alvo: Bitmap, no: QrNode, k: number): void {
  const artefato = no.artifact;
  const modulos = artefato.sizeComQuietZone;
  const ladoPx = no.side * k;
  const origemX = no.x * k;
  const origemY = no.y * k;

  preencher(alvo, origemX, origemY, origemX + ladoPx, origemY + ladoPx, canalRgb(no.light));

  const escuro = canalRgb(no.dark);
  const q = artefato.quietZone;

  /*
   * As bordas de cada modulo saem de `Math.round(origem + i * passo)`, e o fim
   * de um modulo e exatamente o inicio do proximo. Assim o ladrilhamento fecha
   * sem sobra nem folga mesmo quando o passo cai em fracao de pixel — e o PNG
   * nao sai com costura, aquelas linhas claras entre modulos que confundem o
   * scanner.
   */
  const passo = ladoPx / modulos;
  const borda = (i: number): number => Math.round(origemX + (i + q) * passo);
  const bordaY = (i: number): number => Math.round(origemY + (i + q) * passo);

  for (let y = 0; y < artefato.size; y++) {
    const ya = bordaY(y);
    const yb = bordaY(y + 1);
    let x = 0;
    while (x < artefato.size) {
      if (!artefato.isDark(x, y)) {
        x++;
        continue;
      }
      let largura = 0;
      while (x + largura < artefato.size && artefato.isDark(x + largura, y)) largura++;
      preencher(alvo, borda(x), ya, borda(x + largura), yb, escuro);
      x += largura;
    }
  }
}

export interface OpcoesRaster {
  /** Bitmaps ja decodificados, indexados pelo `href` do `ImageNode`. */
  readonly imagens?: ReadonlyMap<string, Bitmap>;
}

/** Rasteriza a cena. `pxPorMm` sai de `dpi / 25.4`. */
export function rasterizarCena(cena: Scene, pxPorMm: number, opcoes: OpcoesRaster = {}): Bitmap {
  if (!(pxPorMm > 0) || !Number.isFinite(pxPorMm)) {
    throw new RangeError(`Escala precisa ser positiva: ${pxPorMm}`);
  }

  const width = Math.max(1, Math.round(cena.width * pxPorMm));
  const height = Math.max(1, Math.round(cena.height * pxPorMm));
  const alvo: Bitmap = { data: new Uint8ClampedArray(width * height * 4), width, height };

  const fundo = cena.background ?? { rgb: '#ffffff' };
  preencher(alvo, 0, 0, width, height, canalRgb(fundo));

  for (const no of cena.nodes) {
    switch (no.kind) {
      case 'rect':
        desenharRect(alvo, no, pxPorMm);
        break;
      case 'qr':
        desenharQr(alvo, no, pxPorMm);
        break;
      case 'image': {
        const bitmap = opcoes.imagens?.get(no.href);
        if (bitmap !== undefined)
          desenharBitmap(alvo, bitmap, no.x * pxPorMm, no.y * pxPorMm, no.w * pxPorMm, no.h * pxPorMm);
        break;
      }
      case 'text':
        // Sem metrica de fonte aqui. Ver `nosSobrepondoOCodigo`.
        break;
    }
  }

  return alvo;
}

/** Desenha um bitmap escalado por vizinho mais proximo. */
function desenharBitmap(alvo: Bitmap, fonte: Bitmap, x: number, y: number, w: number, h: number): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const larguraDestino = Math.round(w);
  const alturaDestino = Math.round(h);

  for (let dy = 0; dy < alturaDestino; dy++) {
    const py = y0 + dy;
    if (py < 0 || py >= alvo.height) continue;
    const sy = Math.min(fonte.height - 1, Math.floor((dy / alturaDestino) * fonte.height));

    for (let dx = 0; dx < larguraDestino; dx++) {
      const px = x0 + dx;
      if (px < 0 || px >= alvo.width) continue;
      const sx = Math.min(fonte.width - 1, Math.floor((dx / larguraDestino) * fonte.width));

      const origem = (sy * fonte.width + sx) * 4;
      const alfa = (fonte.data[origem + 3] ?? 0) / 255;
      if (alfa === 0) continue;

      const destino = (py * alvo.width + px) * 4;
      for (let c = 0; c < 3; c++) {
        const de = alvo.data[destino + c] ?? 0;
        const para = fonte.data[origem + c] ?? 0;
        alvo.data[destino + c] = Math.round(de * (1 - alfa) + para * alfa);
      }
      alvo.data[destino + 3] = 255;
    }
  }
}

/**
 * Nos que invadem a area de algum codigo da cena.
 *
 * Serve de assercao para duas regras: o rasterizador puro pode ignorar texto
 * porque texto nunca cobre o codigo, e a chamada de acao das molduras e sempre
 * impressa **ao lado**, nunca por cima. Uma moldura que violasse isso quebraria
 * a leitura sem que nenhum outro teste percebesse.
 */
export function nosSobrepondoOCodigo(cena: Scene): SceneNode[] {
  const codigos = cena.nodes.filter((no): no is QrNode => no.kind === 'qr');
  if (codigos.length === 0) return [];

  const invasores: SceneNode[] = [];

  for (const no of cena.nodes) {
    if (no.kind === 'qr' || no.kind === 'image') continue; // o logo central invade de proposito

    for (const codigo of codigos) {
      const dentro =
        no.kind === 'text'
          ? no.x >= codigo.x &&
            no.x <= codigo.x + codigo.side &&
            no.y >= codigo.y &&
            no.y <= codigo.y + codigo.side
          : no.x < codigo.x + codigo.side &&
            no.x + no.w > codigo.x &&
            no.y < codigo.y + codigo.side &&
            no.y + no.h > codigo.y;

      if (dentro) {
        invasores.push(no);
        break;
      }
    }
  }

  return invasores;
}
