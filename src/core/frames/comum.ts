import { metaDoArtefato } from '../scene/build';
import type { Paint, Scene, SceneNode } from '../scene/types';
import type { OpcoesMoldura } from './tipos';

/**
 * Auxiliares de layout compartilhados pelas molduras.
 *
 * Tudo em milímetros e proporcional ao lado do código, para que uma etiqueta de
 * 25 mm e um cartaz A3 tenham a mesma aparência relativa.
 */

/** Respiro entre o código e a borda da moldura. */
export const PAD = 0.1;
/** Corpo da chamada de ação. */
export const CHAMADA = 0.085;
/** Corpo da linha de ficha técnica impressa. */
export const FICHA = 0.045;
/** Espessura do contorno grosso e das cantoneiras. */
export const TRACO_GROSSO = 0.022;

export const TRACKING_CHAMADA = 0.12;

/** Altura da faixa que abriga a chamada de ação. */
export function alturaRotulo(lado: number): number {
  return lado * CHAMADA * 2.4;
}

/** Altura da faixa de ficha técnica: duas linhas mais respiro. */
export function alturaFicha(lado: number): number {
  return lado * FICHA * 3.4;
}

export function noCodigo(o: OpcoesMoldura, x: number, y: number, lado = o.ladoCodigoMm): SceneNode {
  return { kind: 'qr', x, y, side: lado, artifact: o.artefato, dark: o.dark, light: o.light };
}

/** Logo central, se houver, posicionado sobre um código já colocado. */
export function noLogo(o: OpcoesMoldura, x: number, y: number, lado = o.ladoCodigoMm): SceneNode[] {
  if (o.logo === null) return [];
  const canto = (lado - o.logo.ladoMm) / 2;
  return [
    { kind: 'image', x: x + canto, y: y + canto, w: o.logo.ladoMm, h: o.logo.ladoMm, href: o.logo.href },
  ];
}

export interface OpcoesTexto {
  readonly x: number;
  readonly y: number;
  readonly texto: string;
  readonly tamanho: number;
  readonly fill: Paint;
  readonly fonte?: 'display' | 'mono';
  readonly peso?: 400 | 500 | 600 | 700 | 800 | 900;
  readonly tracking?: number;
  readonly align?: 'start' | 'middle' | 'end';
  readonly rotate?: 0 | -90;
}

export function noTexto(o: OpcoesTexto): SceneNode {
  return {
    kind: 'text',
    x: o.x,
    y: o.y,
    text: o.texto,
    font: o.fonte ?? 'display',
    size: o.tamanho,
    weight: o.peso ?? 800,
    tracking: o.tracking ?? 0,
    align: o.align ?? 'middle',
    fill: o.fill,
    ...(o.rotate === undefined ? {} : { rotate: o.rotate }),
  };
}

/**
 * Faixa da chamada de ação: retângulo cheio mais o texto centralizado.
 *
 * A linha de base fica a 70% da altura da faixa. Sem métrica de fonte não há
 * como centralizar opticamente; 70% aproxima bem para caixa alta, que é o único
 * caso — a chamada é sempre em maiúsculas.
 */
export function faixaChamada(
  o: OpcoesMoldura,
  x: number,
  y: number,
  largura: number,
  altura: number,
  fundo: Paint,
  corTexto: Paint,
): SceneNode[] {
  const corpo = o.ladoCodigoMm * CHAMADA;
  return [
    { kind: 'rect', x, y, w: largura, h: altura, fill: fundo },
    noTexto({
      x: x + largura / 2,
      y: y + altura * 0.7,
      texto: o.chamada,
      tamanho: corpo,
      fill: corTexto,
      tracking: TRACKING_CHAMADA,
    }),
  ];
}

/** Linha técnica impressa: "v6 · 41×41 · H" à esquerda, "ESTÁTICO" à direita. */
export function faixaFicha(o: OpcoesMoldura, x: number, y: number, largura: number, cor: Paint): SceneNode[] {
  const a = o.artefato;
  const corpo = o.ladoCodigoMm * FICHA;
  const recuo = o.ladoCodigoMm * 0.03;

  return [
    noTexto({
      x: x + recuo,
      y: y + corpo * 1.4,
      texto: `v${a.version} · ${a.size}×${a.size} · ${a.errorCorrection}`,
      tamanho: corpo,
      fill: cor,
      fonte: 'mono',
      peso: 400,
      align: 'start',
    }),
    noTexto({
      x: x + largura - recuo,
      y: y + corpo * 1.4,
      texto: 'ESTÁTICO',
      tamanho: corpo,
      fill: cor,
      fonte: 'mono',
      peso: 500,
      align: 'end',
    }),
    noTexto({
      x: x + recuo,
      y: y + corpo * 2.8,
      texto: a.payload.slice(0, 64),
      tamanho: corpo,
      fill: cor,
      fonte: 'mono',
      peso: 400,
      align: 'start',
    }),
  ];
}

/** Monta a cena a partir dos nós, herdando os metadados do artefato. */
export function cena(
  o: OpcoesMoldura,
  largura: number,
  altura: number,
  fundo: Paint | null,
  nos: SceneNode[],
): Scene {
  return { width: largura, height: altura, background: fundo, nodes: nos, meta: metaDoArtefato(o.artefato) };
}
