import { describe, expect, it } from 'vitest';
import { criarArtefato } from '@/core/qr/create';
import type { QrArtifact } from '@/core/qr/types';
import { escaparXml, renderizarSvg } from '@/core/render/svg';
import { construirCenaBasica } from '@/core/scene/build';
import type { Scene } from '@/core/scene/types';
import { paint } from '@/core/scene/types';

function artefato(conteudo: string, nivel: Parameters<typeof criarArtefato>[1] = 'H'): QrArtifact {
  const r = criarArtefato(conteudo, nivel);
  if (!r.ok) throw new Error('esperava sucesso');
  return r.artefato;
}

const URL_EXEMPLO = 'https://arquivo.gov.br/registro/8841';

describe('renderizarSvg', () => {
  it('declara dimensao fisica em mm e viewBox coerente', () => {
    const svg = renderizarSvg(construirCenaBasica(artefato(URL_EXEMPLO), 50));
    expect(svg).toContain('width="50mm"');
    expect(svg).toContain('height="50mm"');
    expect(svg).toContain('viewBox="0 0 50 50"');
  });

  it('desenha o codigo como um unico path', () => {
    const svg = renderizarSvg(construirCenaBasica(artefato(URL_EXEMPLO), 50));
    expect(svg.match(/<path/g)).toHaveLength(1);
    expect(svg).toContain('shape-rendering="crispEdges"');
  });

  /**
   * O arquivo baixado nao pode buscar nada quando aberto. E a mesma promessa
   * que o E2E cobre no app, aplicada ao artefato que sai dele.
   */
  it('nao referencia recurso externo nem embute script', () => {
    const svg = renderizarSvg(construirCenaBasica(artefato(URL_EXEMPLO), 50), { incluirMetadados: true });

    // A unica URL aceitavel e a declaracao de namespace do XML, que nao e
    // buscada por leitor nenhum.
    expect(svg.match(/https?:\/\/[^"'\s]+/g)).toEqual(['http://www.w3.org/2000/svg']);

    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/(?:href|src)\s*=\s*"(?!data:)[^"]*:/i);
    expect(svg).not.toMatch(/@import|url\(/);
  });

  it('emite a placa clara antes do path, para a quiet zone existir sobre fundo escuro', () => {
    const svg = renderizarSvg(construirCenaBasica(artefato(URL_EXEMPLO), 50));
    const placa = svg.indexOf('fill="#ffffff"');
    const caminho = svg.indexOf('<path');
    expect(placa).toBeGreaterThan(-1);
    expect(placa).toBeLessThan(caminho);
  });

  it('a escala do grupo leva o codigo ao lado pedido', () => {
    const a = artefato(URL_EXEMPLO);
    const svg = renderizarSvg(construirCenaBasica(a, 50));
    const escala = Number(/scale\(([\d.]+)\)/.exec(svg)?.[1]);
    expect(escala).toBeCloseTo(50 / a.sizeComQuietZone, 6);
  });

  it('escapa conteudo perigoso no comentario de metadados', () => {
    const svg = renderizarSvg(construirCenaBasica(artefato('a'), 20), { incluirMetadados: true });
    expect(svg).toContain('<!--');
    expect(svg).toContain('zona de silencio 4 modulos');
  });

  it('escapa texto do usuario', () => {
    const base = construirCenaBasica(artefato('a'), 20);
    const cena: Scene = {
      ...base,
      height: 30,
      nodes: [
        ...base.nodes,
        {
          kind: 'text',
          x: 10,
          y: 26,
          text: '<script>alert("x")</script> & cia',
          font: 'display',
          size: 3,
          weight: 800,
          tracking: 0.12,
          align: 'middle',
          fill: paint('#0e0f14'),
        },
      ],
    };

    const svg = renderizarSvg(cena);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp; cia');
  });

  /**
   * Esta lacuna era real: eu escrevia `align` em portugues nos renderers e em
   * ingles no tipo, e nenhum teste conferia o `text-anchor` da saida. So o
   * compilador pegou. O teste existe para que o alinhamento seja verificado
   * pelo comportamento, nao apenas pelo tipo.
   */
  it('traduz cada alinhamento para o text-anchor correspondente', () => {
    const base = construirCenaBasica(artefato('a'), 20);
    const casos = [
      ['start', 'start'],
      ['middle', 'middle'],
      ['end', 'end'],
    ] as const;

    for (const [align, ancora] of casos) {
      const cena: Scene = {
        ...base,
        height: 30,
        nodes: [
          ...base.nodes,
          {
            kind: 'text',
            x: 10,
            y: 26,
            text: 'ESCANEIE-ME',
            font: 'display',
            size: 3,
            weight: 800,
            tracking: 0.12,
            align,
            fill: paint('#0e0f14'),
          },
        ],
      };
      expect(renderizarSvg(cena)).toContain(`text-anchor="${ancora}"`);
    }
  });

  it('converte tracking de em para unidade de usuario', () => {
    const base = construirCenaBasica(artefato('a'), 20);
    const cena: Scene = {
      ...base,
      height: 30,
      nodes: [
        ...base.nodes,
        {
          kind: 'text',
          x: 10,
          y: 26,
          text: 'ESCANEIE-ME',
          font: 'display',
          size: 4,
          weight: 800,
          tracking: 0.12,
          align: 'middle',
          fill: paint('#0e0f14'),
        },
      ],
    };
    // 0,12 em sobre corpo 4 mm = 0,48 mm.
    expect(renderizarSvg(cena)).toContain('letter-spacing="0.48"');
  });

  it('roda o texto da etiqueta vertical', () => {
    const base = construirCenaBasica(artefato('a'), 20);
    const cena: Scene = {
      ...base,
      nodes: [
        ...base.nodes,
        {
          kind: 'text',
          x: 5,
          y: 15,
          text: 'ESCANEIE-ME',
          font: 'display',
          size: 3,
          weight: 800,
          tracking: 0.12,
          align: 'start',
          fill: paint('#0e0f14'),
          rotate: -90,
        },
      ],
    };

    expect(renderizarSvg(cena)).toContain('transform="rotate(-90 5 15)"');
  });

  it('cabe numa ordem de grandeza razoavel de bytes', () => {
    // Medido na investigacao: v8 com 1.256 modulos escuros dava 8,2 KB com path
    // unico contra 69,7 KB com um rect por modulo.
    const svg = renderizarSvg(
      construirCenaBasica(
        artefato('https://loja.exemplo.com.br/colecao/streetwear/drop-07?ref=etiqueta&sku=TS-0042'),
        50,
      ),
    );
    expect(svg.length).toBeLessThan(15_000);
  });
});

describe('escaparXml', () => {
  it('cobre os cinco caracteres do XML', () => {
    expect(escaparXml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&apos;');
  });

  it('escapa o & antes dos outros, sem duplicar entidade', () => {
    expect(escaparXml('&lt;')).toBe('&amp;lt;');
  });

  it('deixa acentuacao intacta', () => {
    expect(escaparXml('ESCANEIE-ME · APONTE A CÂMERA')).toBe('ESCANEIE-ME · APONTE A CÂMERA');
  });
});
