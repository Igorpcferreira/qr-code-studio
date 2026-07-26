import { describe, expect, it } from 'vitest';
import { criarArtefato } from '@/core/qr/create';
import type { ErrorCorrection, QrArtifact } from '@/core/qr/types';
import type { Bitmap } from '@/core/render/raster';
import { rasterizarCena } from '@/core/render/raster';
import { construirCenaBasica } from '@/core/scene/build';
import {
  EIXOS_PADRAO,
  aplicarBorrao,
  aplicarOclusao,
  aplicarRotacao,
  aplicarRuido,
  medirMargemDeDano,
} from '@/core/verify/damage';
import { decodificadorJsQr, escalaParaVerificacao } from '@/core/verify/decode';

const CONTEUDO = 'https://arquivo.gov.br/registro/8841';
const LADO_MM = 40;

function artefato(nivel: ErrorCorrection): QrArtifact {
  const r = criarArtefato(CONTEUDO, nivel);
  if (!r.ok) throw new Error('esperava sucesso');
  return r.artefato;
}

function bitmapDe(nivel: ErrorCorrection, pxPorModulo = 8): Bitmap {
  const a = artefato(nivel);
  return rasterizarCena(
    construirCenaBasica(a, LADO_MM),
    escalaParaVerificacao(LADO_MM, a.sizeComQuietZone, pxPorModulo),
  );
}

describe('degradacoes', () => {
  it('sao neutras em intensidade zero', () => {
    const b = bitmapDe('H');
    for (const [nome, degradado] of [
      ['oclusao', aplicarOclusao(b, 0)],
      ['ruido', aplicarRuido(b, 0)],
      ['borrao', aplicarBorrao(b, 0)],
      ['rotacao', aplicarRotacao(b, 0)],
    ] as const) {
      expect(decodificadorJsQr.decodificar(degradado), nome).toBe(CONTEUDO);
    }
  });

  it('nao mexem no bitmap original', () => {
    const b = bitmapDe('H');
    const copia = new Uint8ClampedArray(b.data);
    aplicarOclusao(b, 0.3);
    aplicarRuido(b, 64);
    aplicarBorrao(b, 4);
    aplicarRotacao(b, 30);
    expect(b.data).toEqual(copia);
  });

  /** Semente fixa: dois usuarios com a mesma configuracao veem o mesmo numero. */
  it('sao reproduziveis', () => {
    const b = bitmapDe('H');
    expect(aplicarOclusao(b, 0.2).data).toEqual(aplicarOclusao(b, 0.2).data);
    expect(aplicarRuido(b, 48).data).toEqual(aplicarRuido(b, 48).data);
  });

  it('degradam de verdade', () => {
    const b = bitmapDe('H');
    const diferencas = (x: Bitmap): number => {
      let n = 0;
      for (let i = 0; i < b.data.length; i++) if (b.data[i] !== x.data[i]) n++;
      return n;
    };
    expect(diferencas(aplicarOclusao(b, 0.3))).toBeGreaterThan(0);
    expect(diferencas(aplicarRuido(b, 64))).toBeGreaterThan(0);
    expect(diferencas(aplicarBorrao(b, 3))).toBeGreaterThan(0);
  });

  it('a rotacao expande a tela e preenche o fundo de branco', () => {
    const b = bitmapDe('H');
    const girado = aplicarRotacao(b, 45);
    expect(girado.width).toBeGreaterThan(b.width);
    // O canto vira area nova, fora do original.
    expect([girado.data[0], girado.data[1], girado.data[2]]).toEqual([255, 255, 255]);
  });
});

describe('medirMargemDeDano', () => {
  it('devolve um eixo por degradacao pedida', () => {
    const margens = medirMargemDeDano(bitmapDe('H'), CONTEUDO, decodificadorJsQr, {
      eixos: ['oclusao', 'borrao'],
    });
    expect(margens.map((m) => m.eixo)).toEqual(['oclusao', 'borrao']);
    for (const m of margens) expect(m.descricao.length).toBeGreaterThan(0);
  });

  /**
   * O ponto do teste de dano: transformar "seu codigo funciona" em "seu codigo
   * aguenta X". Correcao mais alta tem que aguentar mais oclusao — se nao
   * aguentasse, ou a medicao ou o gerador estariam errados.
   */
  it('correcao mais robusta tolera mais oclusao', () => {
    const tolerancia = (nivel: ErrorCorrection): number =>
      medirMargemDeDano(bitmapDe(nivel), CONTEUDO, decodificadorJsQr, { eixos: ['oclusao'] })[0]
        ?.tolerancia ?? -1;

    expect(tolerancia('H')).toBeGreaterThan(tolerancia('L'));
  });

  it('a tolerancia relatada e de fato legivel, e o passo seguinte nao e', () => {
    const b = bitmapDe('H');
    const margem = medirMargemDeDano(b, CONTEUDO, decodificadorJsQr, { eixos: ['oclusao'] })[0];
    if (margem === undefined) throw new Error('sem margem');

    if (margem.tolerancia > 0) {
      expect(decodificadorJsQr.decodificar(aplicarOclusao(b, margem.tolerancia))).toBe(CONTEUDO);
    }
    // Um passo acima da tolerancia relatada precisa realmente falhar.
    expect(decodificadorJsQr.decodificar(aplicarOclusao(b, margem.tolerancia + 0.05))).not.toBe(CONTEUDO);
  });

  it('descreve em portugues legivel', () => {
    const margens = medirMargemDeDano(bitmapDe('H'), CONTEUDO, decodificadorJsQr, { eixos: ['oclusao'] });
    expect(margens[0]?.descricao).toMatch(/(Lê com até \d+% da área danificada|Não tolera)/);
  });

  it('o relatorio padrao traz os tres eixos que discriminam', () => {
    const margens = medirMargemDeDano(bitmapDe('H'), CONTEUDO, decodificadorJsQr);
    expect(margens.map((m) => m.eixo)).toEqual(EIXOS_PADRAO);
  });

  /**
   * Documenta por que a rotacao ficou fora do relatorio padrao: os tres padroes
   * de localizacao tornam o QR invariante a rotacao, entao o eixo satura no
   * maior passo em qualquer nivel e nao informa nada.
   */
  it('a rotacao satura, e por isso e opcional', () => {
    for (const nivel of ['L', 'H'] as const) {
      const margem = medirMargemDeDano(bitmapDe(nivel), CONTEUDO, decodificadorJsQr, {
        eixos: ['rotacao'],
      })[0];
      expect(margem?.tolerancia, nivel).toBe(45);
    }
  });
});
