import { describe, expect, it } from 'vitest';
import { criarZip } from '@/core/batch/zip';
import { adler32, crc32 } from '@/lib/checksum';

const codificador = new TextEncoder();
const decodificador = new TextDecoder();

function u16(b: Uint8Array, i: number): number {
  return (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
}

function u32(b: Uint8Array, i: number): number {
  return ((b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16) | ((b[i + 3] ?? 0) << 24)) >>> 0;
}

/**
 * Lê o ZIP de volta pelo diretório central, que é por onde qualquer
 * descompactador de verdade começa. Devolve nome, método e conteúdo cru.
 */
function lerZip(zip: Uint8Array): { nome: string; metodo: number; crc: number; inicio: number }[] {
  const fimCentral = zip.length - 22;
  expect(u32(zip, fimCentral)).toBe(0x06054b50);

  const total = u16(zip, fimCentral + 10);
  let posicao = u32(zip, fimCentral + 16);
  const entradas = [];

  for (let i = 0; i < total; i++) {
    expect(u32(zip, posicao)).toBe(0x02014b50);

    const metodo = u16(zip, posicao + 10);
    const crc = u32(zip, posicao + 16);
    const tamanhoNome = u16(zip, posicao + 28);
    const deslocamento = u32(zip, posicao + 42);
    const nome = decodificador.decode(zip.subarray(posicao + 46, posicao + 46 + tamanhoNome));

    // No cabeçalho local, o dado começa depois do nome e do campo extra.
    const inicio = deslocamento + 30 + u16(zip, deslocamento + 26) + u16(zip, deslocamento + 28);
    entradas.push({ nome, metodo, crc, inicio });
    posicao += 46 + tamanhoNome + u16(zip, posicao + 30) + u16(zip, posicao + 32);
  }

  return entradas;
}

async function descomprimir(zip: Uint8Array, entrada: { metodo: number; inicio: number }, tamanho: number) {
  const bruto = zip.subarray(entrada.inicio, entrada.inicio + tamanho);
  if (entrada.metodo === 0) return bruto;

  const fluxo = new Blob([bruto as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

describe('checksums', () => {
  /** Vetor canônico do CRC-32 do PKZIP, o mesmo que o PNG usa. */
  it('CRC-32 de "123456789" é 0xCBF43926', () => {
    expect(crc32(codificador.encode('123456789'))).toBe(0xcbf43926);
  });

  it('Adler-32 de "Wikipedia" é 0x11E60398', () => {
    expect(adler32(codificador.encode('Wikipedia'))).toBe(0x11e60398);
  });
});

describe('criarZip', () => {
  it('produz um arquivo com a assinatura e o número certo de entradas', async () => {
    const zip = await criarZip([
      { nome: 'a.svg', dados: codificador.encode('<svg/>') },
      { nome: 'b.svg', dados: codificador.encode('<svg/>') },
    ]);

    expect(Array.from(zip.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(lerZip(zip)).toHaveLength(2);
  });

  /**
   * O teste que importa: o conteúdo volta idêntico depois de passar pelo
   * diretório central e pelo deflate. Sem ele, o ZIP poderia estar bem formado
   * e entregar lixo.
   */
  it('o conteúdo volta byte a byte', async () => {
    const conteudo = `<svg>${'x'.repeat(5000)}</svg>`;
    const zip = await criarZip([{ nome: 'peça.svg', dados: codificador.encode(conteudo) }]);

    const [entrada] = lerZip(zip);
    expect(entrada).toBeDefined();
    if (entrada === undefined) return;

    expect(entrada.nome).toBe('peça.svg');
    expect(entrada.crc).toBe(crc32(codificador.encode(conteudo)));

    const tamanho = u32(zip, 18);
    expect(decodificador.decode(await descomprimir(zip, entrada, tamanho))).toBe(conteudo);
  });

  it('comprime o que vale a pena e guarda cru o que não vale', async () => {
    const repetitivo = codificador.encode('a'.repeat(4000));
    const minusculo = codificador.encode('x');

    const zip = await criarZip([
      { nome: 'grande.txt', dados: repetitivo },
      { nome: 'pequeno.txt', dados: minusculo },
    ]);

    const [grande, pequeno] = lerZip(zip);
    expect(grande?.metodo).toBe(8);
    // Deflate de um byte fica maior que o byte; guardar cru é menor e válido.
    expect(pequeno?.metodo).toBe(0);
    expect(zip.length).toBeLessThan(repetitivo.length);
  });

  it('desambigua nomes repetidos preservando a extensão', async () => {
    const zip = await criarZip([
      { nome: 'qr.svg', dados: codificador.encode('1') },
      { nome: 'qr.svg', dados: codificador.encode('2') },
      { nome: 'qr.svg', dados: codificador.encode('3') },
    ]);

    expect(lerZip(zip).map((e) => e.nome)).toEqual(['qr.svg', 'qr-2.svg', 'qr-3.svg']);
  });

  /**
   * Saída determinística: a data de modificação é fixa. A mesma decisão já
   * vale para o identificador da ficha técnica, que sai do conteúdo e não do
   * relógio — um artefato reproduzível é conferível.
   */
  it('a mesma entrada produz o mesmo arquivo', async () => {
    const entradas = [{ nome: 'a.svg', dados: codificador.encode('<svg/>') }];
    expect(await criarZip(entradas)).toEqual(await criarZip(entradas));
  });

  it('aceita a lista vazia', async () => {
    const zip = await criarZip([]);
    expect(zip).toHaveLength(22);
    expect(lerZip(zip)).toEqual([]);
  });
});
