import { describe, expect, it } from 'vitest';
import { criarArtefato } from '@/core/qr/create';
import type { ErrorCorrection, QrArtifact } from '@/core/qr/types';
import { NIVEIS_CORRECAO } from '@/core/qr/types';
import type { FormaModulo, Primitiva } from '@/core/render/formas';
import {
  FORMAS,
  caminhoDasPrimitivas,
  camadasDasPrimitivas,
  contemPonto,
  formaModulo,
  limitesDaPrimitiva,
  primitivasDoCodigo,
} from '@/core/render/formas';
import { caminhoDosModulos } from '@/core/render/modules-path';
import type { Bitmap } from '@/core/render/raster';
import { rasterizarCena } from '@/core/render/raster';
import { renderizarSvg } from '@/core/render/svg';
import { construirCenaBasica } from '@/core/scene/build';
import { paint } from '@/core/scene/types';
import { decodificadorJsQr, escalaParaVerificacao } from '@/core/verify/decode';
import { verificarLeitura } from '@/core/verify/verify';

/**
 * O teste que sustenta a personalizacao inteira.
 *
 * Trocar a forma do modulo e a unica funcionalidade deste produto que pode
 * quebrar a leitura em silencio: o arquivo continua bonito, o contraste
 * continua alto, e o celular do cliente simplesmente nao le. Por isso aqui nao
 * se testa aparencia — testa-se que o centro de cada modulo mantem a cor certa
 * e que o codigo volta a ser decodificado em todas as formas.
 */

const IDS: readonly FormaModulo[] = FORMAS.map((f) => f.id);

const LADO_MM = 40;

function artefato(conteudo: string, nivel: ErrorCorrection = 'H'): QrArtifact {
  const r = criarArtefato(conteudo, nivel);
  if (!r.ok) throw new Error(`esperava sucesso: ${JSON.stringify(r.erro)}`);
  return r.artefato;
}

function pixel(b: Bitmap, x: number, y: number): readonly [number, number, number] {
  const i = (y * b.width + x) * 4;
  return [b.data[i] ?? -1, b.data[i + 1] ?? -1, b.data[i + 2] ?? -1];
}

const URL_EXEMPLO = 'https://arquivo.gov.br/registro/8841';

describe('catalogo de formas', () => {
  it('expoe cinco formas, com a classica primeira', () => {
    expect(IDS[0]).toBe('quadrado');
    expect(IDS).toHaveLength(5);
    expect(IDS).toContain('circuito');
  });

  it('cada forma tem nome e descricao proprios', () => {
    const nomes = new Set(FORMAS.map((f) => f.nome));
    const descricoes = new Set(FORMAS.map((f) => f.descricao));
    expect(nomes.size).toBe(FORMAS.length);
    expect(descricoes.size).toBe(FORMAS.length);
  });

  it('recusa forma desconhecida em vez de cair no default', () => {
    expect(() => formaModulo('espiral' as FormaModulo)).toThrow(RangeError);
  });
});

describe('primitivas', () => {
  /**
   * A invariante que o decodificador cobra: ele amostra o **centro** do modulo.
   * Uma forma pode encolher e arredondar a tinta; nao pode deslocar o centro
   * nem vazar para a celula vizinha.
   *
   * A checagem nao e no centro exato, e sim numa vizinhanca de 0,15 modulo ao
   * redor dele. Centro exato passaria com folga zero — e folga zero e o que
   * quebra quando o pixel amostrado cai meio pixel fora, que e o caso normal
   * em qualquer escala que nao seja multipla inteira do modulo.
   */
  const MARGEM = 0.15;

  it.each(IDS)('forma %s: a vizinhanca do centro de cada modulo mantem a cor certa', (forma) => {
    const a = artefato(URL_EXEMPLO);
    const primitivas = primitivasDoCodigo(a, forma);

    /** Cor resultante no ponto, em unidades de modulo, respeitando a ordem de pintura. */
    const tintaEm = (mx: number, my: number): 'escuro' | 'claro' => {
      let atual: 'escuro' | 'claro' = 'claro';
      for (const p of primitivas) {
        if (contemPonto(p, mx, my)) atual = p.tinta === 'claro' ? 'claro' : 'escuro';
      }
      return atual;
    };

    const desvios: readonly (readonly [number, number])[] = [
      [0, 0],
      [MARGEM, 0],
      [-MARGEM, 0],
      [0, MARGEM],
      [0, -MARGEM],
      [MARGEM, MARGEM],
      [-MARGEM, -MARGEM],
    ];

    const q = a.quietZone;
    for (let y = 0; y < a.size; y++) {
      for (let x = 0; x < a.size; x++) {
        const esperado = a.isDark(x, y) ? 'escuro' : 'claro';
        for (const [dx, dy] of desvios) {
          const lido = tintaEm(x + q + 0.5 + dx, y + q + 0.5 + dy);
          expect(`${forma} (${x},${y})+(${dx},${dy}) ${lido}`).toBe(
            `${forma} (${x},${y})+(${dx},${dy}) ${esperado}`,
          );
        }
      }
    }
  });

  it('nenhuma primitiva escapa da area do codigo com a quiet zone', () => {
    const a = artefato(URL_EXEMPLO);
    for (const forma of IDS) {
      for (const p of primitivasDoCodigo(a, forma)) {
        const caixa = limitesDaPrimitiva(p);
        expect(caixa.x0).toBeGreaterThanOrEqual(0);
        expect(caixa.y0).toBeGreaterThanOrEqual(0);
        expect(caixa.x1).toBeLessThanOrEqual(a.sizeComQuietZone);
        expect(caixa.y1).toBeLessThanOrEqual(a.sizeComQuietZone);
      }
    }
  });

  it('os tres marcadores viram peca unica, fora da varredura de modulos', () => {
    const a = artefato(URL_EXEMPLO);
    const comMarcador = primitivasDoCodigo(a, 'ponto');
    const semMarcador = primitivasDoCodigo(a, 'ponto', { marcadores: false });

    expect(comMarcador.filter((p) => p.tinta === 'olhos')).toHaveLength(6);
    expect(semMarcador.some((p) => p.tinta === 'olhos')).toBe(false);
    // Sem estilizacao os 3 x 33 modulos dos marcadores voltam como circulos.
    expect(semMarcador.length).toBeGreaterThan(comMarcador.length);
  });

  /**
   * Ordem de pintura, nao ordem de cor: o vazado claro do marcador vem depois
   * do anel cheio. Agrupar por tinta devolveria o anel por cima e os tres
   * marcadores sairiam solidos — codigo nenhum seria localizado.
   */
  it('as camadas preservam a ordem de pintura do marcador', () => {
    const camadas = camadasDasPrimitivas(primitivasDoCodigo(artefato(URL_EXEMPLO), 'circuito'));
    expect(camadas.map((c) => c.tinta)).toEqual(['olhos', 'claro', 'olhos', 'escuro']);
  });

  it('o caminho usa so reta e Bezier cubica, que todo interpretador entende', () => {
    for (const forma of IDS) {
      const primitivas = primitivasDoCodigo(artefato(URL_EXEMPLO), forma);
      const d = camadasDasPrimitivas(primitivas)
        .map((c) => c.caminho)
        .join('');
      expect(d).not.toMatch(/[AaQqSsTt]/);
      expect(d).toMatch(/^[MLCHVhvzZ0-9eE.,\s-]+$/);
    }
  });

  it('a forma classica em primitivas casa com o caminho enxuto de sempre', () => {
    const a = artefato(URL_EXEMPLO);
    const primitivas = primitivasDoCodigo(a, 'quadrado', { marcadores: false });
    expect(caminhoDasPrimitivas(primitivas, 'escuro')).toBe(caminhoDosModulos(a));
  });

  it('contemPonto respeita o raio do canto', () => {
    const p: Primitiva = { tipo: 'rect', x: 0, y: 0, w: 2, h: 2, raios: [1, 0, 0, 0], tinta: 'escuro' };
    // Canto superior esquerdo cortado pelo arco, os outros tres inteiros.
    expect(contemPonto(p, 0.05, 0.05)).toBe(false);
    expect(contemPonto(p, 1.95, 0.05)).toBe(true);
    expect(contemPonto(p, 1.95, 1.95)).toBe(true);
    expect(contemPonto(p, 0.05, 1.95)).toBe(true);
    expect(contemPonto(p, 1, 1)).toBe(true);
  });
});

describe('leitura de volta', () => {
  /**
   * O criterio de aceitacao de uma forma nova: o rasterizador puro desenha, o
   * jsQR le, e o que volta e exatamente o que entrou. Sem isso a forma nao
   * entra no catalogo.
   */
  it.each(IDS)('forma %s decodifica de volta em todos os niveis de correcao', (forma) => {
    for (const nivel of NIVEIS_CORRECAO) {
      const a = artefato(URL_EXEMPLO, nivel);
      const cena = construirCenaBasica(a, LADO_MM, { forma });
      const veredicto = verificarLeitura(cena);
      expect(`${forma}/${nivel}: ${veredicto.conteudoLido}`).toBe(`${forma}/${nivel}: ${URL_EXEMPLO}`);
      expect(veredicto.ok).toBe(true);
    }
  });

  it.each(IDS)('forma %s decodifica um conteudo longo, de versao alta', (forma) => {
    const longo = `https://loja.exemplo.com.br/colecao/streetwear/drop-07?${'p=1&'.repeat(60)}fim=1`;
    const a = artefato(longo, 'M');
    expect(a.version).toBeGreaterThan(9);

    const cena = construirCenaBasica(a, 60, { forma });
    const escala = escalaParaVerificacao(60, a.sizeComQuietZone);
    expect(decodificadorJsQr.decodificar(rasterizarCena(cena, escala))).toBe(longo);
  });

  it('marcador com cor propria continua sendo lido', () => {
    const a = artefato(URL_EXEMPLO);
    const cena = construirCenaBasica(a, LADO_MM, {
      forma: 'circuito',
      olhos: paint('#2c36f0'),
    });
    expect(verificarLeitura(cena).ok).toBe(true);
  });

  /**
   * Marcador claro demais e a falha silenciosa da personalizacao de cor: os
   * modulos continuam perfeitos e o detector nao acha o codigo. A causa vem de
   * experimento, nao de palpite.
   */
  it('acusa a forma quando ela e a responsavel pela falha', () => {
    const a = artefato(URL_EXEMPLO);
    const cena = construirCenaBasica(a, LADO_MM, { forma: 'ponto', olhos: paint('#e6e6e6') });
    const veredicto = verificarLeitura(cena);

    expect(veredicto.ok).toBe(false);
    expect(veredicto.causa?.tipo).toBe('forma');
    expect(veredicto.causa?.confirmada).toBe(true);
  });
});

describe('renderizadores concordam', () => {
  /**
   * SVG e rasterizador sao duas implementacoes independentes da mesma lista de
   * primitivas — um emite caminho, o outro testa ponto a ponto. Se divergirem,
   * o usuario baixa um arquivo diferente do que foi verificado.
   */
  it.each(IDS)('forma %s: o rasterizador pinta o centro dos modulos como o SVG descreve', (forma) => {
    const a = artefato(URL_EXEMPLO);
    const cena = construirCenaBasica(a, LADO_MM, { forma });
    const pxPorMm = escalaParaVerificacao(LADO_MM, a.sizeComQuietZone, 8);
    const bitmap = rasterizarCena(cena, pxPorMm);

    const passo = (LADO_MM * pxPorMm) / a.sizeComQuietZone;
    const q = a.quietZone;

    for (let y = 0; y < a.size; y++) {
      for (let x = 0; x < a.size; x++) {
        const px = Math.floor((x + q + 0.5) * passo);
        const py = Math.floor((y + q + 0.5) * passo);
        const [r] = pixel(bitmap, px, py);
        expect(`${x},${y}:${r < 128 ? 'escuro' : 'claro'}`).toBe(
          `${x},${y}:${a.isDark(x, y) ? 'escuro' : 'claro'}`,
        );
      }
    }
  });

  it('o SVG classico continua saindo como um unico objeto', () => {
    const svg = renderizarSvg(construirCenaBasica(artefato(URL_EXEMPLO), LADO_MM, { forma: 'quadrado' }));
    expect(svg.match(/<path/g)).toHaveLength(1);
  });

  it('as formas com curva saem em quatro caminhos, nao em mil objetos', () => {
    for (const forma of IDS.filter((f) => f !== 'quadrado')) {
      const svg = renderizarSvg(construirCenaBasica(artefato(URL_EXEMPLO), LADO_MM, { forma }));
      expect(svg.match(/<path/g)).toHaveLength(4);
      expect(svg).toContain('shape-rendering="geometricPrecision"');
    }
  });
});
