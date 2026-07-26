import { describe, expect, it } from 'vitest';
import * as fmt from '@/lib/format';
import { completarEsquema, validarUrl } from '@/lib/url';

describe('validarUrl', () => {
  /**
   * A correção que a investigação apontou na versão 1.0: quem digitava
   * `loja.exemplo.com.br` recebia erro em vez de ter o esquema completado.
   */
  it('completa https:// quando falta esquema', () => {
    const r = validarUrl('loja.exemplo.com.br/drop-07');
    expect(r.valida).toBe(true);
    if (!r.valida) throw new Error('inesperado');
    expect(r.url).toBe('https://loja.exemplo.com.br/drop-07');
    expect(r.completou).toBe(true);
  });

  it('não mexe em quem já trouxe esquema', () => {
    for (const url of ['https://exemplo.com', 'http://exemplo.com']) {
      const r = validarUrl(url);
      if (!r.valida) throw new Error(`${url} deveria valer`);
      expect(r.url).toBe(url);
      expect(r.completou).toBe(false);
    }
  });

  it('recusa esquema fora de http e https', () => {
    for (const url of ['javascript:alert(1)', 'ftp://exemplo.com', 'file:///etc/passwd']) {
      expect(validarUrl(url).valida, url).toBe(false);
    }
  });

  it('recusa vazio, espaço e domínio incompleto', () => {
    expect(validarUrl('').valida).toBe(false);
    expect(validarUrl('   ').valida).toBe(false);
    expect(validarUrl('exemplo com espaço').valida).toBe(false);
    expect(validarUrl('localhost').valida).toBe(false);
  });

  it('aceita porta, query, fragmento e acentuação', () => {
    for (const url of [
      'https://exemplo.com:8443/caminho?a=1&b=2#topo',
      'https://exemplo.com.br/ação',
      'exemplo.com.br',
    ]) {
      expect(validarUrl(url).valida, url).toBe(true);
    }
  });

  it('completarEsquema é neutro em texto vazio', () => {
    expect(completarEsquema('   ')).toBe('');
  });
});

describe('formatação da ficha', () => {
  it('usa separador de milhar pt-BR', () => {
    expect(fmt.numero(1782)).toBe('1.782');
    expect(fmt.bytes(1782, 2303)).toBe('1.782 / 2.303 bytes');
  });

  it('usa o sinal de multiplicação, não a letra x', () => {
    expect(fmt.modulos(41)).toBe('41 × 41');
  });

  it('mostra a fração de recuperação junto do nível', () => {
    expect(fmt.correcao('H')).toBe('H · 30%');
    expect(fmt.correcao('L')).toBe('L · 7%');
  });

  it('decimal com vírgula', () => {
    expect(fmt.decimal(86.69)).toBe('86,7');
    expect(fmt.decimal(0.396, 2)).toBe('0,40');
  });

  /**
   * O identificador sai do conteúdo, não do relógio: dois artefatos iguais
   * precisam ter o mesmo código, e um valor que muda a cada segundo não seria
   * reproduzível — nem deixaria de vazar quando o QR foi gerado.
   */
  it('identificador é determinístico e sensível ao conteúdo', () => {
    const a = fmt.identificador('https://exemplo.com', 5, 'H');
    expect(fmt.identificador('https://exemplo.com', 5, 'H')).toBe(a);
    expect(fmt.identificador('https://outro.com', 5, 'H')).not.toBe(a);
    expect(a).toMatch(/^QR-V5H-[0-9A-Z]{4}$/);
  });

  describe('nomeDeArquivo', () => {
    it('usa o domínio quando o conteúdo é URL', () => {
      expect(fmt.nomeDeArquivo('https://arquivo.gov.br/registro/8841', 'svg')).toBe('qr-arquivo-gov-br.svg');
    });

    it('derruba acento e caractere inválido em texto livre', () => {
      const nome = fmt.nomeDeArquivo('Ação: coração & cia!', 'png');
      expect(nome).toMatch(/^qr-[a-z0-9-]+\.png$/);
      expect(nome).not.toMatch(/[çãêé&:!]/);
    });

    it('não devolve nome vazio nem terminado em traço', () => {
      expect(fmt.nomeDeArquivo('!!!', 'svg')).toBe('qr-code.svg');
      expect(fmt.nomeDeArquivo('abc---', 'svg')).not.toContain('-.');
    });
  });
});
