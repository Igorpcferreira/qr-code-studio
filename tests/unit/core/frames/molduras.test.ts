import { describe, expect, it } from 'vitest';
import { MOLDURAS, comporMoldura, moldura } from '@/core/frames/molduras';
import type { OpcoesMoldura } from '@/core/frames/tipos';
import { MAX_CHAMADA, normalizarChamada } from '@/core/frames/tipos';
import { criarArtefato } from '@/core/qr/create';
import type { QrArtifact } from '@/core/qr/types';
import { nosSobrepondoOCodigo, rasterizarCena } from '@/core/render/raster';
import { renderizarSvg } from '@/core/render/svg';
import { paint } from '@/core/scene/types';
import { decodificadorJsQr } from '@/core/verify/decode';
import { verificarLeitura } from '@/core/verify/verify';

const CONTEUDO = 'https://arquivo.gov.br/registro/8841';

function artefato(): QrArtifact {
  const r = criarArtefato(CONTEUDO, 'H');
  if (!r.ok) throw new Error('esperava sucesso');
  return r.artefato;
}

function opcoes(extra: Partial<OpcoesMoldura> = {}): OpcoesMoldura {
  return {
    artefato: artefato(),
    ladoCodigoMm: 40,
    dark: paint('#0e0f14', [0, 0, 0, 1]),
    light: paint('#ffffff', [0, 0, 0, 0]),
    corMoldura: paint('#0e0f14', [0, 0, 0, 1]),
    chamada: 'ESCANEIE-ME',
    logo: null,
    incluirFicha: false,
    ...extra,
  };
}

describe('catálogo', () => {
  it('tem as 14 molduras da Fase 1', () => {
    expect(MOLDURAS).toHaveLength(14);
  });

  it('não repete identificador', () => {
    expect(new Set(MOLDURAS.map((m) => m.id)).size).toBe(14);
  });

  it('inclui as oito do board', () => {
    const ids = MOLDURAS.map((m) => m.id);
    for (const id of [
      'nenhuma',
      'inferior',
      'superior',
      'contorno',
      'cantoneiras',
      'placa',
      'vertical',
      'fundo-escuro',
    ] as const) {
      expect(ids, id).toContain(id);
    }
  });

  it('rejeita identificador desconhecido', () => {
    // @ts-expect-error identificador inexistente, de propósito
    expect(() => moldura('inventada')).toThrow(RangeError);
  });
});

describe('toda moldura', () => {
  it('produz cena com dimensões positivas e exatamente um código', () => {
    for (const m of MOLDURAS) {
      const c = m.compor(opcoes());
      expect(c.width, m.id).toBeGreaterThan(0);
      expect(c.height, m.id).toBeGreaterThan(0);

      const codigos = c.nodes.filter((n) => n.kind === 'qr');
      // Grade e display de mesa repetem o código de propósito: uma para
      // recorte, outro porque a peça dobrada tem duas faces.
      expect(codigos.length, m.id).toBeGreaterThanOrEqual(1);
      if (m.id !== 'grade' && m.id !== 'mesa') expect(codigos.length, m.id).toBe(1);
    }
  });

  it('mantém o código dentro dos limites da cena', () => {
    for (const m of MOLDURAS) {
      const c = m.compor(opcoes());
      for (const no of c.nodes) {
        if (no.kind !== 'qr') continue;
        expect(no.x, m.id).toBeGreaterThanOrEqual(0);
        expect(no.y, m.id).toBeGreaterThanOrEqual(0);
        expect(no.x + no.side, m.id).toBeLessThanOrEqual(c.width + 1e-9);
        expect(no.y + no.side, m.id).toBeLessThanOrEqual(c.height + 1e-9);
      }
    }
  });

  /**
   * A regra mais importante do board sobre molduras: a chamada de ação é
   * **impressa, não codificada**, e nunca cobre os módulos. Uma moldura que a
   * colocasse sobre o código quebraria a leitura sem nenhum outro teste notar.
   */
  it('nunca põe texto ou retângulo sobre o código', () => {
    for (const m of MOLDURAS) {
      expect(nosSobrepondoOCodigo(m.compor(opcoes())), m.id).toEqual([]);
    }
  });

  it('nunca coloca a chamada de ação no payload', () => {
    for (const m of MOLDURAS) {
      const c = m.compor(opcoes({ chamada: 'NAO DEVE SER CODIFICADO' }));
      expect(c.meta.payload, m.id).toBe(CONTEUDO);
      expect(c.meta.payload, m.id).not.toContain('NAO DEVE');
    }
  });

  it('renderiza em SVG bem formado e autocontido', () => {
    for (const m of MOLDURAS) {
      const svg = renderizarSvg(m.compor(opcoes()));
      expect(svg.startsWith('<svg'), m.id).toBe(true);
      expect(svg.endsWith('</svg>'), m.id).toBe(true);

      /*
       * A checagem é sobre ATRIBUTOS. Molduras como a placa de registro
       * imprimem o payload como texto visível, e um endereço impresso é
       * conteúdo, não referência que o leitor de SVG vá buscar.
       */
      const atributos = svg.match(/(?:href|src|xlink:href)="([^"]*)"/g) ?? [];
      for (const a of atributos) expect(a, `${m.id}: ${a}`).toMatch(/="data:/);
      expect(svg, m.id).not.toMatch(/<script/i);
    }
  });

  /**
   * O teste de ida e volta aplicado a cada moldura: compor não pode quebrar a
   * leitura. É o critério de aceite "as molduras renderizam corretamente",
   * verificado por decodificação e não por inspeção visual.
   */
  it('continua legível depois de composta', () => {
    const falhas: string[] = [];
    for (const m of MOLDURAS) {
      const v = verificarLeitura(m.compor(opcoes()));
      if (!v.ok) falhas.push(`${m.id}: ${v.causa?.tipo}`);
    }
    expect(falhas).toEqual([]);
  });

  it('continua legível com a cor de moldura em Ultramarine', () => {
    const falhas: string[] = [];
    for (const m of MOLDURAS) {
      const v = verificarLeitura(m.compor(opcoes({ corMoldura: paint('#2c36f0') })));
      if (!v.ok) falhas.push(`${m.id}: ${v.causa?.tipo}`);
    }
    expect(falhas).toEqual([]);
  });
});

describe('particularidades', () => {
  it('a moldura nua tem o tamanho exato do código', () => {
    const c = comporMoldura('nenhuma', opcoes());
    expect(c.width).toBe(40);
    expect(c.height).toBe(40);
  });

  it('rótulo superior e inferior põem a faixa em lados opostos', () => {
    const codigoY = (id: 'superior' | 'inferior'): number => {
      const no = comporMoldura(id, opcoes()).nodes.find((n) => n.kind === 'qr');
      return no?.kind === 'qr' ? no.y : -1;
    };
    expect(codigoY('superior')).toBeGreaterThan(codigoY('inferior'));
  });

  /** Regra do board: no escuro inverte-se a interface, nunca o código. */
  it('sobre fundo escuro o código continua escuro sobre claro', () => {
    const c = comporMoldura('fundo-escuro', opcoes());
    expect(c.background?.rgb).toBe('#0e0f14');

    const no = c.nodes.find((n) => n.kind === 'qr');
    if (no?.kind !== 'qr') throw new Error('sem código');
    expect(no.dark.rgb).toBe('#0e0f14');
    expect(no.light.rgb).toBe('#ffffff');

    // E a prova final: continua decodificando.
    expect(verificarLeitura(c).ok).toBe(true);
  });

  it('a grade repete o código conforme colunas e linhas', () => {
    for (const [colunas, linhas] of [
      [2, 2],
      [3, 3],
      [4, 6],
    ] as const) {
      const c = comporMoldura('grade', opcoes({ grade: { colunas, linhas } }));
      expect(c.nodes.filter((n) => n.kind === 'qr')).toHaveLength(colunas * linhas);
      expect(c.width / c.height).toBeCloseTo(colunas / linhas, 6);
    }
  });

  it('cada código da grade é legível isoladamente', () => {
    const c = comporMoldura('grade', opcoes({ grade: { colunas: 2, linhas: 2 } }));
    /*
     * A verificação recorta para a região de um código justamente porque uma
     * folha com vários conjuntos de padrões de localização confunde o
     * decodificador. Este teste ancora esse comportamento: a peça inteira não
     * decodifica, e o recorte decodifica.
     */
    expect(decodificadorJsQr.decodificar(rasterizarCena(c, 8))).toBeNull();
    expect(verificarLeitura(c).ok).toBe(true);
  });

  it('o cartão de visita tem o formato padrão de gráfica', () => {
    const c = comporMoldura('cartao', opcoes());
    expect(c.width).toBe(90);
    expect(c.height).toBe(50);
  });

  it('a placa de registro imprime versão, módulos e nível', () => {
    const c = comporMoldura('placa', opcoes());
    const textos = c.nodes.filter((n) => n.kind === 'text').map((n) => (n.kind === 'text' ? n.text : ''));
    expect(textos.some((t) => /^v\d+ · \d+×\d+ · [LMQH]$/.test(t))).toBe(true);
    expect(textos).toContain('ESTÁTICO');
  });

  it('a etiqueta vertical roda o texto', () => {
    const c = comporMoldura('vertical', opcoes());
    const texto = c.nodes.find((n) => n.kind === 'text');
    expect(texto?.kind === 'text' ? texto.rotate : null).toBe(-90);
  });

  it('a tag de roupa marca o furo de cordão acima do código', () => {
    const c = comporMoldura('hangtag', opcoes());
    const codigo = c.nodes.find((n) => n.kind === 'qr');
    const furo = c.nodes.find((n) => n.kind === 'rect' && n.stroke !== undefined && n.w < 5);
    expect(furo).toBeDefined();
    if (furo?.kind !== 'rect' || codigo?.kind !== 'qr') throw new Error('estrutura inesperada');
    expect(furo.y).toBeLessThan(codigo.y);
  });

  it('o display de mesa tem duas faces e linha de dobra', () => {
    const c = comporMoldura('mesa', opcoes());
    expect(c.nodes.filter((n) => n.kind === 'qr')).toHaveLength(2);
    const textos = c.nodes.filter((n) => n.kind === 'text').map((n) => (n.kind === 'text' ? n.text : ''));
    expect(textos).toContain('DOBRE AQUI');
  });

  it('o cartaz usa título e subtítulo quando fornecidos', () => {
    const c = comporMoldura('cartaz', opcoes({ titulo: 'DROP 07', subtitulo: 'coleção de inverno' }));
    const textos = c.nodes.filter((n) => n.kind === 'text').map((n) => (n.kind === 'text' ? n.text : ''));
    expect(textos).toContain('DROP 07');
    expect(textos).toContain('coleção de inverno');
  });

  it('a ficha no rodapé é opcional', () => {
    const sem = comporMoldura('inferior', opcoes({ incluirFicha: false }));
    const com = comporMoldura('inferior', opcoes({ incluirFicha: true }));
    expect(com.height).toBeGreaterThan(sem.height);
  });

  it('o logo central é posicionado sobre o código em toda moldura que o aceita', () => {
    const logo = { href: 'data:image/png;base64,x', ladoMm: 10 };
    for (const m of MOLDURAS) {
      const c = m.compor(opcoes({ logo }));
      const imagem = c.nodes.find((n) => n.kind === 'image');
      const codigo = c.nodes.find((n) => n.kind === 'qr');
      if (imagem?.kind !== 'image' || codigo?.kind !== 'qr') throw new Error(`${m.id} perdeu o logo`);

      expect(imagem.x + imagem.w / 2, m.id).toBeCloseTo(codigo.x + codigo.side / 2, 6);
      expect(imagem.y + imagem.h / 2, m.id).toBeCloseTo(codigo.y + codigo.side / 2, 6);
    }
  });
});

describe('chamada de ação', () => {
  it('normaliza para caixa alta', () => {
    expect(normalizarChamada('escaneie-me')).toBe('ESCANEIE-ME');
    expect(normalizarChamada('apontE a câmera')).toBe('APONTE A CÂMERA');
  });

  it('trunca no limite do board', () => {
    const longa = normalizarChamada('a'.repeat(60));
    expect(longa).toHaveLength(MAX_CHAMADA);
    expect(MAX_CHAMADA).toBe(24);
  });

  it('as quatro chamadas do board cabem no limite', () => {
    for (const c of ['ESCANEIE-ME', 'APONTE A CÂMERA', 'VER REGISTRO', 'MENU DIGITAL']) {
      expect(normalizarChamada(c), c).toBe(c);
    }
  });
});
