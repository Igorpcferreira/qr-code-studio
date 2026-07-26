import type { Paint, SceneNode } from '../scene/types';
import { paint } from '../scene/types';
import {
  CHAMADA,
  FICHA,
  PAD,
  TRACKING_CHAMADA,
  TRACO_GROSSO,
  alturaFicha,
  alturaRotulo,
  cena,
  faixaChamada,
  faixaFicha,
  noCodigo,
  noLogo,
  noTexto,
} from './comum';
import type { DefinicaoMoldura, IdMoldura, OpcoesMoldura } from './tipos';

const BRANCO: Paint = paint('#ffffff', [0, 0, 0, 0]);
const CARBON: Paint = paint('#0e0f14', [0, 0, 0, 1]);

/* ------------------------------------------------------------------ 1 · nua */

const nenhuma: DefinicaoMoldura = {
  id: 'nenhuma',
  nome: 'Sem moldura',
  descricao: 'Nu · uso digital',
  usaChamada: false,
  compor: (o) => {
    const l = o.ladoCodigoMm;
    return cena(o, l, l, o.light, [noCodigo(o, 0, 0), ...noLogo(o, 0, 0)]);
  },
};

/* ------------------------------------------- 2 e 3 · rótulo inferior/superior */

function comRotulo(id: IdMoldura, nome: string, descricao: string, emCima: boolean): DefinicaoMoldura {
  return {
    id,
    nome,
    descricao,
    usaChamada: true,
    compor: (o) => {
      const l = o.ladoCodigoMm;
      const pad = l * PAD;
      const rotulo = alturaRotulo(l);
      const largura = l + pad * 2;
      const fichaAlt = o.incluirFicha ? alturaFicha(l) : 0;
      const altura = l + pad * 2 + rotulo + fichaAlt;

      const yCodigo = emCima ? rotulo + pad : pad;
      const yRotulo = emCima ? 0 : l + pad * 2;

      const nos: SceneNode[] = [
        {
          kind: 'rect',
          x: 0,
          y: 0,
          w: largura,
          h: altura,
          fill: BRANCO,
          stroke: o.corMoldura,
          strokeWidth: l * 0.004,
        },
        noCodigo(o, pad, yCodigo),
        ...noLogo(o, pad, yCodigo),
        ...faixaChamada(o, 0, yRotulo, largura, rotulo, o.corMoldura, BRANCO),
      ];

      if (o.incluirFicha && !emCima) {
        nos.push(...faixaFicha(o, 0, l + pad * 2 + rotulo, largura, CARBON));
      }

      return cena(o, largura, altura, BRANCO, nos);
    },
  };
}

/* ------------------------------------------------------ 4 · contorno grosso */

const contorno: DefinicaoMoldura = {
  id: 'contorno',
  nome: 'Contorno grosso',
  descricao: 'Impressão em 1 cor',
  usaChamada: true,
  compor: (o) => {
    const l = o.ladoCodigoMm;
    const traco = l * TRACO_GROSSO;
    const pad = l * PAD;
    const rotulo = alturaRotulo(l);
    const largura = l + pad * 2;
    const altura = l + pad * 2 + rotulo;

    return cena(o, largura, altura, BRANCO, [
      {
        kind: 'rect',
        x: traco / 2,
        y: traco / 2,
        w: largura - traco,
        h: altura - traco,
        fill: BRANCO,
        stroke: o.corMoldura,
        strokeWidth: traco,
      },
      noCodigo(o, pad, pad),
      ...noLogo(o, pad, pad),
      // Sobre 1 cor o rótulo é vazado: filete grosso e texto na própria cor.
      { kind: 'rect', x: traco / 2, y: l + pad * 2, w: largura - traco, h: traco, fill: o.corMoldura },
      noTexto({
        x: largura / 2,
        y: l + pad * 2 + rotulo * 0.72,
        texto: o.chamada,
        tamanho: l * CHAMADA,
        fill: o.corMoldura,
        tracking: TRACKING_CHAMADA,
      }),
    ]);
  },
};

/* ---------------------------------------------------------- 5 · cantoneiras */

const cantoneiras: DefinicaoMoldura = {
  id: 'cantoneiras',
  nome: 'Cantoneiras',
  descricao: 'Discreta · editorial',
  usaChamada: false,
  compor: (o) => {
    const l = o.ladoCodigoMm;
    const pad = l * PAD;
    const lado = l + pad * 2;
    const traco = l * TRACO_GROSSO;
    const braco = l * 0.11;

    const canto = (x: number, y: number, dx: number, dy: number): SceneNode[] => [
      { kind: 'rect', x: dx > 0 ? x : x - braco, y, w: braco, h: traco, fill: o.corMoldura },
      { kind: 'rect', x, y: dy > 0 ? y : y - braco, w: traco, h: braco, fill: o.corMoldura },
    ];

    return cena(o, lado, lado, BRANCO, [
      noCodigo(o, pad, pad),
      ...noLogo(o, pad, pad),
      ...canto(0, 0, 1, 1),
      ...canto(lado - traco, 0, -1, 1),
      ...canto(0, lado - traco, 1, -1),
      ...canto(lado - traco, lado - traco, -1, -1),
    ]);
  },
};

/* ------------------------------------------------------ 6 · placa de registro */

const placa: DefinicaoMoldura = {
  id: 'placa',
  nome: 'Placa de registro',
  descricao: 'Com ficha técnica impressa',
  usaChamada: false,
  compor: (o) => {
    const l = o.ladoCodigoMm;
    const pad = l * PAD;
    const largura = l + pad * 2;
    const ficha = alturaFicha(l);
    const altura = l + pad * 2 + ficha;

    return cena(o, largura, altura, BRANCO, [
      {
        kind: 'rect',
        x: 0,
        y: 0,
        w: largura,
        h: altura,
        fill: BRANCO,
        stroke: o.corMoldura,
        strokeWidth: l * 0.004,
      },
      noCodigo(o, pad, pad),
      ...noLogo(o, pad, pad),
      { kind: 'rect', x: 0, y: l + pad * 2, w: largura, h: l * 0.003, fill: o.corMoldura },
      ...faixaFicha(o, 0, l + pad * 2, largura, CARBON),
    ]);
  },
};

/* ------------------------------------------------------ 7 · etiqueta vertical */

const vertical: DefinicaoMoldura = {
  id: 'vertical',
  nome: 'Etiqueta vertical',
  descricao: 'Lombada · faixa estreita',
  usaChamada: true,
  compor: (o) => {
    const l = o.ladoCodigoMm;
    const pad = l * PAD;
    const faixa = alturaRotulo(l);
    const largura = faixa + l + pad * 2;
    const altura = l + pad * 2;

    return cena(o, largura, altura, BRANCO, [
      {
        kind: 'rect',
        x: 0,
        y: 0,
        w: largura,
        h: altura,
        fill: BRANCO,
        stroke: o.corMoldura,
        strokeWidth: l * 0.004,
      },
      { kind: 'rect', x: 0, y: 0, w: faixa, h: altura, fill: o.corMoldura },
      noTexto({
        x: faixa * 0.7,
        y: altura / 2,
        texto: o.chamada,
        tamanho: l * CHAMADA,
        fill: BRANCO,
        tracking: TRACKING_CHAMADA,
        rotate: -90,
      }),
      noCodigo(o, faixa + pad, pad),
      ...noLogo(o, faixa + pad, pad),
    ]);
  },
};

/* ------------------------------------------------------ 8 · sobre fundo escuro */

const fundoEscuro: DefinicaoMoldura = {
  id: 'fundo-escuro',
  nome: 'Sobre fundo escuro',
  descricao: 'O código permanece claro',
  usaChamada: true,
  compor: (o) => {
    const l = o.ladoCodigoMm;
    const pad = l * PAD;
    const rotulo = alturaRotulo(l);
    const margem = l * 0.14;
    const largura = l + pad * 2 + margem * 2;
    const altura = l + pad * 2 + rotulo + margem * 2;

    /*
     * O fundo da peça é escuro, mas a placa do código continua clara e o
     * módulo continua escuro. Regra do board: no escuro inverte-se a interface,
     * nunca o código — scanner recusa código invertido.
     */
    return cena(o, largura, altura, CARBON, [
      { kind: 'rect', x: margem, y: margem, w: l + pad * 2, h: l + pad * 2 + rotulo, fill: BRANCO },
      noCodigo(o, margem + pad, margem + pad),
      ...noLogo(o, margem + pad, margem + pad),
      ...faixaChamada(o, margem, margem + l + pad * 2, l + pad * 2, rotulo, BRANCO, CARBON),
    ]);
  },
};

/* ------------------------------------------------------- 9 · hang tag de roupa */

const hangtag: DefinicaoMoldura = {
  id: 'hangtag',
  nome: 'Tag de roupa',
  descricao: 'Com furo de cordão',
  usaChamada: true,
  compor: (o) => {
    const l = o.ladoCodigoMm;
    const pad = l * PAD;
    const largura = l + pad * 2;
    const topo = l * 0.22; // área do furo
    const rotulo = alturaRotulo(l);
    const altura = topo + l + pad * 2 + rotulo;
    const raioFuro = l * 0.035;

    return cena(o, largura, altura, BRANCO, [
      {
        kind: 'rect',
        x: 0,
        y: 0,
        w: largura,
        h: altura,
        fill: BRANCO,
        stroke: o.corMoldura,
        strokeWidth: l * 0.004,
      },
      /*
       * O furo é marcado como quadrado, não círculo: o board proíbe curva em
       * toda a construção da marca, e a marca de corte não é exceção.
       */
      {
        kind: 'rect',
        x: largura / 2 - raioFuro,
        y: topo / 2 - raioFuro,
        w: raioFuro * 2,
        h: raioFuro * 2,
        fill: BRANCO,
        stroke: o.corMoldura,
        strokeWidth: l * 0.004,
      },
      noCodigo(o, pad, topo),
      ...noLogo(o, pad, topo),
      ...faixaChamada(o, 0, topo + l + pad, largura, rotulo, o.corMoldura, BRANCO),
    ]);
  },
};

/* -------------------------------------------------------------- 10 · grade N-up */

const grade: DefinicaoMoldura = {
  id: 'grade',
  nome: 'Grade recortável',
  descricao: 'Vários por folha',
  usaChamada: false,
  compor: (o) => {
    const colunas = Math.max(1, o.grade?.colunas ?? 3);
    const linhas = Math.max(1, o.grade?.linhas ?? 3);
    const l = o.ladoCodigoMm;
    const pad = l * PAD;
    const celula = l + pad * 2;
    const largura = celula * colunas;
    const altura = celula * linhas;

    const nos: SceneNode[] = [];

    for (let linha = 0; linha < linhas; linha++) {
      for (let coluna = 0; coluna < colunas; coluna++) {
        const x = coluna * celula;
        const y = linha * celula;
        nos.push({ kind: 'rect', x, y, w: celula, h: celula, fill: BRANCO });
        nos.push(noCodigo(o, x + pad, y + pad));
        nos.push(...noLogo(o, x + pad, y + pad));
      }
    }

    // Linhas de recorte entre as células, finas e na cor da moldura.
    const fio = l * 0.002;
    for (let coluna = 1; coluna < colunas; coluna++) {
      nos.push({ kind: 'rect', x: coluna * celula - fio / 2, y: 0, w: fio, h: altura, fill: o.corMoldura });
    }
    for (let linha = 1; linha < linhas; linha++) {
      nos.push({ kind: 'rect', x: 0, y: linha * celula - fio / 2, w: largura, h: fio, fill: o.corMoldura });
    }

    return cena(o, largura, altura, BRANCO, nos);
  },
};

/* ---------------------------------------------------------- 11 · cartão de visita */

const cartao: DefinicaoMoldura = {
  id: 'cartao',
  nome: 'Cartão de visita',
  descricao: '90 × 50 mm',
  usaChamada: true,
  compor: (o) => {
    // Formato fixo em milímetros: cartão de visita é padrão de gráfica.
    const largura = 90;
    const altura = 50;
    const pad = 5;
    const lado = Math.min(altura - pad * 2, 40);

    const yCodigo = (altura - lado) / 2;

    return cena(o, largura, altura, BRANCO, [
      {
        kind: 'rect',
        x: 0,
        y: 0,
        w: largura,
        h: altura,
        fill: BRANCO,
        stroke: o.corMoldura,
        strokeWidth: 0.2,
      },
      noCodigo(o, pad, yCodigo, lado),
      ...noLogo(o, pad, yCodigo, lado),
      noTexto({
        x: pad * 2 + lado,
        y: altura / 2 - 1,
        texto: o.chamada,
        tamanho: 4,
        fill: o.corMoldura,
        tracking: TRACKING_CHAMADA,
        align: 'start',
      }),
      noTexto({
        x: pad * 2 + lado,
        y: altura / 2 + 5,
        texto: o.artefato.payload.slice(0, 44),
        tamanho: 2.6,
        fill: CARBON,
        fonte: 'mono',
        peso: 400,
        align: 'start',
      }),
    ]);
  },
};

/* ------------------------------------------------------------ 12 · display de mesa */

const mesa: DefinicaoMoldura = {
  id: 'mesa',
  nome: 'Display de mesa',
  descricao: 'Dobrável, dois lados',
  usaChamada: true,
  compor: (o) => {
    const l = o.ladoCodigoMm;
    const pad = l * PAD;
    const rotulo = alturaRotulo(l);
    const largura = l + pad * 2;
    const face = l + pad * 2 + rotulo;
    const altura = face * 2;

    const umaFace = (deslocamento: number): SceneNode[] => [
      noCodigo(o, pad, deslocamento + pad),
      ...noLogo(o, pad, deslocamento + pad),
      ...faixaChamada(o, 0, deslocamento + l + pad * 2, largura, rotulo, o.corMoldura, BRANCO),
    ];

    return cena(o, largura, altura, BRANCO, [
      {
        kind: 'rect',
        x: 0,
        y: 0,
        w: largura,
        h: altura,
        fill: BRANCO,
        stroke: o.corMoldura,
        strokeWidth: l * 0.004,
      },
      ...umaFace(0),
      ...umaFace(face),
      // Linha de dobra ao meio.
      { kind: 'rect', x: 0, y: face - l * 0.001, w: largura, h: l * 0.002, fill: o.corMoldura },
      noTexto({
        x: largura / 2,
        y: face - l * 0.012,
        texto: 'DOBRE AQUI',
        tamanho: l * FICHA,
        fill: o.corMoldura,
        fonte: 'mono',
        peso: 400,
        tracking: 0.18,
      }),
    ]);
  },
};

/* -------------------------------------------------------------------- 13 · cartaz */

const cartaz: DefinicaoMoldura = {
  id: 'cartaz',
  nome: 'Cartaz',
  descricao: 'Título, subtítulo e código grande',
  usaChamada: true,
  compor: (o) => {
    const l = o.ladoCodigoMm;
    const pad = l * 0.16;
    const largura = l + pad * 2;
    const cabecalho = l * 0.42;
    const rodape = alturaRotulo(l);
    const altura = cabecalho + l + pad + rodape;

    return cena(o, largura, altura, BRANCO, [
      noTexto({
        x: largura / 2,
        y: cabecalho * 0.42,
        texto: o.titulo ?? o.chamada,
        tamanho: l * 0.13,
        fill: CARBON,
        peso: 900,
        tracking: -0.03,
      }),
      noTexto({
        x: largura / 2,
        y: cabecalho * 0.72,
        texto: o.subtitulo ?? '',
        tamanho: l * 0.055,
        fill: paint('#6e7280'),
        fonte: 'mono',
        peso: 400,
      }),
      noCodigo(o, pad, cabecalho),
      ...noLogo(o, pad, cabecalho),
      ...faixaChamada(o, 0, cabecalho + l + pad, largura, rodape, o.corMoldura, BRANCO),
    ]);
  },
};

/* --------------------------------------------------------------------- 14 · faixa */

const faixa: DefinicaoMoldura = {
  id: 'faixa',
  nome: 'Faixa horizontal',
  descricao: 'Código à esquerda, chamada à direita',
  usaChamada: true,
  compor: (o) => {
    const l = o.ladoCodigoMm;
    const pad = l * PAD;
    const altura = l + pad * 2;
    const largura = altura * 3;

    return cena(o, largura, altura, BRANCO, [
      {
        kind: 'rect',
        x: 0,
        y: 0,
        w: largura,
        h: altura,
        fill: BRANCO,
        stroke: o.corMoldura,
        strokeWidth: l * 0.004,
      },
      noCodigo(o, pad, pad),
      ...noLogo(o, pad, pad),
      noTexto({
        x: altura + pad,
        y: altura / 2,
        texto: o.chamada,
        tamanho: l * 0.11,
        fill: o.corMoldura,
        tracking: TRACKING_CHAMADA,
        align: 'start',
      }),
      noTexto({
        x: altura + pad,
        y: altura / 2 + l * 0.13,
        texto: o.artefato.payload.slice(0, 52),
        tamanho: l * FICHA,
        fill: CARBON,
        fonte: 'mono',
        peso: 400,
        align: 'start',
      }),
    ]);
  },
};

export const MOLDURAS: readonly DefinicaoMoldura[] = [
  nenhuma,
  comRotulo('inferior', 'Rótulo inferior', 'Padrão de cartaz', false),
  comRotulo('superior', 'Rótulo superior', 'Mesa · balcão', true),
  contorno,
  cantoneiras,
  placa,
  vertical,
  fundoEscuro,
  hangtag,
  grade,
  cartao,
  mesa,
  cartaz,
  faixa,
];

const POR_ID = new Map(MOLDURAS.map((m) => [m.id, m]));

export function moldura(id: IdMoldura): DefinicaoMoldura {
  const achada = POR_ID.get(id);
  if (achada === undefined) throw new RangeError(`Moldura desconhecida: ${id}`);
  return achada;
}

export function comporMoldura(id: IdMoldura, opcoes: OpcoesMoldura) {
  return moldura(id).compor(opcoes);
}
