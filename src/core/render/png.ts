import { adler32, crc32 } from '@/lib/checksum';
import type { Bitmap } from './raster';

/**
 * Codificador de PNG sem DOM.
 *
 * Existe porque o lote roda dentro de um Web Worker e precisa produzir
 * centenas de arquivos. As alternativas eram `OffscreenCanvas`, que amarra o
 * caminho ao navegador e sai do alcance dos testes em Node, ou uma biblioteca
 * de PNG, que traria um deflate próprio quando a plataforma já tem um.
 *
 * O escopo é o mínimo que o produto precisa e nada além: 8 bits por canal, RGB
 * sem alfa, sem entrelaçamento e filtro zero em todas as linhas. A cena
 * rasterizada é sempre opaca, então guardar o canal alfa custaria 25% do
 * arquivo para carregar 255 repetido.
 *
 * O caminho de PNG da tela continua sendo o canvas do navegador: lá existe DOM,
 * e `toBlob` já é acelerado. Este aqui é o de lote.
 */

const ASSINATURA = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function u32(valor: number): Uint8Array {
  return new Uint8Array([(valor >>> 24) & 0xff, (valor >>> 16) & 0xff, (valor >>> 8) & 0xff, valor & 0xff]);
}

function juntar(partes: readonly Uint8Array[]): Uint8Array {
  const total = partes.reduce((soma, p) => soma + p.length, 0);
  const saida = new Uint8Array(total);

  let posicao = 0;
  for (const parte of partes) {
    saida.set(parte, posicao);
    posicao += parte.length;
  }

  return saida;
}

/** Um chunk é tamanho, tipo, dados e o CRC-32 de tipo + dados. */
function chunk(tipo: string, dados: Uint8Array): Uint8Array {
  const marcador = new TextEncoder().encode(tipo);
  const corpo = juntar([marcador, dados]);
  return juntar([u32(dados.length), corpo, u32(crc32(corpo))]);
}

/**
 * Envelope zlib com blocos não comprimidos.
 *
 * Reserva para o caso de `CompressionStream` não existir. Produz um PNG maior,
 * porém válido — melhor que recusar a exportação por falta de uma API.
 */
function zlibArmazenado(dados: Uint8Array): Uint8Array {
  const partes: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  const MAX = 0xffff;

  for (let i = 0; i < dados.length || i === 0; i += MAX) {
    const pedaco = dados.subarray(i, Math.min(i + MAX, dados.length));
    const ultimo = i + MAX >= dados.length ? 1 : 0;
    partes.push(
      new Uint8Array([
        ultimo,
        pedaco.length & 0xff,
        (pedaco.length >>> 8) & 0xff,
        ~pedaco.length & 0xff,
        (~pedaco.length >>> 8) & 0xff,
      ]),
      pedaco,
    );
  }

  partes.push(u32(adler32(dados)));
  return juntar(partes);
}

async function zlib(dados: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') return zlibArmazenado(dados);

  // `deflate` (e não `deflate-raw`) já entrega o envelope zlib que o IDAT exige.
  const fluxo = new Blob([dados as unknown as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));

  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** Converte o bitmap RGBA da rasterização num PNG RGB. */
export async function codificarPng(bitmap: Bitmap): Promise<Uint8Array> {
  const { width, height, data } = bitmap;

  /*
   * Cada linha começa por um byte de filtro. Zero significa "sem filtro": os
   * filtros do PNG existem para melhorar a compressão de fotografia, e num
   * desenho de dois tons eles atrapalham mais do que ajudam.
   */
  const bruto = new Uint8Array(height * (1 + width * 3));

  let destino = 0;
  for (let y = 0; y < height; y++) {
    bruto[destino++] = 0;
    let origem = y * width * 4;
    for (let x = 0; x < width; x++) {
      bruto[destino++] = data[origem] ?? 0;
      bruto[destino++] = data[origem + 1] ?? 0;
      bruto[destino++] = data[origem + 2] ?? 0;
      origem += 4;
    }
  }

  const ihdr = juntar([
    u32(width),
    u32(height),
    // profundidade 8, tipo 2 (RGB), compressão 0, filtro 0, sem entrelaçamento.
    new Uint8Array([8, 2, 0, 0, 0]),
  ]);

  return juntar([
    ASSINATURA,
    chunk('IHDR', ihdr),
    chunk('IDAT', await zlib(bruto)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}
