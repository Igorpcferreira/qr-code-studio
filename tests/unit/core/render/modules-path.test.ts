import { describe, expect, it } from 'vitest';
import { criarArtefato } from '@/core/qr/create';
import type { QrArtifact } from '@/core/qr/types';
import { NIVEIS_CORRECAO } from '@/core/qr/types';
import { caminhoDosModulos, contarRuns } from '@/core/render/modules-path';

function artefato(conteudo: string, nivel: Parameters<typeof criarArtefato>[1] = 'H'): QrArtifact {
  const r = criarArtefato(conteudo, nivel);
  if (!r.ok) throw new Error('esperava sucesso');
  return r.artefato;
}

const URL_EXEMPLO = 'https://loja.exemplo.com.br/colecao/streetwear/drop-07?ref=etiqueta&sku=TS-0042';

/**
 * Interpreta o caminho gerado e devolve as celulas que ele cobre.
 *
 * Escrito de proposito como parser ingenuo e independente: se ele e o gerador
 * compartilhassem codigo, o teste nao provaria nada.
 */
function celulasDoCaminho(d: string): Set<string> {
  const celulas = new Set<string>();
  const comando = /M(-?\d+) (-?\d+)h(\d+)v1h-\d+z/g;

  let achado: RegExpExecArray | null;
  let consumido = 0;
  while ((achado = comando.exec(d)) !== null) {
    consumido += achado[0].length;
    const x = Number(achado[1]);
    const y = Number(achado[2]);
    const largura = Number(achado[3]);
    for (let i = 0; i < largura; i++) celulas.add(`${x + i},${y}`);
  }

  // Nada pode sobrar: se o caminho tiver comando fora do formato esperado, o
  // parser estaria ignorando desenho em silencio.
  if (consumido !== d.length) {
    throw new Error(`caminho tem comandos nao reconhecidos (${consumido} de ${d.length} chars consumidos)`);
  }
  return celulas;
}

/** As celulas escuras, com a quiet zone somada — a referencia ingenua. */
function celulasEscuras(a: QrArtifact): Set<string> {
  const celulas = new Set<string>();
  for (let y = 0; y < a.size; y++) {
    for (let x = 0; x < a.size; x++) {
      if (a.isDark(x, y)) celulas.add(`${x + a.quietZone},${y + a.quietZone}`);
    }
  }
  return celulas;
}

describe('merge de modulos em runs', () => {
  /**
   * Criterio de aceite da Fase 1: "conferir que o merge de modulos produz o
   * mesmo desenho que um rect por modulo". Comparacao exata de conjuntos, nos
   * quatro niveis e em conteudos de tamanhos bem diferentes.
   */
  it('cobre exatamente os modulos escuros, sem sobra nem falta', () => {
    for (const conteudo of ['a', URL_EXEMPLO, 'x'.repeat(400), 'ação · çedilha · 日本']) {
      for (const nivel of NIVEIS_CORRECAO) {
        const a = artefato(conteudo, nivel);
        const doCaminho = celulasDoCaminho(caminhoDosModulos(a));
        const daMatriz = celulasEscuras(a);

        const faltando = [...daMatriz].filter((c) => !doCaminho.has(c));
        const sobrando = [...doCaminho].filter((c) => !daMatriz.has(c));

        expect(faltando, `v${a.version} ${nivel}: modulos nao desenhados`).toEqual([]);
        expect(sobrando, `v${a.version} ${nivel}: modulos desenhados a mais`).toEqual([]);
      }
    }
  });

  it('nao emite comando algum para um run que ja foi coberto', () => {
    const a = artefato(URL_EXEMPLO, 'H');
    const d = caminhoDosModulos(a);
    const comandos = d.match(/M/g)?.length ?? 0;
    expect(comandos).toBe(contarRuns(a));
  });

  it('desloca tudo pela quiet zone', () => {
    const a = artefato(URL_EXEMPLO, 'H');
    const celulas = celulasDoCaminho(caminhoDosModulos(a));

    for (const celula of celulas) {
      const [x, y] = celula.split(',').map(Number) as [number, number];
      expect(x).toBeGreaterThanOrEqual(a.quietZone);
      expect(y).toBeGreaterThanOrEqual(a.quietZone);
      expect(x).toBeLessThan(a.size + a.quietZone);
      expect(y).toBeLessThan(a.size + a.quietZone);
    }
  });

  it('usa apenas coordenadas inteiras', () => {
    const d = caminhoDosModulos(artefato(URL_EXEMPLO, 'Q'));
    expect(d).not.toMatch(/\d\.\d/);
  });

  it('encolhe o desenho em uma ordem de grandeza', () => {
    const a = artefato(URL_EXEMPLO, 'H');

    let ingenuo = '';
    for (let y = 0; y < a.size; y++) {
      for (let x = 0; x < a.size; x++) {
        if (a.isDark(x, y)) {
          ingenuo += `<rect x="${x + a.quietZone}" y="${y + a.quietZone}" width="1" height="1"/>`;
        }
      }
    }

    const mesclado = caminhoDosModulos(a);
    expect(mesclado.length).toBeLessThan(ingenuo.length / 5);
    expect(contarRuns(a)).toBeLessThan(a.size * a.size * 0.35);
  });

  it('um QR sem modulo escuro produziria caminho vazio', () => {
    const vazio: QrArtifact = {
      ...artefato('a', 'L'),
      isDark: () => false,
    };
    expect(caminhoDosModulos(vazio)).toBe('');
  });
});
