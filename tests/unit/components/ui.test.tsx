import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Aviso } from '@/components/ui/Aviso';
import { Botao } from '@/components/ui/Botao';
import { Caixa } from '@/components/ui/Caixa';
import { Campo } from '@/components/ui/Campo';
import { Chip } from '@/components/ui/Chip';
import { ControleSegmentado } from '@/components/ui/ControleSegmentado';

describe('Botao', () => {
  it('cobre os quatro tipos do board', () => {
    for (const tipo of ['primario', 'secundario', 'fantasma', 'destrutivo'] as const) {
      expect(renderToStaticMarkup(<Botao tipo={tipo}>Baixar SVG</Botao>), tipo).toContain('Baixar SVG');
    }
  });

  it('nao vira submit por acidente', () => {
    // Sem `type` explícito, um botão dentro de form envia o formulário.
    expect(renderToStaticMarkup(<Botao>x</Botao>)).toContain('type="button"');
  });

  it('o primario usa o acento e o desabilitado sai dele', () => {
    expect(renderToStaticMarkup(<Botao tipo="primario">x</Botao>)).toContain('bg-ultramarine');
    expect(
      renderToStaticMarkup(
        <Botao tipo="primario" disabled>
          x
        </Botao>,
      ),
    ).toContain('disabled');
  });

  it('nao declara foco proprio — o global cuida disso', () => {
    // Duplicar o anel de foco por componente abriria espaço para divergência.
    expect(renderToStaticMarkup(<Botao>x</Botao>)).not.toContain('focus-visible:outline');
  });
});

describe('Campo', () => {
  it('liga rotulo e ajuda ao input', () => {
    const html = renderToStaticMarkup(<Campo rotulo="Endereço a codificar" ajuda="Cole a URL completa." />);

    const idInput = /<input[^>]*id="([^"]+)"/.exec(html)?.[1];
    const idAjuda = /<p[^>]*id="([^"]+)"/.exec(html)?.[1];

    expect(idInput).toBeDefined();
    expect(html).toContain(`for="${idInput}"`);
    expect(html).toContain(`aria-describedby="${idAjuda}"`);
  });

  /** O brief exige mensagem de erro associada ao campo, não texto solto. */
  it('anuncia erro e marca o input como invalido', () => {
    const html = renderToStaticMarkup(<Campo rotulo="URL" estado="invalido" ajuda="Esquema ausente." />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('border-error');
  });

  it('nao vira alerta no estado neutro', () => {
    // Anunciar a ajuda a cada tecla seria ruído para quem usa leitor de tela.
    const html = renderToStaticMarkup(<Campo rotulo="URL" ajuda="Cole a URL completa." />);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('aria-invalid');
  });

  it('o estado valido usa o anel do board', () => {
    const html = renderToStaticMarkup(<Campo rotulo="URL" estado="valido" ajuda="Endereço válido" />);
    expect(html).toContain('border-ultramarine');
    expect(html).toContain('shadow-ring');
  });

  it('usa a fonte de dados no valor digitado', () => {
    expect(renderToStaticMarkup(<Campo rotulo="URL" />)).toContain('font-data');
  });
});

describe('ControleSegmentado', () => {
  const NIVEIS = [
    { valor: 'L', rotulo: 'L', descricao: 'Correção L, recupera 7%' },
    { valor: 'M', rotulo: 'M' },
    { valor: 'Q', rotulo: 'Q' },
    { valor: 'H', rotulo: 'H' },
  ] as const;

  function render(valor: 'L' | 'M' | 'Q' | 'H' = 'H') {
    return renderToStaticMarkup(
      <ControleSegmentado legenda="Correção de erro" opcoes={NIVEIS} valor={valor} onChange={() => {}} />,
    );
  }

  /**
   * Fileira de botões não serve: um leitor de tela precisa anunciar "opção 4 de
   * 4, selecionada", e isso exige radiogroup.
   */
  it('é um radiogroup com uma opção marcada', () => {
    const html = render('H');
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g)).toHaveLength(4);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
  });

  it('só a opção ativa entra na ordem de tabulação', () => {
    const html = render('H');
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(3);
  });

  it('carrega a descrição longa para quem usa leitor de tela', () => {
    expect(render()).toContain('aria-label="Correção L, recupera 7%"');
  });

  it('a legenda nomeia o grupo', () => {
    const html = render();
    const id = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeDefined();
    expect(html).toContain(`id="${id}"`);
  });
});

describe('Chip', () => {
  it('expõe o estado por aria-pressed, não só por classe', () => {
    expect(renderToStaticMarkup(<Chip ativo>Rótulo inferior</Chip>)).toContain('aria-pressed="true"');
    expect(renderToStaticMarkup(<Chip>Rótulo inferior</Chip>)).toContain('aria-pressed="false"');
  });

  it('mostra o selo dos formatos vetoriais', () => {
    const html = renderToStaticMarkup(
      <Chip ativo selo="vetorial · imprimível">
        SVG
      </Chip>,
    );
    expect(html).toContain('SVG');
    expect(html).toContain('vetorial · imprimível');
  });
});

describe('Caixa', () => {
  /**
   * O quadrado é decorativo; quem carrega o estado é um checkbox nativo. Trocar
   * por div com role custaria semântica de formulário e teclado de graça.
   */
  it('usa checkbox nativo, apenas escondido visualmente', () => {
    const html = renderToStaticMarkup(
      <Caixa rotulo="Marcas de corte" descricao="Linhas de 1 pt." marcada onChange={() => {}} />,
    );
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('sr-only');
    expect(html).toContain('checked');
  });

  it('liga a descrição ao input', () => {
    const html = renderToStaticMarkup(
      <Caixa rotulo="Sangria" descricao="3 mm de segurança." marcada={false} onChange={() => {}} />,
    );
    const id = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeDefined();
    expect(html).toContain(`id="${id}"`);
  });

  it('mostra o estado em texto, não só em cor', () => {
    expect(renderToStaticMarkup(<Caixa rotulo="x" marcada onChange={() => {}} />)).toContain('ATIVO');
    expect(renderToStaticMarkup(<Caixa rotulo="x" marcada={false} onChange={() => {}} />)).toContain('—');
  });
});

describe('Aviso', () => {
  it('atenção e erro são anunciados; sucesso é apenas status', () => {
    expect(renderToStaticMarkup(<Aviso tom="atencao">x</Aviso>)).toContain('role="alert"');
    expect(renderToStaticMarkup(<Aviso tom="erro">x</Aviso>)).toContain('role="alert"');
    expect(renderToStaticMarkup(<Aviso tom="sucesso">x</Aviso>)).toContain('role="status"');
  });

  it('usa a cor de estado correspondente', () => {
    expect(renderToStaticMarkup(<Aviso tom="atencao">x</Aviso>)).toContain('border-warning');
    expect(renderToStaticMarkup(<Aviso tom="erro">x</Aviso>)).toContain('border-error');
  });

  it('o ponto colorido é decorativo', () => {
    expect(renderToStaticMarkup(<Aviso tom="atencao">x</Aviso>)).toContain('aria-hidden="true"');
  });
});
