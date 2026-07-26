import { describe, expect, it } from 'vitest';
import { criarArtefato } from '@/core/qr/create';
import {
  LIMITE_AREA_LOGO,
  areaRelativaDoLogo,
  avaliarLogo,
  ladoDaMatrizMm,
  ladoMaximoDoLogoMm,
} from '@/core/qr/logo';
import type { ErrorCorrection, QrArtifact } from '@/core/qr/types';

function artefato(nivel: ErrorCorrection): QrArtifact {
  const r = criarArtefato('https://arquivo.gov.br/registro/8841', nivel);
  if (!r.ok) throw new Error('esperava sucesso');
  return r.artefato;
}

const LADO = 40;

describe('area relativa a matriz', () => {
  /**
   * A distincao que um teste do incremento 3 pegou: medir a area contra o lado
   * total incluiria a quiet zone, que sao 8 modulos sem dado nenhum, e
   * permitiria um logo maior do que o que foi de fato testado.
   */
  it('desconta a quiet zone do lado do codigo', () => {
    const a = artefato('H');
    expect(ladoDaMatrizMm(a, LADO)).toBeCloseTo((LADO * a.size) / (a.size + 8), 10);
    expect(ladoDaMatrizMm(a, LADO)).toBeLessThan(LADO);
  });

  it('lado maximo e a raiz do limite sobre o lado da matriz', () => {
    const a = artefato('H');
    const maximo = ladoMaximoDoLogoMm(a, LADO);
    expect(areaRelativaDoLogo(a, LADO, maximo)).toBeCloseTo(LIMITE_AREA_LOGO, 10);
  });

  it('area cresce com o quadrado do lado', () => {
    const a = artefato('H');
    const base = areaRelativaDoLogo(a, LADO, 5);
    expect(areaRelativaDoLogo(a, LADO, 10)).toBeCloseTo(base * 4, 10);
  });
});

describe('avaliarLogo', () => {
  it('aceita logo dentro do limite em H', () => {
    const a = artefato('H');
    expect(avaliarLogo(a, LADO, ladoMaximoDoLogoMm(a, LADO))).toEqual({ permitido: true });
  });

  it('recusa qualquer logo fora do nivel H', () => {
    for (const nivel of ['L', 'M', 'Q'] as const) {
      const a = artefato(nivel);
      const veredicto = avaliarLogo(a, LADO, 1);
      expect(veredicto.permitido, nivel).toBe(false);
      if (veredicto.permitido) throw new Error('inesperado');
      expect(veredicto.motivo).toContain('correção H');
    }
  });

  it('recusa acima do limite e diz o lado maximo', () => {
    const a = artefato('H');
    const veredicto = avaliarLogo(a, LADO, ladoMaximoDoLogoMm(a, LADO) * 1.5);

    expect(veredicto.permitido).toBe(false);
    if (veredicto.permitido) throw new Error('inesperado');
    expect(veredicto.motivo).toContain('36%'); // 16% x 1,5^2
    expect(veredicto.sugestao).toMatch(/\d+,\d mm/);
  });

  it('a sugestao devolvida de fato passa na propria avaliacao', () => {
    const a = artefato('H');
    const veredicto = avaliarLogo(a, LADO, 30);
    if (veredicto.permitido) throw new Error('inesperado');

    const sugerido = Number(/(\d+,\d) mm/.exec(veredicto.sugestao)?.[1]?.replace(',', '.'));
    expect(Number.isFinite(sugerido)).toBe(true);
    expect(avaliarLogo(a, LADO, sugerido).permitido).toBe(true);
  });

  it('o limite e inclusivo', () => {
    const a = artefato('H');
    expect(avaliarLogo(a, LADO, ladoMaximoDoLogoMm(a, LADO)).permitido).toBe(true);
  });
});
