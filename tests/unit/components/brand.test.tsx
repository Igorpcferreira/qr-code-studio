import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Icone, NOMES_ICONE } from '@/components/brand/Icone';
import { LIMIAR_ICONE_CHEIO_PX, Logo } from '@/components/brand/Logo';
import { SeloPermanencia } from '@/components/brand/SeloPermanencia';
import { SELO_PERMANENCIA } from '@/lib/site';

/**
 * Testes de marcação, sem DOM. `renderToStaticMarkup` basta para o que importa
 * aqui — geometria, contagem de elementos e atributos de acessibilidade — e
 * evita trazer uma biblioteca de testes de componente para o projeto.
 * Interação fica com o E2E.
 */

describe('Logo', () => {
  it('desenha três localizadores e deixa o quarto canto vazio', () => {
    const svg = renderToStaticMarkup(<Logo size={40} />);
    // 3 localizadores x 3 retângulos cada, sem fundo na variante padrão.
    expect(svg.match(/<rect/g)).toHaveLength(9);
  });

  it('respeita a proporção 7:5:3 do padrão de localização', () => {
    const svg = renderToStaticMarkup(<Logo size={280} />);
    // 120 / 7 = 17.142857…, e o núcleo mede 120 - 4 x anel.
    expect(svg).toContain('width="120"');
    expect(svg).toContain(`width="${120 - (120 / 7) * 2}"`);
    expect(svg).toContain(`width="${120 - (120 / 7) * 4}"`);
  });

  it('o canto inferior direito continua vazio', () => {
    const svg = renderToStaticMarkup(<Logo size={280} />);
    // Os localizadores ficam em 0 e 160; nada é desenhado em (160, 160).
    expect(svg).toContain('x="160" y="0"');
    expect(svg).toContain('x="0" y="160"');
    expect(svg).not.toContain('x="160" y="160"');
  });

  /**
   * A regra de escala do board implementada, não documentada: abaixo de 16 px o
   * vão interno colapsa e o símbolo aberto vira borrão.
   */
  it('troca sozinho para o ícone cheio abaixo de 16 px', () => {
    const grande = renderToStaticMarkup(<Logo size={LIMIAR_ICONE_CHEIO_PX} />);
    const pequeno = renderToStaticMarkup(<Logo size={LIMIAR_ICONE_CHEIO_PX - 1} />);

    expect(grande).not.toContain('#2C36F0');
    expect(pequeno).toContain('#2C36F0'); // fundo cheio em Ultramarine
    expect(pequeno.match(/<rect/g)).toHaveLength(10); // fundo + 9
  });

  it('a troca vale mesmo se a variante pedida for outra', () => {
    const pequeno = renderToStaticMarkup(<Logo size={8} variant="mono-branco" />);
    expect(pequeno).toContain('#2C36F0');
  });

  it('inverte as cores na variante mono-branco', () => {
    const svg = renderToStaticMarkup(<Logo size={40} variant="mono-branco" />);
    expect(svg).toContain('width="120" height="120" fill="#FFFFFF"');
  });

  it('é decorativo por padrão e acessível quando recebe título', () => {
    expect(renderToStaticMarkup(<Logo size={40} />)).toContain('aria-hidden="true"');

    const comTitulo = renderToStaticMarkup(<Logo size={40} title="QR Code Studio" />);
    expect(comTitulo).toContain('role="img"');
    expect(comTitulo).toContain('<title>QR Code Studio</title>');
    expect(comTitulo).not.toContain('aria-hidden');
  });
});

describe('Icone', () => {
  it('desenha os oito ícones do board', () => {
    expect(NOMES_ICONE).toHaveLength(8);
    for (const nome of NOMES_ICONE) {
      const svg = renderToStaticMarkup(<Icone nome={nome} />);
      expect(svg, nome).toContain('<path');
    }
  });

  it('mantém grade 24, traço 2 e nenhuma curva', () => {
    for (const nome of NOMES_ICONE) {
      const svg = renderToStaticMarkup(<Icone nome={nome} />);
      expect(svg, nome).toContain('viewBox="0 0 24 24"');
      expect(svg, nome).toContain('stroke-width="2"');
      // Construção ortogonal: sem comandos de curva no path.
      expect(svg, `${nome} tem curva`).not.toMatch(/[CcSsQqTtAa]\d/);
    }
  });

  it('herda a cor do texto em vez de fixar uma', () => {
    const svg = renderToStaticMarkup(<Icone nome="baixar" />);
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).not.toMatch(/stroke="#/);
  });

  it('é decorativo por padrão e acessível quando recebe título', () => {
    expect(renderToStaticMarkup(<Icone nome="cadeado" />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<Icone nome="cadeado" title="Privado" />)).toContain(
      '<title>Privado</title>',
    );
  });
});

describe('SeloPermanencia', () => {
  /**
   * O board determina: "nunca reescrever esse texto". O componente não expõe
   * prop de texto — se expusesse, mais cedo ou mais tarde alguém passaria outro.
   */
  it('usa o literal do board e não aceita substituição', () => {
    const svg = renderToStaticMarkup(<SeloPermanencia />);
    expect(svg).toContain(SELO_PERMANENCIA);
    expect(SELO_PERMANENCIA).toBe('Estático · não expira · não depende deste site');
  });

  it('tem variante para fundo escuro', () => {
    expect(renderToStaticMarkup(<SeloPermanencia tom="escuro" />)).toContain('text-white');
    expect(renderToStaticMarkup(<SeloPermanencia tom="claro" />)).toContain('text-accent-text');
  });
});
