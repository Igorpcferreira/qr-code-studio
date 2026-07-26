/**
 * Somas de verificação de formato de arquivo.
 *
 * Ficam aqui, e não dentro do ZIP ou do PNG, porque os dois formatos usam
 * exatamente o mesmo CRC-32 — e a alternativa seria uma cópia em cada um, com
 * o risco clássico de as duas divergirem numa correção futura.
 */

const TABELA_CRC32 = (() => {
  const tabela = new Uint32Array(256);

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[i] = c >>> 0;
  }

  return tabela;
})();

/**
 * CRC-32 do PKZIP e do PNG: polinômio 0x04C11DB7 refletido (0xEDB88320),
 * inicial e final invertidos.
 *
 * O vetor canônico está travado em teste: o CRC de `123456789` é 0xCBF43926.
 */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = TABELA_CRC32[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Adler-32, o checksum do envelope zlib que fecha o fluxo do PNG. */
export function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;

  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }

  return ((b << 16) | a) >>> 0;
}
