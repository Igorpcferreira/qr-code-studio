import { describe, expect, it } from 'vitest';
import { criarArtefato } from '@/core/qr/create';
import { codificarPng } from '@/core/render/png';
import type { Bitmap } from '@/core/render/raster';
import { rasterizarCena } from '@/core/render/raster';
import { construirCenaBasica } from '@/core/scene/build';
import { decodificadorJsQr, escalaParaVerificacao } from '@/core/verify/decode';
import { crc32 } from '@/lib/checksum';

const ASSINATURA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function u32(b: Uint8Array, i: number): number {
  return (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)) >>> 0;
}

interface Chunk {
  readonly tipo: string;
  readonly dados: Uint8Array;
}

/** Percorre os chunks conferindo o CRC de cada um, como faz qualquer decodificador. */
function lerChunks(png: Uint8Array): Chunk[] {
  expect(Array.from(png.subarray(0, 8))).toEqual(ASSINATURA);

  const chunks: Chunk[] = [];
  let i = 8;

  while (i < png.length) {
    const tamanho = u32(png, i);
    const tipo = new TextDecoder().decode(png.subarray(i + 4, i + 8));
    const dados = png.subarray(i + 8, i + 8 + tamanho);

    expect(crc32(png.subarray(i + 4, i + 8 + tamanho)), `CRC do chunk ${tipo}`).toBe(
      u32(png, i + 8 + tamanho),
    );

    chunks.push({ tipo, dados });
    i += 12 + tamanho;
  }

  return chunks;
}

async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([dados as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

function bitmapDeTeste(): Bitmap {
  const data = new Uint8ClampedArray(2 * 2 * 4);
  const cores = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [10, 20, 30],
  ];

  cores.forEach((cor, i) => {
    data[i * 4] = cor[0] ?? 0;
    data[i * 4 + 1] = cor[1] ?? 0;
    data[i * 4 + 2] = cor[2] ?? 0;
    data[i * 4 + 3] = 255;
  });

  return { data, width: 2, height: 2 };
}

describe('codificarPng', () => {
  it('emite assinatura, IHDR, IDAT e IEND nessa ordem', async () => {
    const chunks = lerChunks(await codificarPng(bitmapDeTeste()));
    expect(chunks.map((c) => c.tipo)).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it('o IHDR declara as dimensões, 8 bits e RGB sem entrelaçamento', async () => {
    const [ihdr] = lerChunks(await codificarPng(bitmapDeTeste()));
    expect(ihdr).toBeDefined();
    if (ihdr === undefined) return;

    expect(u32(ihdr.dados, 0)).toBe(2);
    expect(u32(ihdr.dados, 4)).toBe(2);
    // profundidade 8, tipo 2 (RGB), compressão 0, filtro 0, sem entrelaçamento.
    expect(Array.from(ihdr.dados.subarray(8))).toEqual([8, 2, 0, 0, 0]);
  });

  /**
   * O teste decisivo: descomprimir o IDAT e reconstruir as linhas. Sem ele o
   * arquivo poderia estar bem formado e desenhar outra coisa.
   */
  it('os pixels voltam intactos, com o byte de filtro zero por linha', async () => {
    const png = await codificarPng(bitmapDeTeste());
    const idat = lerChunks(png).find((c) => c.tipo === 'IDAT');
    expect(idat).toBeDefined();
    if (idat === undefined) return;

    const bruto = await inflar(idat.dados);

    // 2 linhas de (1 byte de filtro + 2 pixels × 3 canais).
    expect(Array.from(bruto)).toEqual([0, 255, 0, 0, 0, 255, 0, 0, 0, 0, 255, 10, 20, 30]);
  });

  /**
   * O circuito completo: o PNG do lote precisa ser decodificável como QR
   * depois de escrito e lido de volta, não só bem formado.
   */
  it('um código escrito em PNG volta a ser lido a partir dos pixels do arquivo', async () => {
    const criacao = criarArtefato('https://arquivo.gov.br/registro/8841', 'H');
    expect(criacao.ok).toBe(true);
    if (!criacao.ok) return;

    const cena = construirCenaBasica(criacao.artefato, 40);
    const bitmap = rasterizarCena(cena, escalaParaVerificacao(40, criacao.artefato.sizeComQuietZone, 8));

    const png = await codificarPng(bitmap);
    const idat = lerChunks(png).find((c) => c.tipo === 'IDAT');
    if (idat === undefined) throw new Error('sem IDAT');

    // Reconstrói o RGBA a partir do que foi de fato gravado no arquivo.
    const bruto = await inflar(idat.dados);
    const rgba = new Uint8ClampedArray(bitmap.width * bitmap.height * 4);

    for (let y = 0; y < bitmap.height; y++) {
      let origem = y * (1 + bitmap.width * 3) + 1;
      for (let x = 0; x < bitmap.width; x++) {
        const destino = (y * bitmap.width + x) * 4;
        rgba[destino] = bruto[origem] ?? 0;
        rgba[destino + 1] = bruto[origem + 1] ?? 0;
        rgba[destino + 2] = bruto[origem + 2] ?? 0;
        rgba[destino + 3] = 255;
        origem += 3;
      }
    }

    const lido = decodificadorJsQr.decodificar({
      data: rgba,
      width: bitmap.width,
      height: bitmap.height,
    });
    expect(lido).toBe('https://arquivo.gov.br/registro/8841');
  });
});
