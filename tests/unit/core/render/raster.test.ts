import { describe, expect, it } from 'vitest';
import { criarArtefato } from '@/core/qr/create';
import type { QrArtifact } from '@/core/qr/types';
import { NIVEIS_CORRECAO } from '@/core/qr/types';
import type { Bitmap } from '@/core/render/raster';
import { nosSobrepondoOCodigo, rasterizarCena } from '@/core/render/raster';
import { construirCenaBasica } from '@/core/scene/build';
import type { Scene } from '@/core/scene/types';
import { paint } from '@/core/scene/types';

function artefato(conteudo: string, nivel: Parameters<typeof criarArtefato>[1] = 'H'): QrArtifact {
  const r = criarArtefato(conteudo, nivel);
  if (!r.ok) throw new Error('esperava sucesso');
  return r.artefato;
}

const URL_EXEMPLO = 'https://arquivo.gov.br/registro/8841';

function pixel(b: Bitmap, x: number, y: number): [number, number, number, number] {
  const i = (y * b.width + x) * 4;
  return [b.data[i] ?? -1, b.data[i + 1] ?? -1, b.data[i + 2] ?? -1, b.data[i + 3] ?? -1];
}

/**
 * Rasterizador ingenuo, escrito so para este teste: um retangulo por modulo,
 * sem merge de runs e sem compartilhar uma linha de codigo com o de producao.
 * E a segunda implementacao que torna a comparacao significativa.
 */
function rasterizarIngenuo(a: QrArtifact, ladoMm: number, pxPorMm: number): Bitmap {
  const lado = Math.max(1, Math.round(ladoMm * pxPorMm));
  const data = new Uint8ClampedArray(lado * lado * 4);
  const alvo: Bitmap = { data, width: lado, height: lado };

  const pinta = (x0: number, y0: number, x1: number, y1: number, cor: [number, number, number]): void => {
    for (let y = Math.max(0, y0); y < Math.min(lado, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(lado, x1); x++) {
        const i = (y * lado + x) * 4;
        data[i] = cor[0];
        data[i + 1] = cor[1];
        data[i + 2] = cor[2];
        data[i + 3] = 255;
      }
    }
  };

  pinta(0, 0, lado, lado, [255, 255, 255]);

  const modulos = a.sizeComQuietZone;
  const passo = (ladoMm * pxPorMm) / modulos;
  for (let y = 0; y < a.size; y++) {
    for (let x = 0; x < a.size; x++) {
      if (!a.isDark(x, y)) continue;
      pinta(
        Math.round((x + a.quietZone) * passo),
        Math.round((y + a.quietZone) * passo),
        Math.round((x + a.quietZone + 1) * passo),
        Math.round((y + a.quietZone + 1) * passo),
        [14, 15, 20],
      );
    }
  }

  return alvo;
}

describe('rasterizarCena', () => {
  /**
   * A prova de que mesclar runs nao muda um pixel do desenho. O rasterizador de
   * producao percorre runs; o do teste percorre modulo a modulo. Nenhum pixel
   * pode diferir.
   */
  it('e identico pixel a pixel ao desenho modulo a modulo', () => {
    for (const nivel of NIVEIS_CORRECAO) {
      for (const pxPorMm of [4, 8, 11.811]) {
        // 11.811 px/mm = 300 dpi
        const a = artefato(URL_EXEMPLO, nivel);
        const cena = construirCenaBasica(a, 50);

        const nosso = rasterizarCena(cena, pxPorMm);
        const ingenuo = rasterizarIngenuo(a, 50, pxPorMm);

        expect(nosso.width).toBe(ingenuo.width);
        expect(nosso.height).toBe(ingenuo.height);

        let diferentes = 0;
        for (let i = 0; i < nosso.data.length; i++) {
          if (nosso.data[i] !== ingenuo.data[i]) diferentes++;
        }
        expect(diferentes, `nivel ${nivel} a ${pxPorMm} px/mm`).toBe(0);
      }
    }
  });

  it('respeita as dimensoes da cena', () => {
    const cena = construirCenaBasica(artefato(URL_EXEMPLO), 50);
    const b = rasterizarCena(cena, 300 / 25.4);
    expect(b.width).toBe(Math.round((50 * 300) / 25.4));
    expect(b.height).toBe(b.width);
    expect(b.data).toHaveLength(b.width * b.height * 4);
  });

  it('mantem a quiet zone clara nos quatro cantos', () => {
    const cena = construirCenaBasica(artefato(URL_EXEMPLO), 50);
    const b = rasterizarCena(cena, 8);
    const margem = Math.floor((b.width / artefato(URL_EXEMPLO).sizeComQuietZone) * 2);

    for (const [x, y] of [
      [margem, margem],
      [b.width - 1 - margem, margem],
      [margem, b.height - 1 - margem],
      [b.width - 1 - margem, b.height - 1 - margem],
    ] as const) {
      expect(pixel(b, x, y)).toEqual([255, 255, 255, 255]);
    }
  });

  it('o canto do padrao de localizacao sai escuro', () => {
    const a = artefato(URL_EXEMPLO);
    const cena = construirCenaBasica(a, 50);
    const b = rasterizarCena(cena, 8);
    const passo = b.width / a.sizeComQuietZone;
    // Centro do primeiro modulo do olho superior esquerdo.
    const c = Math.round((a.quietZone + 0.5) * passo);
    expect(pixel(b, c, c)).toEqual([14, 15, 20, 255]);
  });

  /**
   * Modulo em fracao de pixel e a origem das costuras — linhas claras entre
   * modulos que atrapalham o scanner. Aqui a exigencia e mais forte que "sem
   * costura": nenhum pixel pode ficar sem ser pintado.
   */
  it('nao deixa pixel sem cobertura mesmo com passo fracionario', () => {
    const cena = construirCenaBasica(artefato(URL_EXEMPLO), 37.3);
    for (const pxPorMm of [3.7, 6.13, 11.811, 23.622]) {
      const b = rasterizarCena(cena, pxPorMm);
      let transparentes = 0;
      for (let i = 3; i < b.data.length; i += 4) if (b.data[i] !== 255) transparentes++;
      expect(transparentes, `a ${pxPorMm} px/mm`).toBe(0);
    }
  });

  it('pinta o fundo declarado na cena', () => {
    // A cena precisa ser maior que o codigo, senao a placa clara do QR cobre
    // todo o fundo e o teste nao mediria nada.
    const base = construirCenaBasica(artefato('a'), 20);
    const cena: Scene = { ...base, height: 30, background: paint('#2C36F0') };

    const b = rasterizarCena(cena, 4);
    expect(pixel(b, 2, b.height - 2), 'area abaixo do codigo').toEqual([44, 54, 240, 255]);
    expect(pixel(b, 2, 2), 'quiet zone continua clara').toEqual([255, 255, 255, 255]);
  });

  it('rejeita escala nao positiva', () => {
    const cena = construirCenaBasica(artefato('a'), 20);
    expect(() => rasterizarCena(cena, 0)).toThrow(RangeError);
    expect(() => rasterizarCena(cena, Number.NaN)).toThrow(RangeError);
  });
});

describe('nosSobrepondoOCodigo', () => {
  it('a cena basica nao tem invasor', () => {
    expect(nosSobrepondoOCodigo(construirCenaBasica(artefato(URL_EXEMPLO), 50))).toEqual([]);
  });

  /**
   * A regra que esta funcao protege: a chamada de acao das molduras e impressa
   * ao lado do codigo, nunca por cima. Uma moldura que a colocasse sobre os
   * modulos quebraria a leitura sem que outro teste percebesse.
   */
  it('acusa texto e retangulo que invadem o codigo', () => {
    const base = construirCenaBasica(artefato(URL_EXEMPLO), 50);
    const cena: Scene = {
      ...base,
      nodes: [
        ...base.nodes,
        {
          kind: 'text',
          x: 25,
          y: 25,
          text: 'ESCANEIE-ME',
          font: 'display',
          size: 5,
          weight: 800,
          tracking: 0.12,
          align: 'middle',
          fill: paint('#0e0f14'),
        },
        { kind: 'rect', x: 10, y: 10, w: 5, h: 5, fill: paint('#e5484d') },
      ],
    };

    expect(nosSobrepondoOCodigo(cena)).toHaveLength(2);
  });

  it('nao acusa texto colocado abaixo do codigo', () => {
    const base = construirCenaBasica(artefato(URL_EXEMPLO), 50);
    const cena: Scene = {
      ...base,
      height: 62,
      nodes: [
        ...base.nodes,
        {
          kind: 'text',
          x: 25,
          y: 57,
          text: 'ESCANEIE-ME',
          font: 'display',
          size: 5,
          weight: 800,
          tracking: 0.12,
          align: 'middle',
          fill: paint('#0e0f14'),
        },
      ],
    };

    expect(nosSobrepondoOCodigo(cena)).toEqual([]);
  });

  it('nao acusa o logo central, que invade de proposito', () => {
    const base = construirCenaBasica(artefato(URL_EXEMPLO), 50);
    const cena: Scene = {
      ...base,
      nodes: [
        ...base.nodes,
        { kind: 'image', x: 20, y: 20, w: 10, h: 10, href: 'data:image/svg+xml,<svg/>' },
      ],
    };

    expect(nosSobrepondoOCodigo(cena)).toEqual([]);
  });
});
