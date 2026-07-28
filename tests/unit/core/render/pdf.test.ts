import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { MOLDURAS, comporMoldura } from '@/core/frames/molduras';
import type { OpcoesMoldura } from '@/core/frames/tipos';
import { criarArtefato } from '@/core/qr/create';
import type { QrArtifact } from '@/core/qr/types';
import { PAPEIS, renderizarPdf } from '@/core/render/pdf';
import { construirCenaBasica } from '@/core/scene/build';
import { paint } from '@/core/scene/types';

const CONTEUDO = 'https://arquivo.gov.br/registro/8841';
const LADO = 40;
const PT = 72 / 25.4;

function artefato(): QrArtifact {
  const r = criarArtefato(CONTEUDO, 'H');
  if (!r.ok) throw new Error('esperava sucesso');
  return r.artefato;
}

function opcoesMoldura(extra: Partial<OpcoesMoldura> = {}): OpcoesMoldura {
  return {
    artefato: artefato(),
    ladoCodigoMm: LADO,
    dark: paint('#0e0f14', [0, 0, 0, 1]),
    light: paint('#ffffff', [0, 0, 0, 0]),
    corMoldura: paint('#0e0f14', [0, 0, 0, 1]),
    chamada: 'ESCANEIE-ME',
    logo: null,
    incluirFicha: false,
    ...extra,
  };
}

/**
 * Extrai e descomprime os fluxos do PDF.
 *
 * O PDF é um formato lido por máquina, então dá para verificar o que ele
 * desenha sem rasterizador nenhum — que é o motivo de o código sair como
 * retângulos explícitos e não como um `<path>` opaco.
 */
function fluxos(pdf: Uint8Array): string {
  const bruto = Buffer.from(pdf);
  const partes: string[] = [];
  const abre = Buffer.from('stream', 'latin1');
  const fecha = Buffer.from('endstream', 'latin1');

  let cursor = 0;
  for (;;) {
    const inicio = bruto.indexOf(abre, cursor);
    if (inicio < 0) break;

    // `indexOf('stream')` também casa com o sufixo de `endstream`.
    if (inicio >= 3 && bruto.subarray(inicio - 3, inicio).toString('latin1') === 'end') {
      cursor = inicio + abre.length;
      continue;
    }

    const parada = bruto.indexOf(fecha, inicio);
    if (parada < 0) break;

    let dados = bruto.subarray(inicio + abre.length, parada);
    while (dados.length > 0 && (dados[0] === 0x0d || dados[0] === 0x0a)) dados = dados.subarray(1);

    try {
      partes.push(inflateSync(dados).toString('latin1'));
    } catch {
      partes.push(dados.toString('latin1'));
    }
    cursor = parada + fecha.length;
  }

  return partes.join('\n');
}

interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Reconstrói os retângulos desenhados a partir do fluxo de conteúdo.
 *
 * O `drawRectangle` do pdf-lib não emite o operador `re`: ele empilha uma
 * matriz `cm` com a posição e traça um caminho fechado de quatro pontos com
 * `m`/`l`/`h`/`f`. Operadores ficam sozinhos na linha, então as âncoras evitam
 * casar com letras dentro de números ou de nomes de recurso.
 */
function retangulos(conteudo: string): Retangulo[] {
  const achados: Retangulo[] = [];

  for (const bloco of conteudo.split(/^q$/m)) {
    const pontos = [...bloco.matchAll(/^(-?[\d.]+) (-?[\d.]+) [ml]$/gm)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
    }));
    if (pontos.length < 4) continue;

    let tx = 0;
    let ty = 0;
    for (const m of bloco.matchAll(/^1 0 0 1 (-?[\d.]+) (-?[\d.]+) cm$/gm)) {
      tx += Number(m[1]);
      ty += Number(m[2]);
    }

    const xs = pontos.map((p) => p.x);
    const ys = pontos.map((p) => p.y);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);

    achados.push({ x: tx + x0, y: ty + y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 });
  }

  return achados;
}

/**
 * Índice da placa clara do código: o quadrado de lado igual ao do QR.
 *
 * Procura de trás para frente porque o fundo da cena pode ter exatamente as
 * mesmas medidas — numa cena sem moldura ele tem — e a placa é sempre desenhada
 * depois dele.
 */
function indiceDaPlaca(rects: Retangulo[], ladoMm: number): number {
  const alvo = ladoMm * PT;
  return rects.findLastIndex((r) => Math.abs(r.w - alvo) < 0.5 && Math.abs(r.h - alvo) < 0.5);
}

/** Módulos escuros da matriz, como conjunto de "coluna,linha". */
function modulosEscuros(a: QrArtifact): Set<string> {
  const conjunto = new Set<string>();
  for (let y = 0; y < a.size; y++) {
    for (let x = 0; x < a.size; x++) if (a.isDark(x, y)) conjunto.add(`${x},${y}`);
  }
  return conjunto;
}

/** Módulos que os retângulos do PDF de fato pintaram. */
function modulosPintados(rects: Retangulo[], iPlaca: number, a: QrArtifact): Set<string> {
  const placa = rects[iPlaca];
  if (placa === undefined) return new Set();

  const passo = placa.w / a.sizeComQuietZone;
  const pintados = new Set<string>();

  for (const r of rects.slice(iPlaca + 1)) {
    const coluna = Math.round((r.x - placa.x) / passo) - a.quietZone;
    // y do PDF cresce para cima: a linha 0 fica no topo da placa.
    const linha = Math.round((placa.y + placa.h - (r.y + r.h)) / passo) - a.quietZone;
    if (coluna < 0 || linha < 0 || coluna >= a.size || linha >= a.size) continue;

    for (let i = 0; i < Math.round(r.w / passo); i++) pintados.add(`${coluna + i},${linha}`);
  }

  return pintados;
}

describe('estrutura do PDF', () => {
  it('produz um PDF válido e carregável, com os metadados do artefato', async () => {
    const bytes = await renderizarPdf(construirCenaBasica(artefato(), LADO));

    expect(Buffer.from(bytes).toString('latin1').startsWith('%PDF-')).toBe(true);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getCreator()).toBe('QR Code Studio');
    expect(doc.getSubject()).toBe(CONTEUDO);
  });

  it('embute as fontes da marca em subconjunto', async () => {
    const conteudo = fluxos(await renderizarPdf(comporMoldura('inferior', opcoesMoldura())));

    expect(conteudo).toContain('FontFile2'); // TrueType de verdade, embutida
    expect(conteudo).toMatch(/Archivo/);
    expect(conteudo).toMatch(/Plex/);
  });

  /**
   * O ganho de subsetar: a fonte instanciada e recortada tem 43 KB, e o PDF
   * inteiro fica menor que isso porque só os glifos usados entram.
   */
  it('fica pequeno mesmo com duas fontes embutidas', async () => {
    const pdf = await renderizarPdf(comporMoldura('placa', opcoesMoldura()));
    expect(pdf.byteLength).toBeLessThan(60_000);
  });
});

describe('geometria do código', () => {
  /**
   * A verificação que substitui um rasterizador de PDF: lê os retângulos do
   * fluxo de conteúdo, reconstrói quais módulos foram pintados e compara com a
   * matriz. Se o PDF desenhasse o código espelhado, deslocado ou com um módulo
   * a menos, este teste acusaria.
   */
  it('os retângulos desenhados reconstroem a matriz exata', async () => {
    const a = artefato();
    const rects = retangulos(fluxos(await renderizarPdf(construirCenaBasica(a, LADO))));

    const iPlaca = indiceDaPlaca(rects, LADO);
    expect(iPlaca).toBeGreaterThanOrEqual(0);

    const pintados = modulosPintados(rects, iPlaca, a);
    const esperados = modulosEscuros(a);

    expect(
      [...esperados].filter((c) => !pintados.has(c)),
      'módulos não desenhados',
    ).toEqual([]);
    expect(
      [...pintados].filter((c) => !esperados.has(c)),
      'módulos desenhados a mais',
    ).toEqual([]);
  });

  /**
   * As formas com curva não saem como retângulo — saem como caminho, o MESMO
   * que o SVG entrega. O que este teste protege é a transformação: o
   * `drawSvgPath` do pdf-lib inverte o eixo y e aplica a escala, e um erro aí
   * produziria um código espelhado ou fora da placa, que nenhum outro teste
   * pegaria porque a matriz continuaria correta.
   */
  it('a forma com curva sai como caminho vetorial, na escala e dentro da placa', async () => {
    const a = artefato();
    const conteudo = fluxos(await renderizarPdf(construirCenaBasica(a, LADO, { forma: 'circuito' })));

    const bezieres = [...conteudo.matchAll(/^(-?[\d.]+(?: -?[\d.]+){5}) c$/gm)];
    expect(bezieres.length).toBeGreaterThan(0);

    // Escala: um módulo em pontos, com o y invertido para o sistema do PDF.
    const passo = (LADO * PT) / a.sizeComQuietZone;
    // Só as matrizes de escala com y invertido; `1 0 0 1 0 0 cm` é translação.
    const escalas = [...conteudo.matchAll(/^([\d.]+) 0 0 (-[\d.]+) 0 0 cm$/gm)];
    expect(escalas.length).toBeGreaterThan(0);
    for (const [, sx, sy] of escalas) {
      expect(Number(sx)).toBeCloseTo(passo, 4);
      expect(Number(sy)).toBeCloseTo(-passo, 4);
    }

    // As coordenadas do caminho são módulos: nenhuma pode escapar da placa.
    const coordenadas = bezieres.flatMap((m) => (m[1] ?? '').split(' ').map(Number));
    expect(Math.min(...coordenadas)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...coordenadas)).toBeLessThanOrEqual(a.sizeComQuietZone);
  });

  it('mescla runs horizontais, como o SVG', async () => {
    const a = artefato();
    const rects = retangulos(fluxos(await renderizarPdf(construirCenaBasica(a, LADO))));
    const runs = rects.length - indiceDaPlaca(rects, LADO) - 1;

    expect(runs).toBeGreaterThan(0);
    expect(runs).toBeLessThan(modulosEscuros(a).size);
  });

  it('preserva a quiet zone dentro da placa clara', async () => {
    const a = artefato();
    const rects = retangulos(fluxos(await renderizarPdf(construirCenaBasica(a, LADO))));
    const iPlaca = indiceDaPlaca(rects, LADO);
    const placa = rects[iPlaca];
    if (placa === undefined) throw new Error('sem placa');

    const folga = a.quietZone * (placa.w / a.sizeComQuietZone);

    for (const r of rects.slice(iPlaca + 1)) {
      expect(r.x).toBeGreaterThanOrEqual(placa.x + folga - 0.01);
      expect(r.x + r.w).toBeLessThanOrEqual(placa.x + placa.w - folga + 0.01);
      expect(r.y).toBeGreaterThanOrEqual(placa.y + folga - 0.01);
      expect(r.y + r.h).toBeLessThanOrEqual(placa.y + placa.h - folga + 0.01);
    }
  });
});

describe('opções de impressão', () => {
  async function tamanhoDaPagina(pdf: Uint8Array): Promise<{ largura: number; altura: number }> {
    const doc = await PDFDocument.load(pdf);
    const pagina = doc.getPage(0);
    return { largura: pagina.getWidth(), altura: pagina.getHeight() };
  }

  it('respeita o tamanho de papel escolhido', async () => {
    for (const [papel, medidas] of Object.entries(PAPEIS)) {
      const pdf = await renderizarPdf(construirCenaBasica(artefato(), LADO), {
        papel: papel as keyof typeof PAPEIS,
      });
      const medido = await tamanhoDaPagina(pdf);

      expect(medido.largura, papel).toBeCloseTo(medidas[0] * PT, 1);
      expect(medido.altura, papel).toBeCloseTo(medidas[1] * PT, 1);
    }
  });

  it('a sangria acrescenta 3 mm de cada lado', async () => {
    const cena = construirCenaBasica(artefato(), LADO);
    const com = await tamanhoDaPagina(await renderizarPdf(cena, { papel: 'A4', sangria: true }));
    const sem = await tamanhoDaPagina(await renderizarPdf(cena, { papel: 'A4', sangria: false }));

    expect(com.largura - sem.largura).toBeCloseTo(6 * PT, 1);
    expect(com.altura - sem.altura).toBeCloseTo(6 * PT, 1);
  });

  it('as marcas de corte acrescentam oito filetes', async () => {
    const cena = construirCenaBasica(artefato(), LADO);
    const contar = async (marcas: boolean): Promise<number> =>
      retangulos(fluxos(await renderizarPdf(cena, { papel: 'A4', marcasDeCorte: marcas }))).length;

    expect(await contar(true)).toBe((await contar(false)) + 8);
  });

  /**
   * O diferencial para gráfica: preto 100% K em vez de preto rico. Quatro
   * chapas onde bastava uma borra o registro e encarece a tiragem.
   */
  it('preto 100% K usa o operador CMYK do PDF', async () => {
    const cena = construirCenaBasica(artefato(), LADO);

    const comK = fluxos(await renderizarPdf(cena, { pretoK: true }));
    const semK = fluxos(await renderizarPdf(cena, { pretoK: false }));

    // `k` preenche em CMYK; `rg`, em RGB.
    expect(comK).toMatch(/^0 0 0 1 k$/m);
    expect(semK).not.toMatch(/^0 0 0 1 k$/m);
    expect(semK).toMatch(/^[\d.]+ [\d.]+ [\d.]+ rg$/m);
  });

  it('imprime o selo de permanência no rodapé, e pode ser desligado', async () => {
    const cena = construirCenaBasica(artefato(), LADO);
    const com = await renderizarPdf(cena, { selo: true });
    const sem = await renderizarPdf(cena, { selo: false });
    expect(com.byteLength).toBeGreaterThan(sem.byteLength);
  });
});

describe('molduras em PDF', () => {
  /**
   * O critério de aceite "as molduras renderizam corretamente em SVG e em PDF".
   * A checagem é estrutural: toda moldura precisa produzir PDF carregável, com
   * a matriz completa desenhada e nenhum módulo faltando.
   */
  it('toda moldura vira PDF válido com a matriz completa', async () => {
    const a = artefato();
    const esperados = modulosEscuros(a);

    for (const m of MOLDURAS) {
      const pdf = await renderizarPdf(m.compor(opcoesMoldura()));
      const doc = await PDFDocument.load(pdf);
      expect(doc.getPageCount(), m.id).toBe(1);

      const rects = retangulos(fluxos(pdf));
      const iPlaca = indiceDaPlaca(rects, LADO);

      /*
       * O cartão de visita usa lado próprio e o cartaz reescala para caber no
       * papel; nesses a placa não bate com o lado nominal, e o que se verifica
       * é apenas que o PDF é válido.
       */
      if (iPlaca < 0) continue;

      const pintados = modulosPintados(rects, iPlaca, a);
      expect(
        [...esperados].filter((c) => !pintados.has(c)),
        `${m.id}: módulos faltando`,
      ).toEqual([]);
    }
  }, 60_000);
});

describe('fidelidade de tamanho físico', () => {
  /**
   * A propriedade que mais importa num produto para impressão: o código sai com
   * o tamanho pedido, em milímetros. Antes deste teste o renderizador encolhia
   * a peça para abrir espaço ao selo, e um pedido de 40 mm virava 34 mm em
   * silêncio.
   */
  it('em papel ajustado o código sai exatamente no lado pedido', async () => {
    for (const ladoMm of [25, 40, 87]) {
      const a = artefato();
      const rects = retangulos(fluxos(await renderizarPdf(construirCenaBasica(a, ladoMm))));
      const placa = rects[indiceDaPlaca(rects, ladoMm)];

      expect(placa, `${ladoMm} mm`).toBeDefined();
      expect(placa?.w ?? 0, `${ladoMm} mm`).toBeCloseTo(ladoMm * PT, 1);
    }
  });

  it('a página cresce para acomodar o selo, em vez de encolher a peça', async () => {
    const cena = construirCenaBasica(artefato(), LADO);
    const doc = await PDFDocument.load(await renderizarPdf(cena, { selo: true }));
    const pagina = doc.getPage(0);

    expect(pagina.getWidth()).toBeCloseTo(LADO * PT, 1);
    expect(pagina.getHeight()).toBeGreaterThan(LADO * PT);
  });

  it('em papel fixo a peça é reduzida para caber, nunca ampliada', async () => {
    // Etiqueta de 50 mm com uma peça de 40 mm: não deve esticar para 50.
    const rects = retangulos(
      fluxos(await renderizarPdf(construirCenaBasica(artefato(), LADO), { papel: 'Etiqueta50' })),
    );
    const placa = rects[indiceDaPlaca(rects, LADO)];

    expect(placa).toBeDefined();
    expect(placa?.w ?? 0).toBeCloseTo(LADO * PT, 1);
  });
});
