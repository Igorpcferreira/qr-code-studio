import { describe, expect, it } from 'vitest';
import {
  MODULO_MINIMO_MM,
  RAZAO_DISTANCIA_LEITURA,
  avaliarImpressao,
  descreverDistancia,
  distanciaMaximaMm,
  ladoMinimoMm,
} from '@/lib/scan-distance';

describe('distancia de leitura', () => {
  it('aplica a razao 10:1', () => {
    expect(distanciaMaximaMm(30)).toBe(300);
    expect(distanciaMaximaMm(100)).toBe(1000);
    expect(RAZAO_DISTANCIA_LEITURA).toBe(10);
  });

  it('lado minimo e a operacao inversa', () => {
    for (const lado of [10, 25, 87, 210]) {
      expect(ladoMinimoMm(distanciaMaximaMm(lado))).toBeCloseTo(lado, 10);
    }
  });

  it('descreve na unidade adequada a escala', () => {
    expect(descreverDistancia(30)).toContain('30 cm');
    expect(descreverDistancia(200)).toContain('2,0 m');
    expect(descreverDistancia(500)).toContain('5,0 m');
  });
});

describe('avaliarImpressao', () => {
  const v6ComQuietZone = 41 + 8; // versao 6 mais quiet zone dos dois lados

  it('calcula o lado do modulo em mm e px', () => {
    const a = avaliarImpressao({ ladoMm: 49, modulosComQuietZone: v6ComQuietZone, dpi: 300 });
    expect(a.moduloMm).toBeCloseTo(1, 10);
    expect(a.moduloPx).toBeCloseTo(300 / 25.4, 6);
  });

  it('aprova quando o modulo alcanca 0,4 mm', () => {
    const a = avaliarImpressao({ ladoMm: 30, modulosComQuietZone: v6ComQuietZone, dpi: 300 });
    expect(a.moduloMm).toBeGreaterThanOrEqual(MODULO_MINIMO_MM);
    expect(a.imprimivel).toBe(true);
    expect(a.aviso).toBeNull();
  });

  it('reprova modulo pequeno demais e diz qual lado usar', () => {
    const a = avaliarImpressao({ ladoMm: 15, modulosComQuietZone: v6ComQuietZone, dpi: 300 });
    expect(a.imprimivel).toBe(false);
    expect(a.aviso).toContain('0,4 mm');
    // A sugestao precisa de fato resolver o problema.
    const sugerido = Number(/ao menos (\d+) mm/.exec(a.aviso ?? '')?.[1]);
    expect(Number.isFinite(sugerido)).toBe(true);
    expect(
      avaliarImpressao({ ladoMm: sugerido, modulosComQuietZone: v6ComQuietZone, dpi: 300 }).imprimivel,
    ).toBe(true);
  });

  it('trata o limiar como inclusivo', () => {
    const ladoExato = v6ComQuietZone * MODULO_MINIMO_MM;
    expect(
      avaliarImpressao({ ladoMm: ladoExato, modulosComQuietZone: v6ComQuietZone, dpi: 300 }).imprimivel,
    ).toBe(true);
  });

  it('o DPI muda o modulo em px mas nao em mm', () => {
    const base = { ladoMm: 49, modulosComQuietZone: v6ComQuietZone };
    const a150 = avaliarImpressao({ ...base, dpi: 150 });
    const a600 = avaliarImpressao({ ...base, dpi: 600 });
    expect(a600.moduloMm).toBeCloseTo(a150.moduloMm, 10);
    expect(a600.moduloPx).toBeCloseTo(a150.moduloPx * 4, 6);
    expect(a600.imprimivel).toBe(a150.imprimivel);
  });

  it('um QR grande exige menos densidade que um pequeno', () => {
    const pequeno = avaliarImpressao({ ladoMm: 20, modulosComQuietZone: 185, dpi: 300 });
    const grande = avaliarImpressao({ ladoMm: 200, modulosComQuietZone: 185, dpi: 300 });
    expect(pequeno.imprimivel).toBe(false);
    expect(grande.imprimivel).toBe(true);
  });

  it('rejeita entradas nao positivas', () => {
    expect(() => avaliarImpressao({ ladoMm: 0, modulosComQuietZone: 49, dpi: 300 })).toThrow(RangeError);
    expect(() => avaliarImpressao({ ladoMm: 50, modulosComQuietZone: 0, dpi: 300 })).toThrow(RangeError);
    expect(() => avaliarImpressao({ ladoMm: 50, modulosComQuietZone: 49, dpi: 0 })).toThrow(RangeError);
  });
});
