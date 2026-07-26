import type { Bitmap } from '@/core/render/raster';

/**
 * Decodifica uma imagem `data:` para pixels crus.
 *
 * O rasterizador de verificação é puro e não sabe abrir PNG nem SVG; ele espera
 * o bitmap pronto. Esta é a ponte, e roda só na thread principal, onde há
 * canvas de verdade.
 */
export async function bitmapDeDataUrl(dataUrl: string, ladoMaximo = 256): Promise<Bitmap> {
  const imagem = new Image();
  imagem.src = dataUrl;
  await imagem.decode();

  const escala = Math.min(1, ladoMaximo / Math.max(imagem.width, imagem.height));
  const width = Math.max(1, Math.round(imagem.width * escala));
  const height = Math.max(1, Math.round(imagem.height * escala));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D indisponível neste navegador.');

  ctx.drawImage(imagem, 0, 0, width, height);
  const dados = ctx.getImageData(0, 0, width, height);

  return { data: dados.data as Uint8ClampedArray<ArrayBuffer>, width, height };
}

const TIPOS_ACEITOS = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

export type ResultadoArquivo =
  | { readonly ok: true; readonly dataUrl: string; readonly nome: string }
  | { readonly ok: false; readonly erro: string };

/** Limite generoso: o logo vira 16% de um QR, então detalhe demais é desperdício. */
export const TAMANHO_MAXIMO_LOGO_BYTES = 2 * 1024 * 1024;

export function lerArquivoComoDataUrl(arquivo: File): Promise<ResultadoArquivo> {
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return Promise.resolve({ ok: false, erro: 'Use PNG, JPEG, WebP ou SVG.' });
  }
  if (arquivo.size > TAMANHO_MAXIMO_LOGO_BYTES) {
    return Promise.resolve({ ok: false, erro: 'Arquivo acima de 2 MB.' });
  }

  return new Promise((resolver) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const dataUrl = typeof leitor.result === 'string' ? leitor.result : '';
      resolver(
        dataUrl.startsWith('data:')
          ? { ok: true, dataUrl, nome: arquivo.name }
          : { ok: false, erro: 'Não foi possível ler o arquivo.' },
      );
    };
    leitor.onerror = () => resolver({ ok: false, erro: 'Não foi possível ler o arquivo.' });
    // Vira data: URI e fica no documento. O arquivo nunca sai da máquina.
    leitor.readAsDataURL(arquivo);
  });
}
