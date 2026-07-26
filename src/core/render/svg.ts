import type { Paint, QrNode, RectNode, Scene, SceneNode, TextNode } from '../scene/types';
import { caminhoDosModulos } from './modules-path';

/**
 * Renderiza uma `Scene` como SVG autocontido.
 *
 * Autocontido literalmente: nenhuma referencia externa, nenhum `<script>`,
 * nenhuma fonte remota. O arquivo que o usuario baixa nao faz uma requisicao
 * sequer quando aberto — coerente com a promessa de que nada sai do navegador.
 */

export interface OpcoesSvg {
  /**
   * Quantas casas decimais nas coordenadas em mm. Quatro chega a 0,1 micrometro,
   * muito alem de qualquer processo de impressao, e evita ruido de float.
   */
  readonly precisao?: number;
  /** Comentario de cabecalho com a ficha tecnica. */
  readonly incluirMetadados?: boolean;
}

const PRECISAO_PADRAO = 4;

function num(valor: number, precisao: number): string {
  if (Number.isInteger(valor)) return String(valor);
  return Number(valor.toFixed(precisao)).toString();
}

/** Escapa o que nao pode aparecer cru em texto ou atributo de XML. */
export function escaparXml(bruto: string): string {
  return bruto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function corSvg(tinta: Paint | undefined): string {
  return tinta === undefined ? 'none' : tinta.rgb;
}

function renderRect(no: RectNode, p: number): string {
  const atributos = [
    `x="${num(no.x, p)}"`,
    `y="${num(no.y, p)}"`,
    `width="${num(no.w, p)}"`,
    `height="${num(no.h, p)}"`,
    `fill="${corSvg(no.fill)}"`,
  ];
  if (no.stroke !== undefined) {
    atributos.push(`stroke="${no.stroke.rgb}"`, `stroke-width="${num(no.strokeWidth ?? 0.25, p)}"`);
  }
  return `<rect ${atributos.join(' ')}/>`;
}

function renderQr(no: QrNode, p: number): string {
  const modulos = no.artifact.sizeComQuietZone;
  const escala = no.side / modulos;

  /*
   * A placa clara vem antes do caminho porque a moldura pode assentar o codigo
   * sobre fundo escuro. Sem ela a quiet zone deixaria de existir de fato — e
   * quiet zone comida e causa comum de falha de leitura.
   */
  const placa =
    `<rect x="${num(no.x, p)}" y="${num(no.y, p)}" ` +
    `width="${num(no.side, p)}" height="${num(no.side, p)}" fill="${no.light.rgb}"/>`;

  const caminho = caminhoDosModulos(no.artifact);

  return (
    placa +
    `<g transform="translate(${num(no.x, p)} ${num(no.y, p)}) scale(${num(escala, 6)})">` +
    `<path fill="${no.dark.rgb}" d="${caminho}"/>` +
    `</g>`
  );
}

/**
 * ATENCAO para os incrementos 6 e 7: texto vai como `<text>`, com a familia
 * apenas referenciada. Um SVG aberto numa grafica que nao tenha Archivo
 * instalado substitui a fonte. Converter o texto em contornos exige um motor de
 * fonte — teremos `@pdf-lib/fontkit` carregado no caminho de PDF, e o mesmo
 * modulo pode servir aqui. Decisao a tomar quando as molduras existirem.
 */
function renderText(no: TextNode, p: number): string {
  const familia =
    no.font === 'mono' ? "'IBM Plex Mono', ui-monospace, monospace" : "'Archivo', ui-sans-serif, sans-serif";
  // `align` da cena usa os mesmos tres valores do `text-anchor` do SVG.
  const ancora = no.align;

  const atributos = [
    `x="${num(no.x, p)}"`,
    `y="${num(no.y, p)}"`,
    `fill="${no.fill.rgb}"`,
    `font-family="${familia}"`,
    `font-size="${num(no.size, p)}"`,
    `font-weight="${no.weight}"`,
    `letter-spacing="${num(no.tracking * no.size, p)}"`,
    `text-anchor="${ancora}"`,
  ];

  if (no.rotate === -90) {
    atributos.push(`transform="rotate(-90 ${num(no.x, p)} ${num(no.y, p)})"`);
  }

  return `<text ${atributos.join(' ')}>${escaparXml(no.text)}</text>`;
}

function renderNode(no: SceneNode, p: number): string {
  switch (no.kind) {
    case 'rect':
      return renderRect(no, p);
    case 'qr':
      return renderQr(no, p);
    case 'text':
      return renderText(no, p);
    case 'image':
      return (
        `<image x="${num(no.x, p)}" y="${num(no.y, p)}" ` +
        `width="${num(no.w, p)}" height="${num(no.h, p)}" href="${escaparXml(no.href)}"/>`
      );
  }
}

export function renderizarSvg(cena: Scene, opcoes: OpcoesSvg = {}): string {
  const p = opcoes.precisao ?? PRECISAO_PADRAO;
  const largura = num(cena.width, p);
  const altura = num(cena.height, p);

  const cabecalho =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}mm" height="${altura}mm" ` +
    `viewBox="0 0 ${largura} ${altura}" shape-rendering="crispEdges">`;

  const metadados = opcoes.incluirMetadados
    ? `<!-- QR Code estatico - v${cena.meta.version} - ${cena.meta.modules}x${cena.meta.modules} modulos - ` +
      `correcao ${cena.meta.errorCorrection} - zona de silencio ${cena.meta.quietZone} modulos -->`
    : '';

  const fundo =
    cena.background === null
      ? ''
      : `<rect width="${largura}" height="${altura}" fill="${cena.background.rgb}"/>`;

  const corpo = cena.nodes.map((no) => renderNode(no, p)).join('');

  return `${cabecalho}${metadados}${fundo}${corpo}</svg>`;
}
