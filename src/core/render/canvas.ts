import type { Scene, SceneNode, TextNode } from '../scene/types';
import { rasterizarCena } from './raster';

/**
 * Desenho em Canvas2D, para a previa na tela e a exportacao em PNG.
 *
 * Por que existe, ja havendo o rasterizador puro: aquele nao desenha texto, e o
 * PNG de uma moldura com chamada de acao precisa do texto. Aqui o navegador
 * cuida de fonte e de imagem.
 *
 * As duas rotas convivem de proposito e com papeis distintos:
 *
 *   - `rasterizarCena` (puro)  -> verificacao de leitura e testes. Roda no Node.
 *   - `desenharCena`  (Canvas) -> o que o usuario ve e baixa em PNG.
 *
 * Elas so podem divergir em texto e imagem, que por construcao ficam fora da
 * area do codigo — invariante checada por `nosSobrepondoOCodigo`. O incremento
 * 3 fecha o circuito decodificando as duas saidas.
 */

type Contexto2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function familia(no: TextNode): string {
  return no.font === 'mono'
    ? "'IBM Plex Mono', ui-monospace, monospace"
    : "'Archivo', ui-sans-serif, sans-serif";
}

function desenharNo(ctx: Contexto2D, no: SceneNode, k: number): void {
  switch (no.kind) {
    case 'rect': {
      if (no.fill !== undefined) {
        ctx.fillStyle = no.fill.rgb;
        ctx.fillRect(no.x * k, no.y * k, no.w * k, no.h * k);
      }
      if (no.stroke !== undefined) {
        ctx.strokeStyle = no.stroke.rgb;
        ctx.lineWidth = (no.strokeWidth ?? 0.25) * k;
        ctx.strokeRect(no.x * k, no.y * k, no.w * k, no.h * k);
      }
      break;
    }

    case 'qr': {
      const artefato = no.artifact;
      const modulos = artefato.sizeComQuietZone;
      const ladoPx = no.side * k;
      const passo = ladoPx / modulos;
      const q = artefato.quietZone;

      ctx.fillStyle = no.light.rgb;
      ctx.fillRect(no.x * k, no.y * k, ladoPx, ladoPx);

      ctx.fillStyle = no.dark.rgb;
      const bordaX = (i: number): number => Math.round(no.x * k + (i + q) * passo);
      const bordaY = (i: number): number => Math.round(no.y * k + (i + q) * passo);

      for (let y = 0; y < artefato.size; y++) {
        const ya = bordaY(y);
        const altura = bordaY(y + 1) - ya;
        let x = 0;
        while (x < artefato.size) {
          if (!artefato.isDark(x, y)) {
            x++;
            continue;
          }
          let largura = 0;
          while (x + largura < artefato.size && artefato.isDark(x + largura, y)) largura++;
          const xa = bordaX(x);
          ctx.fillRect(xa, ya, bordaX(x + largura) - xa, altura);
          x += largura;
        }
      }
      break;
    }

    case 'text': {
      ctx.save();
      ctx.fillStyle = no.fill.rgb;
      ctx.font = `${no.weight} ${no.size * k}px ${familia(no)}`;
      ctx.textAlign = no.align === 'start' ? 'left' : no.align === 'middle' ? 'center' : 'right';
      ctx.textBaseline = 'alphabetic';
      if ('letterSpacing' in ctx) {
        (ctx as { letterSpacing: string }).letterSpacing = `${no.tracking * no.size * k}px`;
      }
      if (no.rotate === -90) {
        ctx.translate(no.x * k, no.y * k);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(no.text, 0, 0);
      } else {
        ctx.fillText(no.text, no.x * k, no.y * k);
      }
      ctx.restore();
      break;
    }

    case 'image':
      // Imagem exige decodificacao assincrona; `desenharCenaComImagens` resolve
      // antes de chamar aqui.
      break;
  }
}

export function desenharCena(ctx: Contexto2D, cena: Scene, pxPorMm: number): void {
  const largura = Math.max(1, Math.round(cena.width * pxPorMm));
  const altura = Math.max(1, Math.round(cena.height * pxPorMm));

  ctx.fillStyle = cena.background?.rgb ?? '#ffffff';
  ctx.fillRect(0, 0, largura, altura);

  for (const no of cena.nodes) desenharNo(ctx, no, pxPorMm);
}

/**
 * Decodifica os `ImageNode` e desenha a cena completa.
 *
 * Usa `Image.decode()` e nao `fetch`: o href e sempre um `data:` URI, entao nao
 * ha nada a buscar — e o lint do projeto proibe `fetch` justamente para que
 * nenhuma requisicao escape sem discussao.
 */
export async function desenharCenaComImagens(ctx: Contexto2D, cena: Scene, pxPorMm: number): Promise<void> {
  desenharCena(ctx, cena, pxPorMm);

  for (const no of cena.nodes) {
    if (no.kind !== 'image') continue;
    const imagem = new Image();
    imagem.src = no.href;
    await imagem.decode();
    ctx.drawImage(imagem, no.x * pxPorMm, no.y * pxPorMm, no.w * pxPorMm, no.h * pxPorMm);
  }
}

/** Cola o resultado do rasterizador puro num contexto. Usado pela verificacao. */
export function colarBitmap(ctx: Contexto2D, cena: Scene, pxPorMm: number): void {
  const bitmap = rasterizarCena(cena, pxPorMm);
  ctx.putImageData(new ImageData(bitmap.data, bitmap.width, bitmap.height), 0, 0);
}
