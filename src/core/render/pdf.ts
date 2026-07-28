import fontkit from '@pdf-lib/fontkit';
import type { PDFFont, PDFPage } from 'pdf-lib';
import { PDFDocument, cmyk, rgb } from 'pdf-lib';
import { SELO_PERMANENCIA } from '@/lib/site';
import type { Paint, QrNode, Scene, SceneNode, TextNode } from '../scene/types';
import { hexParaRgb } from '@/lib/contrast';
import type { Tinta } from './formas';
import { camadasDasPrimitivas, primitivasDoCodigo } from './formas';
import { ARCHIVO_EXTRABOLD, PLEX_MONO_MEDIUM } from './pdf-fontes';

/**
 * Exportação em PDF vetorial.
 *
 * Este módulo é pesado (pdf-lib, fontkit e as fontes embutidas) e entra no
 * bundle só por `import()` no clique de exportar. Quem nunca exporta PDF não
 * paga por ele.
 *
 * As fontes vêm embutidas em `pdf-fontes.ts`, não servidas de `/public`: um
 * `fetch`, ainda que da própria origem, abriria um caminho de rede num produto
 * cuja tese é que nada sai do navegador.
 */

/** 1 mm em pontos PostScript. */
const PT = 72 / 25.4;

export type Papel = 'ajustado' | 'A4' | 'Carta' | 'Etiqueta50';

/** Dimensões em milímetros. `ajustado` acompanha a peça. */
export const PAPEIS: Readonly<Record<Exclude<Papel, 'ajustado'>, readonly [number, number]>> = {
  A4: [210, 297],
  Carta: [216, 279],
  Etiqueta50: [50, 50],
};

export const SANGRIA_MM = 3;

export interface OpcoesPdf {
  readonly papel?: Papel;
  readonly marcasDeCorte?: boolean;
  readonly sangria?: boolean;
  /**
   * Preto 100% K em vez de RGB.
   *
   * Gráfica e serigrafia rejeitam preto rico — quatro chapas onde bastava uma
   * borra o registro e encarece. Nenhum gerador gratuito oferece isso.
   */
  readonly pretoK?: boolean;
  /** Imprime o selo de permanência no rodapé, como o board determina. */
  readonly selo?: boolean;
}

function corPdf(tinta: Paint, pretoK: boolean) {
  if (pretoK && tinta.cmyk !== undefined) {
    const [c, m, a, k] = tinta.cmyk;
    return cmyk(c, m, a, k);
  }
  const canais = hexParaRgb(tinta.rgb);
  if (canais === null) throw new TypeError(`Cor inválida na cena: ${tinta.rgb}`);
  return rgb(canais.r / 255, canais.g / 255, canais.b / 255);
}

/**
 * Desenha texto com espaçamento entre letras.
 *
 * O `drawText` do pdf-lib não expõe o operador `Tc`, então o tracking do board
 * (12% do corpo na chamada de ação) precisa ser aplicado glifo a glifo. São
 * textos curtos — no máximo 24 caracteres — e o custo é irrelevante.
 */
function desenharTexto(
  pagina: PDFPage,
  no: TextNode,
  fonte: PDFFont,
  x: number,
  y: number,
  pretoK: boolean,
): void {
  const corpo = no.size * PT;
  const espaco = no.tracking * corpo;
  const glifos = [...no.text];

  const largura =
    glifos.reduce((soma, g) => soma + fonte.widthOfTextAtSize(g, corpo), 0) +
    espaco * Math.max(0, glifos.length - 1);

  let cursor = no.align === 'middle' ? x - largura / 2 : no.align === 'end' ? x - largura : x;
  const cor = corPdf(no.fill, pretoK);

  for (const glifo of glifos) {
    if (no.rotate === -90) {
      pagina.drawText(glifo, {
        x,
        y: y + (cursor - x),
        size: corpo,
        font: fonte,
        color: cor,
        rotate: { type: 'degrees', angle: 90 } as never,
      });
    } else {
      pagina.drawText(glifo, { x: cursor, y, size: corpo, font: fonte, color: cor });
    }
    cursor += fonte.widthOfTextAtSize(glifo, corpo) + espaco;
  }
}

/**
 * Desenha o código como retângulos, um por run horizontal.
 *
 * Poderia sair como um `<path>` único via `drawSvgPath`, e ficaria com um
 * objeto só — mas aí a geometria do PDF viraria caixa-preta para os testes.
 * Com retângulos, o fluxo de conteúdo pode ser lido de volta e a matriz
 * reconstruída, que é como `pdf.test.ts` prova que o PDF desenha o código certo
 * sem precisar de um rasterizador de PDF. Ainda são 615 caminhos em vez de
 * 1.256, e todo editor vetorial trata retângulo nativamente.
 */
function desenharCodigo(pagina: PDFPage, no: QrNode, x: number, yTopo: number, pretoK: boolean): void {
  const a = no.artifact;
  const passo = (no.side * PT) / a.sizeComQuietZone;
  const q = a.quietZone;

  pagina.drawRectangle({
    x,
    y: yTopo - no.side * PT,
    width: no.side * PT,
    height: no.side * PT,
    color: corPdf(no.light, pretoK),
  });

  const escuro = corPdf(no.dark, pretoK);

  const forma = no.forma ?? 'quadrado';
  if (forma !== 'quadrado' || no.olhos !== undefined) {
    /*
     * Formas com curva saem como caminho, e é o MESMO caminho do SVG: o
     * `drawSvgPath` do pdf-lib translada para (x, y) e inverte o eixo y, que é
     * exatamente a diferença entre a cena e o PDF. Só reta e Bézier cúbica no
     * caminho — o arco elíptico é onde os interpretadores divergem.
     */
    const tintas: Record<Tinta, ReturnType<typeof corPdf>> = {
      escuro,
      claro: corPdf(no.light, pretoK),
      olhos: corPdf(no.olhos ?? no.dark, pretoK),
    };

    for (const camada of camadasDasPrimitivas(primitivasDoCodigo(a, forma))) {
      pagina.drawSvgPath(camada.caminho, { x, y: yTopo, scale: passo, color: tintas[camada.tinta] });
    }
    return;
  }

  for (let linha = 0; linha < a.size; linha++) {
    let coluna = 0;
    while (coluna < a.size) {
      if (!a.isDark(coluna, linha)) {
        coluna++;
        continue;
      }
      let largura = 0;
      while (coluna + largura < a.size && a.isDark(coluna + largura, linha)) largura++;

      pagina.drawRectangle({
        x: x + (coluna + q) * passo,
        // O PDF conta y de baixo para cima; a cena, de cima para baixo.
        y: yTopo - (linha + q + 1) * passo,
        width: largura * passo,
        height: passo,
        color: escuro,
      });
      coluna += largura;
    }
  }
}

function desenharMarcasDeCorte(pagina: PDFPage, largura: number, altura: number, margem: number): void {
  const traco = 5 * PT;
  const fio = 0.25;
  const cor = rgb(0, 0, 0);

  const linha = (x: number, y: number, w: number, h: number): void => {
    pagina.drawRectangle({ x, y, width: w, height: h, color: cor });
  };

  for (const [x, y] of [
    [0, altura - margem],
    [largura - traco, altura - margem],
    [0, margem],
    [largura - traco, margem],
  ] as const) {
    linha(x, y, traco, fio);
  }
  for (const [x, y] of [
    [margem, altura - traco],
    [largura - margem, altura - traco],
    [margem, 0],
    [largura - margem, 0],
  ] as const) {
    linha(x, y, fio, traco);
  }
}

export async function renderizarPdf(cena: Scene, opcoes: OpcoesPdf = {}): Promise<Uint8Array> {
  const { papel = 'ajustado', marcasDeCorte = false, sangria = false, pretoK = false, selo = true } = opcoes;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  // `subset: true` embute só os glifos usados: o PDF fica em poucos KB.
  const display = await doc.embedFont(ARCHIVO_EXTRABOLD, { subset: true });
  const mono = await doc.embedFont(PLEX_MONO_MEDIUM, { subset: true });

  const margem = (sangria ? SANGRIA_MM : 0) * PT;
  const alturaSeloMm = selo ? 6 : 0;

  /*
   * Com papel ajustado a página CRESCE para acomodar o selo; a peça não encolhe.
   * Quem pede um código de 40 mm precisa receber 40 mm — reescalar para abrir
   * espaço mudaria em silêncio o tamanho impresso, que é justamente o que este
   * produto existe para acertar.
   */
  const [papelLargura, papelAltura] =
    papel === 'ajustado' ? [cena.width, cena.height + alturaSeloMm] : PAPEIS[papel];

  const larguraPt = papelLargura * PT + margem * 2;
  const alturaPt = papelAltura * PT + margem * 2;

  doc.setTitle('QR Code estático');
  doc.setCreator('QR Code Studio');
  doc.setProducer('QR Code Studio');
  doc.setSubject(cena.meta.payload);
  doc.setKeywords(['qr', 'estático', `v${cena.meta.version}`, cena.meta.errorCorrection]);

  const pagina = doc.addPage([larguraPt, alturaPt]);

  const alturaSelo = alturaSeloMm * PT;

  /*
   * Em papel fixo a peça é reduzida para caber, nunca ampliada: ampliar mudaria
   * o tamanho pedido e um QR maior que o especificado atrapalha tanto quanto um
   * menor. Em papel ajustado a escala é exatamente 1.
   */
  const escala = Math.min(
    1,
    (papelLargura * PT) / (cena.width * PT),
    (papelAltura * PT - alturaSelo) / (cena.height * PT),
  );

  const larguraCena = cena.width * PT * escala;
  const alturaCena = cena.height * PT * escala;
  const origemX = margem + (papelLargura * PT - larguraCena) / 2;
  const topoY = alturaPt - margem - (papelAltura * PT - alturaSelo - alturaCena) / 2;

  /** Converte um ponto da cena (mm, y para baixo) para o PDF (pt, y para cima). */
  const px = (mm: number): number => origemX + mm * PT * escala;
  const py = (mm: number): number => topoY - mm * PT * escala;

  if (cena.background !== null) {
    pagina.drawRectangle({
      x: origemX,
      y: topoY - alturaCena,
      width: larguraCena,
      height: alturaCena,
      color: corPdf(cena.background, pretoK),
    });
  }

  for (const no of cena.nodes as readonly SceneNode[]) {
    switch (no.kind) {
      case 'rect': {
        const opcoesRect = {
          x: px(no.x),
          y: py(no.y + no.h),
          width: no.w * PT * escala,
          height: no.h * PT * escala,
        };
        if (no.fill !== undefined) {
          pagina.drawRectangle({ ...opcoesRect, color: corPdf(no.fill, pretoK) });
        }
        if (no.stroke !== undefined) {
          pagina.drawRectangle({
            ...opcoesRect,
            borderColor: corPdf(no.stroke, pretoK),
            borderWidth: (no.strokeWidth ?? 0.25) * PT * escala,
          });
        }
        break;
      }

      case 'qr':
        desenharCodigo(pagina, { ...no, side: no.side * escala }, px(no.x), py(no.y), pretoK);
        break;

      case 'text':
        desenharTexto(
          pagina,
          { ...no, size: no.size * escala },
          no.font === 'mono' ? mono : display,
          px(no.x),
          py(no.y),
          pretoK,
        );
        break;

      case 'image':
        /*
         * O logo fica de fora do PDF nesta fase. Embutir imagem exigiria
         * decodificar PNG/JPEG/SVG dentro do chunk, e um logo rasterizado num
         * arquivo vendido como vetorial seria contraditório. Anotado no
         * ROADMAP; o SVG e o PNG seguem levando o logo.
         */
        break;
    }
  }

  if (selo) {
    const corpo = 6;
    const largura = mono.widthOfTextAtSize(SELO_PERMANENCIA, corpo);
    pagina.drawText(SELO_PERMANENCIA, {
      x: (larguraPt - largura) / 2,
      y: margem + 3 * PT,
      size: corpo,
      font: mono,
      color: pretoK ? cmyk(0, 0, 0, 1) : rgb(0.43, 0.45, 0.5),
    });
  }

  if (marcasDeCorte) desenharMarcasDeCorte(pagina, larguraPt, alturaPt, margem);

  return doc.save();
}
