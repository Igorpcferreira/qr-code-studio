import { describe, expect, it } from 'vitest';
import {
  DPIS_SUPORTADOS,
  MM_POR_POLEGADA,
  ajustarParaModuloInteiro,
  arredondarPx,
  converter,
  formatarComprimento,
  mmParaPx,
  pxParaMm,
} from '@/lib/units';

describe('conversao px <-> mm', () => {
  it('ancora numa polegada', () => {
    for (const dpi of DPIS_SUPORTADOS) {
      expect(mmParaPx(MM_POR_POLEGADA, dpi)).toBeCloseTo(dpi, 10);
      expect(pxParaMm(dpi, dpi)).toBeCloseTo(MM_POR_POLEGADA, 10);
    }
  });

  it('confere valores conhecidos de impressao', () => {
    expect(mmParaPx(210, 300)).toBeCloseTo(2480.3, 1); // A4 a 300 dpi
    expect(mmParaPx(50, 300)).toBeCloseTo(590.55, 2); // etiqueta 50 mm
    expect(pxParaMm(1024, 300)).toBeCloseTo(86.7, 1); // o "1024 px / 87 mm" do board
  });

  it('faz ida e volta sem perda em todos os DPIs', () => {
    for (const dpi of DPIS_SUPORTADOS) {
      for (const px of [1, 96, 300, 768, 1024, 4096]) {
        expect(pxParaMm(mmParaPx(pxParaMm(px, dpi), dpi), dpi)).toBeCloseTo(pxParaMm(px, dpi), 10);
        expect(mmParaPx(pxParaMm(px, dpi), dpi)).toBeCloseTo(px, 10);
      }
    }
  });

  it('escala linearmente com o DPI', () => {
    expect(mmParaPx(100, 600)).toBeCloseTo(mmParaPx(100, 300) * 2, 10);
    expect(mmParaPx(100, 150)).toBeCloseTo(mmParaPx(100, 300) / 2, 10);
  });

  it('zero permanece zero', () => {
    expect(mmParaPx(0, 300)).toBe(0);
    expect(pxParaMm(0, 300)).toBe(0);
  });
});

describe('converter', () => {
  it('e identidade quando a unidade nao muda', () => {
    expect(converter(123.456, 'px', 'px', 300)).toBe(123.456);
    expect(converter(123.456, 'mm', 'mm', 300)).toBe(123.456);
  });

  it('delega para a conversao correta', () => {
    expect(converter(25.4, 'mm', 'px', 300)).toBeCloseTo(300, 10);
    expect(converter(300, 'px', 'mm', 300)).toBeCloseTo(25.4, 10);
  });
});

describe('arredondarPx', () => {
  it('nunca devolve zero', () => {
    expect(arredondarPx(0)).toBe(1);
    expect(arredondarPx(0.2)).toBe(1);
    expect(arredondarPx(-5)).toBe(1);
  });

  it('arredonda normalmente acima de 1', () => {
    expect(arredondarPx(10.4)).toBe(10);
    expect(arredondarPx(10.6)).toBe(11);
  });
});

describe('ajustarParaModuloInteiro', () => {
  /**
   * Modulo em fracao de pixel produz costura no PNG — linhas claras entre
   * modulos que atrapalham o scanner. O lado precisa ser multiplo da contagem.
   */
  it('devolve multiplo exato da contagem de modulos', () => {
    for (const modulos of [29, 37, 41, 49, 185]) {
      for (const pedido of [300, 512, 1000, 1024, 2048]) {
        const ajustado = ajustarParaModuloInteiro(pedido, modulos);
        expect(ajustado % modulos).toBe(0);
        expect(ajustado).toBeLessThanOrEqual(pedido);
      }
    }
  });

  it('mantem o lado quando ja e multiplo', () => {
    expect(ajustarParaModuloInteiro(41 * 20, 41)).toBe(820);
  });

  it('garante ao menos 1 pixel por modulo quando o pedido e pequeno demais', () => {
    expect(ajustarParaModuloInteiro(10, 49)).toBe(49);
  });
});

describe('formatarComprimento', () => {
  it('formata como a interface mostra', () => {
    expect(formatarComprimento(1024, 'px')).toBe('1024 px');
    expect(formatarComprimento(1023.6, 'px')).toBe('1024 px');
    expect(formatarComprimento(86.69, 'mm')).toBe('86,7 mm');
  });
});
