import { describe, expect, it } from 'vitest';
import { derivar } from '@/state/derivar';
import type { EstadoGerador } from '@/state/reducer';
import { ESTADO_INICIAL, ladoMm, reducer } from '@/state/reducer';

/** Estado com uma URL digitada, que é o caminho mais usado da interface. */
function comUrl(valor: string, resto: Partial<EstadoGerador> = {}): EstadoGerador {
  return {
    ...ESTADO_INICIAL,
    ...resto,
    formularios: { ...ESTADO_INICIAL.formularios, url: { valor } },
  };
}

const COM_LOGO: EstadoGerador = comUrl('https://arquivo.gov.br/registro/8841', {
  logo: { dataUrl: 'data:image/png;base64,x', nome: 'marca.png', fracaoLado: 0.4 },
});

describe('reducer', () => {
  it('escreve no formulário do tipo indicado, sem tocar nos outros', () => {
    const e = reducer(ESTADO_INICIAL, { tipo: 'formulario', conteudo: 'url', patch: { valor: 'a.com' } });

    expect(e.formularios.url.valor).toBe('a.com');
    expect(e.formularios.texto).toBe(ESTADO_INICIAL.formularios.texto);
  });

  /**
   * Espiar outro tipo não pode apagar o que já foi digitado: um vCard leva
   * doze campos, e perdê-lo por clicar em "Pix" seria atrito gratuito.
   */
  it('trocar de tipo preserva todos os formulários', () => {
    const comWifi = reducer(ESTADO_INICIAL, {
      tipo: 'formulario',
      conteudo: 'wifi',
      patch: { ssid: 'Estudio' },
    });
    const emPix = reducer(comWifi, { tipo: 'tipo-conteudo', valor: 'pix' });

    expect(emPix.tipoConteudo).toBe('pix');
    expect(emPix.formularios.wifi.ssid).toBe('Estudio');
  });

  /**
   * Logo central só é viável em H. Baixar o nível com um logo aplicado
   * produziria um código que não lê — melhor perder o logo explicitamente do
   * que exportar um arquivo quebrado.
   */
  it('descarta o logo ao sair do nível H', () => {
    expect(reducer(COM_LOGO, { tipo: 'nivel', valor: 'Q' }).logo).toBeNull();
    expect(reducer(COM_LOGO, { tipo: 'nivel', valor: 'H' }).logo).not.toBeNull();
  });

  describe('troca de unidade', () => {
    it('preserva o tamanho físico', () => {
      const emPx: EstadoGerador = { ...ESTADO_INICIAL, lado: 1024, unidade: 'px', dpi: 300 };
      const emMm = reducer(emPx, { tipo: 'unidade', valor: 'mm' });

      expect(emMm.unidade).toBe('mm');
      expect(emMm.lado).toBeCloseTo(86.7, 1);
      expect(ladoMm(emMm)).toBeCloseTo(ladoMm(emPx), 1);
    });

    it('é idempotente quando a unidade não muda', () => {
      const e = { ...ESTADO_INICIAL, lado: 1024, unidade: 'px' } as const;
      expect(reducer(e, { tipo: 'unidade', valor: 'px' })).toBe(e);
    });

    it('faz ida e volta sem deriva relevante', () => {
      const inicio: EstadoGerador = { ...ESTADO_INICIAL, lado: 1024, unidade: 'px', dpi: 300 };
      const volta = reducer(reducer(inicio, { tipo: 'unidade', valor: 'mm' }), {
        tipo: 'unidade',
        valor: 'px',
      });
      expect(volta.lado).toBeCloseTo(1024, -1);
    });
  });

  describe('troca de DPI', () => {
    /**
     * Em milímetros o tamanho físico é a fonte da verdade e o DPI só muda a
     * resolução. Em pixels, manter o número mudaria o tamanho impresso sem o
     * usuário pedir.
     */
    it('não mexe no lado quando a unidade é mm', () => {
      const e: EstadoGerador = { ...ESTADO_INICIAL, lado: 50, unidade: 'mm', dpi: 300 };
      const novo = reducer(e, { tipo: 'dpi', valor: 600 });
      expect(novo.lado).toBe(50);
      expect(ladoMm(novo)).toBe(50);
    });

    it('reconverte o lado em px para manter o tamanho impresso', () => {
      const e: EstadoGerador = { ...ESTADO_INICIAL, lado: 1024, unidade: 'px', dpi: 300 };
      const novo = reducer(e, { tipo: 'dpi', valor: 600 });

      expect(novo.lado).toBe(2048);
      expect(ladoMm(novo)).toBeCloseTo(ladoMm(e), 1);
    });
  });

  it('inverter troca as duas cores', () => {
    const e = reducer(
      { ...ESTADO_INICIAL, corEscura: '#111111', corClara: '#eeeeee' },
      {
        tipo: 'inverter-cores',
      },
    );
    expect(e.corEscura).toBe('#eeeeee');
    expect(e.corClara).toBe('#111111');
  });

  it('limpar zera o artefato mas preserva as preferências de saída', () => {
    const configurado: EstadoGerador = { ...COM_LOGO, lado: 50, unidade: 'mm', dpi: 600, nivel: 'H' };
    const limpo = reducer(configurado, { tipo: 'limpar' });

    expect(limpo.formularios.url.valor).toBe('');
    expect(limpo.logo).toBeNull();
    expect(limpo.lado).toBe(50);
    expect(limpo.unidade).toBe('mm');
    expect(limpo.dpi).toBe(600);
  });
});

describe('derivar', () => {
  it('sem conteúdo não há cena nem artefato', () => {
    const d = derivar(ESTADO_INICIAL);
    expect(d.artefato).toBeNull();
    expect(d.cena).toBeNull();
    expect(d.resultado.ok).toBe(false);
  });

  it('monta a cena no lado em milímetros', () => {
    const d = derivar(comUrl('https://exemplo.com', { lado: 50, unidade: 'mm' }));
    expect(d.cena?.width).toBe(50);
    expect(d.cena?.height).toBe(50);
    expect(d.ladoMm).toBe(50);
  });

  /**
   * O payload sai do formulário do tipo corrente — nenhum outro consumidor da
   * cadeia derivada sabe que existem nove tipos.
   */
  it('codifica o formulário do tipo escolhido', () => {
    const estado: EstadoGerador = {
      ...ESTADO_INICIAL,
      tipoConteudo: 'wifi',
      formularios: {
        ...ESTADO_INICIAL.formularios,
        url: { valor: 'https://ignorado.example' },
        wifi: { ssid: 'Estudio', senha: 'segredo', seguranca: 'WPA', oculta: false },
      },
    };

    expect(derivar(estado).artefato?.payload).toBe('WIFI:T:WPA;S:Estudio;P:segredo;;');
  });

  it('reporta o problema do formulário sem produzir artefato', () => {
    const d = derivar({ ...ESTADO_INICIAL, tipoConteudo: 'pix' });

    expect(d.conteudo.problema).toMatch(/chave Pix/);
    expect(d.artefato).toBeNull();
  });

  it('aplica as cores escolhidas ao nó do código', () => {
    const d = derivar(comUrl('https://exemplo.com', { corEscura: '#141c99', corClara: '#f3f4f7' }));
    const no = d.cena?.nodes.find((n) => n.kind === 'qr');
    expect(no?.kind === 'qr' ? no.dark.rgb : null).toBe('#141c99');
    expect(no?.kind === 'qr' ? no.light.rgb : null).toBe('#f3f4f7');
  });

  it('centraliza o logo e avalia o limite', () => {
    const d = derivar({ ...COM_LOGO, lado: 50, unidade: 'mm' });
    const imagem = d.cena?.nodes.find((n) => n.kind === 'image');

    expect(imagem?.kind).toBe('image');
    if (imagem?.kind !== 'image') throw new Error('sem logo');
    expect(imagem.x + imagem.w / 2).toBeCloseTo(25, 6);
    expect(imagem.y + imagem.h / 2).toBeCloseTo(25, 6);
    expect(d.logo?.permitido).toBe(true);
  });

  it('acusa logo acima do limite', () => {
    const d = derivar({ ...COM_LOGO, logo: { ...COM_LOGO.logo!, fracaoLado: 0.7 } });
    expect(d.logo?.permitido).toBe(false);
  });

  it('avalia contraste mesmo sem conteúdo válido', () => {
    const d = derivar({ ...ESTADO_INICIAL, corEscura: '#ffffff', corClara: '#0e0f14' });
    expect(d.contraste.polaridadeInvertida).toBe(true);
  });
});
