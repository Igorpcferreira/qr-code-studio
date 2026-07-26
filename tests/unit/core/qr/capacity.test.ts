import { createRequire } from 'node:module';
import { create } from 'qrcode';
import { describe, expect, it } from 'vitest';
import {
  CAPACIDADE_BYTES,
  CAPACIDADE_MAXIMA_BYTES,
  capacidadeBytes,
  melhorNivelPara,
  versaoMinimaPara,
} from '@/core/qr/capacity';
import type { ErrorCorrection } from '@/core/qr/types';
import { NIVEIS_CORRECAO, VERSAO_MAXIMA, VERSAO_MINIMA } from '@/core/qr/types';

const require = createRequire(import.meta.url);

/** Internos da biblioteca. So acessiveis daqui, e so para servir de oraculo. */
interface VersionInterno {
  getCapacity(versao: number, nivel: unknown, modo: unknown): number;
}
const Version = require('qrcode/lib/core/version.js') as VersionInterno;
const ECLevel = require('qrcode/lib/core/error-correction-level.js') as Record<string, unknown>;
const Mode = require('qrcode/lib/core/mode.js') as Record<string, unknown>;

describe('tabela de capacidade', () => {
  /**
   * Guarda 1 — deriva. A tabela e copia de API privada do `qrcode`; se um
   * upgrade mudar qualquer celula, este teste quebra antes de a ficha tecnica
   * exibir um numero errado.
   */
  it('confere as 160 celulas contra a biblioteca', () => {
    const divergencias: string[] = [];

    for (const nivel of NIVEIS_CORRECAO) {
      for (let versao = VERSAO_MINIMA; versao <= VERSAO_MAXIMA; versao++) {
        const nosso = capacidadeBytes(versao, nivel);
        const deles = Version.getCapacity(versao, ECLevel[nivel], Mode.BYTE);
        if (nosso !== deles) divergencias.push(`v${versao} ${nivel}: nosso ${nosso}, lib ${deles}`);
      }
    }

    expect(divergencias).toEqual([]);
  });

  /**
   * Guarda 2 — comportamento. Independente da origem da tabela: se os numeros
   * estao certos, exatamente `capacidade` bytes cabem naquela versao e um byte
   * a mais nao cabe.
   *
   * Caracteres minusculos forcam o modo Byte: o conjunto alfanumerico do padrao
   * so tem maiusculas, digitos e nove simbolos, e o otimizador da biblioteca
   * escolheria Alphanumeric — que tem capacidade maior — se usassemos 'X'.
   */
  it('a capacidade e a fronteira real de cada versao', () => {
    const falhas: string[] = [];
    const amostras = [1, 2, 5, 6, 10, 15, 20, 27, 33, 40];

    for (const nivel of NIVEIS_CORRECAO) {
      for (const versao of amostras) {
        const capacidade = capacidadeBytes(versao, nivel);

        expect(() =>
          create('x'.repeat(capacidade), { version: versao, errorCorrectionLevel: nivel }),
        ).not.toThrow();

        let coube = true;
        try {
          create('x'.repeat(capacidade + 1), { version: versao, errorCorrectionLevel: nivel });
        } catch {
          coube = false;
        }
        if (coube)
          falhas.push(`v${versao} ${nivel}: aceitou ${capacidade + 1} bytes, capacidade diz ${capacidade}`);
      }
    }

    expect(falhas).toEqual([]);
  });

  it('cresce monotonicamente com a versao e decresce com a robustez', () => {
    for (const nivel of NIVEIS_CORRECAO) {
      for (let versao = VERSAO_MINIMA + 1; versao <= VERSAO_MAXIMA; versao++) {
        expect(capacidadeBytes(versao, nivel)).toBeGreaterThan(capacidadeBytes(versao - 1, nivel));
      }
    }

    for (let versao = VERSAO_MINIMA; versao <= VERSAO_MAXIMA; versao++) {
      expect(capacidadeBytes(versao, 'L')).toBeGreaterThan(capacidadeBytes(versao, 'M'));
      expect(capacidadeBytes(versao, 'M')).toBeGreaterThan(capacidadeBytes(versao, 'Q'));
      expect(capacidadeBytes(versao, 'Q')).toBeGreaterThan(capacidadeBytes(versao, 'H'));
    }
  });

  it('tem 40 entradas por nivel', () => {
    for (const nivel of NIVEIS_CORRECAO) {
      expect(CAPACIDADE_BYTES[nivel]).toHaveLength(40);
    }
  });

  it('rejeita versao fora de 1..40', () => {
    expect(() => capacidadeBytes(0, 'H')).toThrow(RangeError);
    expect(() => capacidadeBytes(41, 'H')).toThrow(RangeError);
    expect(() => capacidadeBytes(6.5, 'H')).toThrow(RangeError);
  });
});

describe('teto do formato', () => {
  /**
   * O brand board exibe "CAPACIDADE 1.782 / 2.303 bytes" para v6 nivel H, que e
   * impossivel: 2.303 e a capacidade da v35 no nivel L. Este teste fixa os
   * numeros reais, para que o desenho do board seja seguido sem herdar o erro.
   */
  it('registra o teto real de cada nivel', () => {
    expect(CAPACIDADE_MAXIMA_BYTES).toEqual({ L: 2953, M: 2331, Q: 1663, H: 1273 });
    expect(capacidadeBytes(6, 'H')).toBe(58);
  });
});

describe('escolha de versao e nivel', () => {
  it('acha a menor versao que comporta o conteudo', () => {
    expect(versaoMinimaPara(1, 'H')).toBe(1);
    expect(versaoMinimaPara(7, 'H')).toBe(1);
    expect(versaoMinimaPara(8, 'H')).toBe(2);
    expect(versaoMinimaPara(2953, 'L')).toBe(40);
  });

  it('devolve null quando nem a versao 40 comporta', () => {
    expect(versaoMinimaPara(2954, 'L')).toBeNull();
    expect(versaoMinimaPara(1274, 'H')).toBeNull();
  });

  it('sugere o nivel mais robusto que ainda comporta o conteudo', () => {
    expect(melhorNivelPara(100)).toBe('H');
    expect(melhorNivelPara(1300)).toBe('Q');
    expect(melhorNivelPara(1700)).toBe('M');
    expect(melhorNivelPara(2400)).toBe('L');
    expect(melhorNivelPara(3000)).toBeNull();
  });

  it('a sugestao e coerente com a tabela em toda a faixa', () => {
    for (const bytes of [1, 500, 1273, 1274, 1663, 1664, 2331, 2332, 2953, 2954]) {
      const nivel = melhorNivelPara(bytes);
      if (nivel === null) {
        for (const n of NIVEIS_CORRECAO) expect(CAPACIDADE_MAXIMA_BYTES[n]).toBeLessThan(bytes);
      } else {
        expect(CAPACIDADE_MAXIMA_BYTES[nivel as ErrorCorrection]).toBeGreaterThanOrEqual(bytes);
      }
    }
  });
});
