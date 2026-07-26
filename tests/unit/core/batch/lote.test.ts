import { describe, expect, it } from 'vitest';
import { analisarCsv, interpretarCsv } from '@/core/batch/csv';
import type { LinhaLote } from '@/core/batch/csv';
import { estadoDaLinha, gerarItem } from '@/core/batch/lote';
import { criarZip } from '@/core/batch/zip';
import type { EstadoGerador } from '@/state/reducer';
import { ESTADO_INICIAL } from '@/state/reducer';

const BASE: EstadoGerador = { ...ESTADO_INICIAL, lado: 40, unidade: 'mm' };

function linha(conteudo: string, resto: Partial<LinhaLote> = {}): LinhaLote {
  return { linha: 1, conteudo, nome: null, chamada: null, ...resto };
}

describe('estadoDaLinha', () => {
  it('substitui só o conteúdo, preservando a configuração-modelo', () => {
    const modelo: EstadoGerador = { ...BASE, nivel: 'Q', moldura: 'inferior', corMoldura: '#2c36f0' };
    const estado = estadoDaLinha(modelo, linha('https://a.com'));

    expect(estado.formularios.url.valor).toBe('https://a.com');
    expect(estado.nivel).toBe('Q');
    expect(estado.moldura).toBe('inferior');
    expect(estado.corMoldura).toBe('#2c36f0');
  });

  it('a chamada da planilha vence a do modelo, quando existe', () => {
    expect(estadoDaLinha(BASE, linha('a.com', { chamada: 'VER MENU' })).chamada).toBe('VER MENU');
    expect(estadoDaLinha(BASE, linha('a.com')).chamada).toBe(BASE.chamada);
  });

  it('texto livre continua texto livre', () => {
    const estado = estadoDaLinha({ ...BASE, tipoConteudo: 'texto' }, linha('não é uma URL'));
    expect(estado.tipoConteudo).toBe('texto');
    expect(estado.formularios.texto.valor).toBe('não é uma URL');
  });
});

describe('gerarItem', () => {
  it('gera SVG com o nome pedido pela planilha', async () => {
    const { item, entrada } = await gerarItem(linha('https://a.com', { nome: 'Cartaz Loja' }), {
      base: BASE,
      formato: 'svg',
      verificar: false,
    });

    expect(item.ok).toBe(true);
    expect(item.nomeArquivo).toBe('Cartaz-Loja.svg');
    expect(new TextDecoder().decode(entrada?.dados)).toContain('<svg');
  });

  it('sem nome na planilha, deriva do conteúdo', async () => {
    const { item } = await gerarItem(linha('https://loja.exemplo.com.br/x'), {
      base: BASE,
      formato: 'svg',
      verificar: false,
    });

    expect(item.nomeArquivo).toBe('qr-loja-exemplo-com-br.svg');
  });

  it('gera PNG pelo codificador próprio, sem canvas', async () => {
    const { entrada } = await gerarItem(linha('https://a.com'), {
      base: BASE,
      formato: 'png',
      verificar: false,
    });

    expect(Array.from(entrada?.dados.subarray(0, 4) ?? [])).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  /** Mesma regra da interface: quem digita o domínio recebe o esquema completo. */
  it('completa o esquema da URL, e o relatório mostra a diferença', async () => {
    const { item } = await gerarItem(linha('loja.exemplo.com.br'), {
      base: BASE,
      formato: 'svg',
      verificar: true,
    });

    expect(item.conteudo).toBe('loja.exemplo.com.br');
    expect(item.payload).toBe('https://loja.exemplo.com.br');
  });

  /**
   * Uma linha ruim não pode derrubar o lote nem entrar no ZIP calada. Ela vira
   * item com motivo, e o relatório mostra o número da linha na planilha.
   */
  it('linha inválida vira relatório, não exceção nem arquivo', async () => {
    const { item, entrada } = await gerarItem(linha('sem espaço nenhum aqui', { linha: 7 }), {
      base: BASE,
      formato: 'svg',
      verificar: false,
    });

    expect(item.ok).toBe(false);
    expect(item.linha).toBe(7);
    expect(item.motivo).toMatch(/espaços/);
    expect(entrada).toBeNull();
  });

  it('conteúdo que estoura a capacidade explica quanto faltou', async () => {
    const { item } = await gerarItem(linha('x'.repeat(3000)), {
      base: { ...BASE, tipoConteudo: 'texto' },
      formato: 'svg',
      verificar: false,
    });

    expect(item.ok).toBe(false);
    expect(item.motivo).toMatch(/não cabem no nível H/);
  });

  /**
   * A verificação por linha é o que impede um ZIP com mil arquivos dos quais
   * três não leem — defeito que ninguém descobre antes da impressão.
   */
  it('com verificação, o código ilegível não é empacotado', async () => {
    const semContraste: EstadoGerador = { ...BASE, corEscura: '#dddddd', corClara: '#ffffff' };

    const comVerificacao = await gerarItem(linha('https://a.com'), {
      base: semContraste,
      formato: 'svg',
      verificar: true,
    });
    expect(comVerificacao.item.ok).toBe(false);
    expect(comVerificacao.entrada).toBeNull();

    // Sem verificar, o mesmo arquivo sairia — é a opção que o painel oferece.
    const sem = await gerarItem(linha('https://a.com'), {
      base: semContraste,
      formato: 'svg',
      verificar: false,
    });
    expect(sem.item.ok).toBe(true);
  });

  it('a peça verificada passa quando a configuração é sadia', async () => {
    const { item } = await gerarItem(linha('https://arquivo.gov.br/registro/8841'), {
      base: { ...BASE, moldura: 'inferior' },
      formato: 'svg',
      verificar: true,
    });

    expect(item).toMatchObject({ ok: true, motivo: null });
  });
});

describe('lote completo', () => {
  const CSV = [
    'url;nome;chamada',
    'https://arquivo.gov.br/a;Peça A;ESCANEIE',
    'https://arquivo.gov.br/b;Peça B;',
    'sem espaço válido;Peça C;',
  ].join('\n');

  it('processa a planilha inteira e empacota só o que passou', async () => {
    const linhas = interpretarCsv(analisarCsv(CSV));
    expect(linhas).toHaveLength(3);

    const resultados = [];
    for (const l of linhas) {
      resultados.push(await gerarItem(l, { base: BASE, formato: 'svg', verificar: true }));
    }

    const entradas = resultados.map((r) => r.entrada).filter((e) => e !== null);
    expect(entradas).toHaveLength(2);
    expect(entradas.map((e) => e.nome)).toEqual(['Peca-A.svg', 'Peca-B.svg']);

    const falhas = resultados.filter((r) => !r.item.ok);
    expect(falhas).toHaveLength(1);
    expect(falhas[0]?.item.linha).toBe(4);

    const zip = await criarZip(entradas);
    expect(zip.length).toBeGreaterThan(100);
  });

  it('a chamada da planilha entra no desenho, não no conteúdo codificado', async () => {
    const [primeira] = interpretarCsv(analisarCsv(CSV));
    expect(primeira).toBeDefined();
    if (primeira === undefined) return;

    const { entrada, item } = await gerarItem(primeira, {
      base: { ...BASE, moldura: 'inferior' },
      formato: 'svg',
      verificar: true,
    });

    // A chamada está impressa no desenho…
    expect(new TextDecoder().decode(entrada?.dados)).toContain('ESCANEIE');
    // …e o payload, que a verificação acabou de decodificar de volta, não a contém.
    expect(item.payload).toBe('https://arquivo.gov.br/a');
  });
});
