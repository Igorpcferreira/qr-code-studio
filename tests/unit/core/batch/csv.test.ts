import { describe, expect, it } from 'vitest';
import {
  analisarCsv,
  detectarDelimitador,
  interpretarCsv,
  mapearColunas,
  temCabecalho,
} from '@/core/batch/csv';

describe('analisarCsv', () => {
  it('divide campos e linhas', () => {
    expect(analisarCsv('a,b\nc,d').linhas).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  /** O Excel em pt-BR grava com ponto e vírgula, porque a vírgula é decimal. */
  it('detecta ponto e vírgula e tabulação', () => {
    expect(detectarDelimitador('url;nome\nhttps://a;A')).toBe(';');
    expect(detectarDelimitador('url\tnome')).toBe('\t');
    expect(detectarDelimitador('url,nome')).toBe(',');
  });

  it('não confunde vírgula decimal do corpo com delimitador', () => {
    // A primeira linha é a que carrega a estrutura; o corpo tem vírgula demais.
    expect(detectarDelimitador('valor;nome\n10,50;A\n11,90;B')).toBe(';');
  });

  it('respeita aspas com delimitador e quebra de linha dentro', () => {
    const csv = analisarCsv('a,"b,c"\n"linha\nquebrada",d');
    expect(csv.linhas).toEqual([
      ['a', 'b,c'],
      ['linha\nquebrada', 'd'],
    ]);
  });

  it('aspas duplicadas viram uma aspa literal', () => {
    expect(analisarCsv('"diz ""oi""",b').linhas).toEqual([['diz "oi"', 'b']]);
  });

  it('aceita CRLF e a última linha sem quebra', () => {
    expect(analisarCsv('a,b\r\nc,d\r\n').linhas).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(analisarCsv('a,b\nc,d').linhas).toHaveLength(2);
  });

  /** O Excel grava UTF-8 com BOM; sem removê-lo, o primeiro cabeçalho nunca casa. */
  it('descarta o BOM', () => {
    const csv = analisarCsv('﻿url,nome\nhttps://a,A');
    expect(csv.linhas[0]).toEqual(['url', 'nome']);
    expect(temCabecalho(csv.linhas)).toBe(true);
  });

  it('descarta linhas em branco', () => {
    expect(analisarCsv('a\n\n\nb').linhas).toEqual([['a'], ['b']]);
  });
});

describe('colunas', () => {
  it('reconhece cabeçalho por nome conhecido, com ou sem acento', () => {
    expect(temCabecalho(analisarCsv('Conteúdo,Nome').linhas)).toBe(true);
    expect(temCabecalho(analisarCsv('URL,Arquivo').linhas)).toBe(true);
  });

  /**
   * Sem nome conhecido, a resposta é não. Chutar "parece texto, deve ser
   * cabeçalho" descartaria em silêncio a primeira URL de um arquivo sem
   * cabeçalho — o erro mais caro possível, porque some um QR e ninguém nota.
   */
  it('não chuta cabeçalho quando nenhum nome é reconhecido', () => {
    expect(temCabecalho(analisarCsv('https://a.com,Cartaz').linhas)).toBe(false);
  });

  it('mapeia colunas fora de ordem', () => {
    const linhas = analisarCsv('nome,chamada,url\nA,ESCANEIE,https://a.com').linhas;
    expect(mapearColunas(linhas, true)).toEqual({ conteudo: 2, nome: 0, chamada: 1 });
  });

  it('sem cabeçalho, a ordem é posicional', () => {
    expect(mapearColunas([['https://a.com']], false)).toEqual({ conteudo: 0, nome: 1, chamada: 2 });
  });
});

describe('interpretarCsv', () => {
  it('devolve o número da linha como o usuário vê na planilha', () => {
    const linhas = interpretarCsv(analisarCsv('url,nome\nhttps://a.com,A\nhttps://b.com,B'));

    expect(linhas).toEqual([
      { linha: 2, conteudo: 'https://a.com', nome: 'A', chamada: null },
      { linha: 3, conteudo: 'https://b.com', nome: 'B', chamada: null },
    ]);
  });

  it('pula linhas sem conteúdo, mesmo com outras colunas preenchidas', () => {
    const linhas = interpretarCsv(analisarCsv('url,nome\n,A\nhttps://b.com,B'));
    expect(linhas.map((l) => l.conteudo)).toEqual(['https://b.com']);
  });

  it('lê a chamada por linha', () => {
    const linhas = interpretarCsv(analisarCsv('url;chamada\nhttps://a.com;Menu digital'));
    expect(linhas[0]?.chamada).toBe('Menu digital');
  });

  it('sem cabeçalho, a primeira linha também é dado', () => {
    const linhas = interpretarCsv(analisarCsv('https://a.com\nhttps://b.com'));
    expect(linhas.map((l) => l.linha)).toEqual([1, 2]);
  });
});
