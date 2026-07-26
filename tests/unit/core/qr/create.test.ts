import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { capacidadeBytes } from '@/core/qr/capacity';
import { criarArtefato } from '@/core/qr/create';
import type { QrArtifact } from '@/core/qr/types';
import { NIVEIS_CORRECAO, modulosDaVersao, versaoDosModulos } from '@/core/qr/types';

const require = createRequire(import.meta.url);

function exigirArtefato(conteudo: string, nivel: Parameters<typeof criarArtefato>[1]): QrArtifact {
  const r = criarArtefato(conteudo, nivel);
  if (!r.ok) throw new Error(`esperava sucesso, veio ${JSON.stringify(r.erro)}`);
  return r.artefato;
}

const URL_EXEMPLO = 'https://arquivo.gov.br/registro/8841';

describe('mapeamento do nivel de correcao', () => {
  /**
   * A biblioteca devolve `{ bit }` e a numeracao nao segue ordem alfabetica nem
   * de robustez (L=1, M=0, Q=3, H=2). Este teste ancora o mapeamento nas
   * constantes da propria biblioteca, para que ele nao dependa de memoria.
   */
  it('bate com as constantes da biblioteca', () => {
    const ECLevel = require('qrcode/lib/core/error-correction-level.js') as Record<string, { bit: number }>;
    expect(ECLevel['L']?.bit).toBe(1);
    expect(ECLevel['M']?.bit).toBe(0);
    expect(ECLevel['Q']?.bit).toBe(3);
    expect(ECLevel['H']?.bit).toBe(2);
  });

  it('devolve o mesmo nivel que foi pedido', () => {
    for (const nivel of NIVEIS_CORRECAO) {
      expect(exigirArtefato(URL_EXEMPLO, nivel).errorCorrection).toBe(nivel);
    }
  });
});

describe('orientacao da matriz', () => {
  /**
   * O `get()` da biblioteca recebe (linha, coluna). Escrever `get(x, y)` produz
   * a matriz transposta — um QR espelhado. O erro e traicoeiro porque a
   * transposicao mantem os tres padroes de localizacao nos cantos certos, entao
   * o codigo continua "parecendo" um QR, e decodificadores tolerantes a espelho
   * (jsQR, ZXing) ainda o leem: so falha em parte dos leitores de celular.
   *
   * O modulo escuro do padrao ISO/IEC 18004 e o teste decisivo. Ele fica em
   * (coluna 8, linha size - 8) e e SEMPRE escuro. A posicao transposta,
   * (coluna size - 8, linha 8), pertence a informacao de formato e varia.
   */
  const amostras = [
    'a',
    URL_EXEMPLO,
    'x'.repeat(300),
    'ação e çedilha',
    'https://loja.exemplo.com.br/drop-07',
  ];

  it('o modulo escuro esta sempre em (8, size - 8)', () => {
    for (const conteudo of amostras) {
      for (const nivel of NIVEIS_CORRECAO) {
        const a = exigirArtefato(conteudo, nivel);
        expect(a.isDark(8, a.size - 8), `modulo escuro ausente em "${conteudo.slice(0, 20)}" ${nivel}`).toBe(
          true,
        );
      }
    }
  });

  it('a posicao transposta varia — o teste acima discrimina de verdade', () => {
    const valores = new Set<boolean>();
    for (const conteudo of amostras) {
      for (const nivel of NIVEIS_CORRECAO) {
        const a = exigirArtefato(conteudo, nivel);
        valores.add(a.isDark(a.size - 8, 8));
      }
    }
    expect(valores.has(false)).toBe(true);
  });

  it('os tres padroes de localizacao estao nos cantos certos', () => {
    const a = exigirArtefato(URL_EXEMPLO, 'H');
    const olhoCheio = (x0: number, y0: number): boolean => {
      for (let dy = 0; dy < 7; dy++) {
        for (let dx = 0; dx < 7; dx++) {
          const borda = dx === 0 || dy === 0 || dx === 6 || dy === 6;
          const nucleo = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
          if (a.isDark(x0 + dx, y0 + dy) !== (borda || nucleo)) return false;
        }
      }
      return true;
    };

    expect(olhoCheio(0, 0), 'superior esquerdo').toBe(true);
    expect(olhoCheio(a.size - 7, 0), 'superior direito').toBe(true);
    expect(olhoCheio(0, a.size - 7), 'inferior esquerdo').toBe(true);
    // O canto inferior direito nao tem localizador — e o vazio que a marca usa.
    expect(olhoCheio(a.size - 7, a.size - 7)).toBe(false);
  });
});

describe('metadados do artefato', () => {
  it('versao e contagem de modulos sao consistentes', () => {
    for (const nivel of NIVEIS_CORRECAO) {
      const a = exigirArtefato(URL_EXEMPLO, nivel);
      expect(a.size).toBe(modulosDaVersao(a.version));
      expect(versaoDosModulos(a.size)).toBe(a.version);
      expect(a.data).toHaveLength(a.size * a.size);
    }
  });

  it('a quiet zone e sempre 4 modulos', () => {
    const a = exigirArtefato(URL_EXEMPLO, 'H');
    expect(a.quietZone).toBe(4);
    expect(a.sizeComQuietZone).toBe(a.size + 8);
  });

  it('a capacidade corresponde a versao e ao nivel efetivos', () => {
    for (const nivel of NIVEIS_CORRECAO) {
      const a = exigirArtefato(URL_EXEMPLO, nivel);
      expect(a.capacityBytes).toBe(capacidadeBytes(a.version, nivel));
      expect(a.byteLength).toBeLessThanOrEqual(a.capacityBytes);
    }
  });

  it('conta bytes em UTF-8, nao caracteres', () => {
    expect(exigirArtefato('abc', 'H').byteLength).toBe(3);
    expect(exigirArtefato('ação', 'H').byteLength).toBe(6); // c-cedilha e a-til ocupam 2 cada
    expect(exigirArtefato('日本', 'H').byteLength).toBe(6);
  });

  it('preserva o conteudo como payload', () => {
    expect(exigirArtefato(URL_EXEMPLO, 'M').payload).toBe(URL_EXEMPLO);
  });
});

describe('isDark', () => {
  it('trata a quiet zone e o fora dos limites como claro', () => {
    const a = exigirArtefato(URL_EXEMPLO, 'H');
    for (const [x, y] of [
      [-1, 0],
      [0, -1],
      [a.size, 0],
      [0, a.size],
      [-4, -4],
      [a.size + 3, a.size + 3],
    ] as const) {
      expect(a.isDark(x, y)).toBe(false);
    }
  });

  it('concorda com a leitura direta do buffer', () => {
    const a = exigirArtefato(URL_EXEMPLO, 'Q');
    for (let y = 0; y < a.size; y++) {
      for (let x = 0; x < a.size; x++) {
        expect(a.isDark(x, y)).toBe(a.data[y * a.size + x] === 1);
      }
    }
  });
});

describe('erros', () => {
  it('conteudo vazio', () => {
    const r = criarArtefato('', 'H');
    expect(r).toEqual({ ok: false, erro: { tipo: 'vazio' } });
  });

  it('conteudo alem do teto do formato, com sugestao de nivel', () => {
    const r = criarArtefato('x'.repeat(1500), 'H');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('inesperado');
    expect(r.erro.tipo).toBe('excede-capacidade');
    if (r.erro.tipo !== 'excede-capacidade') throw new Error('inesperado');
    expect(r.erro.bytes).toBe(1500);
    expect(r.erro.capacidade).toBe(1273);
    expect(r.erro.nivel).toBe('H');
    expect(r.erro.sugestao).toBe('Q'); // cabe em Q, que vai ate 1663
  });

  it('sem sugestao quando nao cabe em nivel nenhum', () => {
    const r = criarArtefato('x'.repeat(3000), 'L');
    if (r.ok) throw new Error('inesperado');
    if (r.erro.tipo !== 'excede-capacidade') throw new Error('inesperado');
    expect(r.erro.sugestao).toBeNull();
  });

  it('aceita exatamente o conteudo do tamanho do teto', () => {
    const a = exigirArtefato('x'.repeat(1273), 'H');
    expect(a.version).toBe(40);
    expect(a.byteLength).toBe(1273);
  });
});
