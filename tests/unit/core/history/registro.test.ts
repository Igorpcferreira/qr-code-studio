import { describe, expect, it } from 'vitest';
import type { RegistroHistorico } from '@/core/history/registro';
import {
  MAX_REGISTROS,
  chaveDoEstado,
  criarRegistro,
  inserir,
  podar,
  rotuloDoRegistro,
} from '@/core/history/registro';
import type { EstadoGerador } from '@/state/reducer';
import { ESTADO_INICIAL } from '@/state/reducer';

function comUrl(valor: string, resto: Partial<EstadoGerador> = {}): EstadoGerador {
  return { ...ESTADO_INICIAL, ...resto, formularios: { ...ESTADO_INICIAL.formularios, url: { valor } } };
}

describe('chaveDoEstado', () => {
  it('a mesma configuração produz a mesma chave', () => {
    expect(chaveDoEstado(comUrl('https://a.com'))).toBe(chaveDoEstado(comUrl('https://a.com')));
  });

  /**
   * A chave precisa reagir a qualquer campo, não só ao conteúdo: o histórico
   * guarda configurações, e duas peças do mesmo endereço em cores diferentes
   * são dois registros.
   */
  it('reage a mudança de conteúdo, de cor e de moldura', () => {
    const base = comUrl('https://a.com');

    expect(chaveDoEstado(comUrl('https://b.com'))).not.toBe(chaveDoEstado(base));
    expect(chaveDoEstado(comUrl('https://a.com', { corEscura: '#2c36f0' }))).not.toBe(chaveDoEstado(base));
    expect(chaveDoEstado(comUrl('https://a.com', { moldura: 'cartaz' }))).not.toBe(chaveDoEstado(base));
  });
});

describe('rotuloDoRegistro', () => {
  it('URL e texto mostram o próprio conteúdo', () => {
    expect(rotuloDoRegistro(comUrl('https://a.com'), 'https://a.com')).toBe('URL · https://a.com');
  });

  /**
   * Um vCard começa com `BEGIN:VCARD\r\nVERSION:3.0` e um Pix com `00020126…`.
   * Mostrar o payload cru desses dois faria a lista inteira parecer igual.
   */
  it('Pix, contato e Wi-Fi mostram o campo que o usuário reconhece', () => {
    const pix: EstadoGerador = {
      ...ESTADO_INICIAL,
      tipoConteudo: 'pix',
      formularios: {
        ...ESTADO_INICIAL.formularios,
        pix: { ...ESTADO_INICIAL.formularios.pix, nome: 'Padaria', valor: '49,90' },
      },
    };
    expect(rotuloDoRegistro(pix, '00020126…')).toBe('Pix · Padaria · R$ 49,90');

    const semValor: EstadoGerador = {
      ...pix,
      formularios: { ...pix.formularios, pix: { ...pix.formularios.pix, valor: '' } },
    };
    expect(rotuloDoRegistro(semValor, '00020126…')).toBe('Pix · Padaria · valor livre');

    const vcard: EstadoGerador = {
      ...ESTADO_INICIAL,
      tipoConteudo: 'vcard',
      formularios: {
        ...ESTADO_INICIAL.formularios,
        vcard: { ...ESTADO_INICIAL.formularios.vcard, nome: 'Igor', sobrenome: 'Ferreira' },
      },
    };
    expect(rotuloDoRegistro(vcard, 'BEGIN:VCARD')).toBe('Contato · Igor Ferreira');

    const wifi: EstadoGerador = {
      ...ESTADO_INICIAL,
      tipoConteudo: 'wifi',
      formularios: {
        ...ESTADO_INICIAL.formularios,
        wifi: { ...ESTADO_INICIAL.formularios.wifi, ssid: 'Estudio' },
      },
    };
    expect(rotuloDoRegistro(wifi, 'WIFI:T:WPA;')).toBe('Wi-Fi · Estudio');
  });

  it('corta conteúdo longo em vez de esticar a lista', () => {
    const longo = `https://exemplo.com/${'x'.repeat(200)}`;
    const rotulo = rotuloDoRegistro(comUrl(longo), longo);

    expect(rotulo.length).toBeLessThan(70);
    expect(rotulo.endsWith('…')).toBe(true);
  });
});

describe('inserir', () => {
  function registro(id: string, criadoEm: number): RegistroHistorico {
    return { id, criadoEm, rotulo: id, tipo: 'url', payload: id, estado: ESTADO_INICIAL };
  }

  it('coloca o mais novo no topo', () => {
    const lista = inserir([registro('a', 1)], registro('b', 2));
    expect(lista.map((r) => r.id)).toEqual(['b', 'a']);
  });

  /** Voltar a uma configuração antiga é sinal de que ela ainda interessa. */
  it('reinserir move para o topo em vez de duplicar', () => {
    const lista = inserir([registro('a', 1), registro('b', 2)], registro('b', 3));

    expect(lista.map((r) => r.id)).toEqual(['b', 'a']);
    expect(lista[0]?.criadoEm).toBe(3);
  });

  it('respeita o teto', () => {
    let lista: readonly RegistroHistorico[] = [];
    for (let i = 0; i < MAX_REGISTROS + 10; i++) lista = inserir(lista, registro(`r${i}`, i));

    expect(lista).toHaveLength(MAX_REGISTROS);
    expect(lista[0]?.id).toBe(`r${MAX_REGISTROS + 9}`);
  });

  it('podar ordena por data e corta o excesso', () => {
    const bagunçado = [registro('a', 3), registro('b', 1), registro('c', 2)];
    expect(podar(bagunçado, 2).map((r) => r.id)).toEqual(['a', 'c']);
  });
});

describe('criarRegistro', () => {
  it('o relógio é injetado, não lido de dentro', () => {
    const registro = criarRegistro({ estado: comUrl('https://a.com'), payload: 'https://a.com', agora: 42 });

    expect(registro).toMatchObject({ criadoEm: 42, tipo: 'url', payload: 'https://a.com' });
    expect(registro.id).toBe(chaveDoEstado(comUrl('https://a.com')));
  });
});
