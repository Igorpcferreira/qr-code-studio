import { describe, expect, it } from 'vitest';
import {
  GUI_PIX,
  MAX_TEMPLATE_26,
  TXID_VAZIO,
  analisarTlv,
  campoTlv,
  classificarChave,
  conferirBrCode,
  conferirCrc,
  crc16,
  montarBrCode,
  montarPix,
  normalizarValor,
  paraAscii,
} from '@/core/content/pix';
import type { DadosPix } from '@/core/content/tipos';
import { criarArtefato } from '@/core/qr/create';
import { decodificadorJsQr, escalaParaVerificacao } from '@/core/verify/decode';
import { rasterizarCena } from '@/core/render/raster';
import { construirCenaBasica } from '@/core/scene/build';

const BASE: DadosPix = {
  chave: '11144477735',
  nome: 'Padaria São João',
  cidade: 'São Paulo',
  valor: '',
  identificador: '',
  descricao: '',
};

function montar(patch: Partial<DadosPix> = {}): string {
  const r = montarPix({ ...BASE, ...patch });
  if (r.problema !== null) throw new Error(`esperava sucesso, veio: ${r.problema}`);
  return r.payload;
}

describe('CRC-16/CCITT-FALSE', () => {
  /**
   * O vetor canônico. Existem pelo menos cinco CRCs chamados "CCITT" e eles
   * discordam entre si — este número é o que separa a variante certa das
   * outras quatro, e nenhuma delas devolve 0x29B1 para esta entrada.
   */
  it('devolve 0x29B1 para "123456789"', () => {
    expect(crc16('123456789')).toBe(0x29b1);
  });

  it('devolve 0xFFFF para a entrada vazia — o valor inicial, sem alimentação', () => {
    expect(crc16('')).toBe(0xffff);
  });

  it('reage a qualquer byte trocado', () => {
    expect(crc16('123456789')).not.toBe(crc16('123456780'));
    // Transposição: o CRC precisa distinguir ordem, não só conteúdo.
    expect(crc16('12')).not.toBe(crc16('21'));
  });
});

describe('TLV', () => {
  it('remonta a árvore do payload gerado', () => {
    const nos = analisarTlv(montar());
    expect(nos).not.toBeNull();

    expect(campoTlv(nos, ['00'])).toBe('01');
    expect(campoTlv(nos, ['26', '00'])).toBe(GUI_PIX);
    expect(campoTlv(nos, ['26', '01'])).toBe('11144477735');
    expect(campoTlv(nos, ['52'])).toBe('0000');
    expect(campoTlv(nos, ['53'])).toBe('986');
    expect(campoTlv(nos, ['58'])).toBe('BR');
    expect(campoTlv(nos, ['62', '05'])).toBe(TXID_VAZIO);
  });

  it('recusa tamanho anunciado maior que o restante', () => {
    expect(analisarTlv('0099ab')).toBeNull();
  });

  it('recusa cabeçalho não numérico', () => {
    expect(analisarTlv('xx02ab')).toBeNull();
  });

  it('aceita a sequência vazia', () => {
    expect(analisarTlv('')).toEqual([]);
  });
});

describe('checksum do BR Code', () => {
  it('o payload gerado passa na própria conferência', () => {
    expect(conferirCrc(montar())).toBe(true);
  });

  /**
   * O CRC cobre o payload inteiro **incluindo** o cabeçalho `6304`. Trocar um
   * caractere qualquer do meio precisa invalidar — sem isto o checksum estaria
   * cobrindo só a si mesmo e passaria despercebido.
   */
  it('quebra quando qualquer caractere do corpo muda', () => {
    const payload = montar();

    for (const i of [0, 10, 40, payload.length - 10]) {
      const original = payload[i] ?? '';
      const trocado = original === '9' ? '8' : '9';
      const alterado = payload.slice(0, i) + trocado + payload.slice(i + 1);
      expect(conferirCrc(alterado), `posição ${i}`).toBe(false);
    }
  });

  it('recusa payload sem o campo de CRC', () => {
    expect(conferirCrc(montar().slice(0, -8))).toBe(false);
  });
});

describe('chave Pix', () => {
  it('aceita CPF com dígitos verificadores corretos e recusa o resto', () => {
    expect(classificarChave('111.444.777-35')).toEqual({ tipo: 'cpf', valor: '11144477735' });
    // Um dígito verificador trocado: o QR sairia perfeito para um destino inexistente.
    expect(classificarChave('111.444.777-36')).toBeNull();
    expect(classificarChave('11111111111')).toBeNull();
  });

  it('aceita CNPJ pela regra de julho de 2026, que também vale para o numérico', () => {
    expect(classificarChave('11.222.333/0001-81')).toEqual({ tipo: 'cnpj', valor: '11222333000181' });
    expect(classificarChave('11.222.333/0001-82')).toBeNull();
  });

  it('desempata CPF e celular pelo sinal de mais', () => {
    // Onze dígitos são as duas coisas ao mesmo tempo; só o formato internacional decide.
    expect(classificarChave('11144477735')?.tipo).toBe('cpf');
    expect(classificarChave('+5511987654321')).toEqual({ tipo: 'telefone', valor: '+5511987654321' });
  });

  it('normaliza e-mail e chave aleatória para minúscula', () => {
    expect(classificarChave('Contato@Exemplo.COM')).toEqual({ tipo: 'email', valor: 'contato@exemplo.com' });
    expect(classificarChave('123E4567-E89B-12D3-A456-426614174000')).toEqual({
      tipo: 'aleatoria',
      valor: '123e4567-e89b-12d3-a456-426614174000',
    });
  });

  it('recusa o que não é chave', () => {
    expect(classificarChave('')).toBeNull();
    expect(classificarChave('não é chave')).toBeNull();
    expect(classificarChave('arroba@sem-tld')).toBeNull();
    expect(classificarChave('+5511')).toBeNull();
  });
});

describe('montagem', () => {
  it('reduz acento a ASCII, como manda o conjunto de caracteres do EMV', () => {
    // O travessão não tem equivalente ASCII e some; o espaço duplo que ele deixa é colapsado.
    expect(paraAscii('São João — Açaí')).toBe('Sao Joao Acai');

    const nos = analisarTlv(montar());
    expect(campoTlv(nos, ['59'])).toBe('Padaria Sao Joao');
    expect(campoTlv(nos, ['60'])).toBe('Sao Paulo');
  });

  it('o payload inteiro é ASCII imprimível', () => {
    expect(montar({ nome: 'Ação Ltda', cidade: 'Brasília', descricao: 'Pão de queijo' })).toMatch(/^[ -~]+$/);
  });

  it('trunca nome em 25 e cidade em 15 caracteres', () => {
    const nos = analisarTlv(montar({ nome: 'A'.repeat(40), cidade: 'B'.repeat(40) }));
    expect(campoTlv(nos, ['59'])).toHaveLength(25);
    expect(campoTlv(nos, ['60'])).toHaveLength(15);
  });

  it('mantém o template 26 dentro de 99 caracteres cortando a descrição', () => {
    const nos = analisarTlv(montar({ descricao: 'D'.repeat(200) }));
    const template = nos?.find((n) => n.id === '26');

    expect(template?.valor.length).toBeLessThanOrEqual(MAX_TEMPLATE_26);
    // Corta, não descarta: o que coube continua lá.
    expect(campoTlv(nos, ['26', '02'])?.length).toBeGreaterThan(0);
  });

  it('omite o campo de valor quando o Pix é de valor livre', () => {
    expect(campoTlv(analisarTlv(montar()), ['54'])).toBeNull();
    expect(montarPix(BASE).observacao).toMatch(/quem paga digita/);
  });

  it('aceita vírgula e ponto no valor e emite duas casas', () => {
    expect(campoTlv(analisarTlv(montar({ valor: '49,90' })), ['54'])).toBe('49.90');
    expect(campoTlv(analisarTlv(montar({ valor: '1.234,50' })), ['54'])).toBe('1234.50');
    expect(campoTlv(analisarTlv(montar({ valor: '7' })), ['54'])).toBe('7.00');
  });

  it('recusa valor que não é número', () => {
    expect(montarPix({ ...BASE, valor: 'grátis' }).problema).toMatch(/Valor inválido/);
    expect(normalizarValor('-5')).toBeNull();
    expect(normalizarValor('0')).toBeNull();
  });

  it('limpa o identificador e usa *** quando não informado', () => {
    expect(campoTlv(analisarTlv(montar({ identificador: 'pedido #42' })), ['62', '05'])).toBe('pedido42');
    expect(campoTlv(analisarTlv(montar()), ['62', '05'])).toBe(TXID_VAZIO);
  });

  /**
   * O ponto de iniciação (campo 01) só é obrigatório quando vale `12`, que
   * significa "use uma vez" — a marca de um código dinâmico. Um estático não
   * pode carregá-lo.
   */
  it('não emite o ponto de iniciação de uso único', () => {
    expect(campoTlv(analisarTlv(montar()), ['01'])).toBeNull();
  });

  it('exige chave, nome e cidade, com mensagem específica', () => {
    expect(montarPix({ ...BASE, chave: '' }).problema).toMatch(/chave Pix/);
    expect(montarPix({ ...BASE, chave: '11144477736' }).problema).toMatch(/dígitos verificadores/);
    expect(montarPix({ ...BASE, nome: '  ' }).problema).toMatch(/nome do recebedor/);
    expect(montarPix({ ...BASE, cidade: '' }).problema).toMatch(/cidade/);
  });
});

describe('conferirBrCode', () => {
  /** Fecha um corpo TLV com o CRC correto, para forjar payloads válidos porém errados. */
  function selar(corpo: string): string {
    const semCrc = `${corpo}6304`;
    return semCrc + crc16(semCrc).toString(16).toUpperCase().padStart(4, '0');
  }

  it('aprova o que o próprio módulo gera', () => {
    expect(conferirBrCode(montar({ valor: '10,00', identificador: 'A1' }))).toEqual({
      ok: true,
      motivo: null,
    });
  });

  it('reprova CRC quebrado', () => {
    const payload = montar();
    const ultimo = payload.slice(-1);
    expect(conferirBrCode(payload.slice(0, -1) + (ultimo === '0' ? '1' : '0')).motivo).toMatch(/CRC/);
  });

  /**
   * Os dois casos que só a conferência estrutural pega: o CRC está correto, o
   * TLV está bem formado, e mesmo assim o código não paga ninguém.
   */
  it('reprova payload de outro arranjo, com CRC perfeito', () => {
    const outro = selar('000201' + '5303986' + '5802BR' + '5904Nome' + '6003Cid');
    expect(conferirCrc(outro)).toBe(true);
    expect(conferirBrCode(outro).motivo).toMatch(/template 26/);
  });

  it('reprova campo obrigatório vazio, com CRC perfeito', () => {
    const template26 = `0014${GUI_PIX}011111144477735`;
    const bloco26 = `26${String(template26.length).padStart(2, '0')}${template26}`;
    const semNome = selar(`000201${bloco26}53039865802BR59006003Cid`);

    expect(conferirCrc(semNome)).toBe(true);
    expect(conferirBrCode(semNome).motivo).toMatch(/nome do recebedor/);
  });

  it('a montagem direta concorda com a montagem pelo formulário', () => {
    const direto = montarBrCode(BASE, { tipo: 'cpf', valor: '11144477735' });
    expect(direto.payload).toBe(montar());
    expect(direto.valor).toBeNull();
  });
});

/**
 * O circuito completo, que é o argumento do produto aplicado ao Pix: montar o
 * payload, virar matriz, virar pixels, decodificar de volta e conferir que o
 * BR Code que voltou continua válido — CRC e campos.
 */
describe('ida e volta pelo QR', () => {
  it('sobrevive a virar desenho e voltar', () => {
    const payload = montar({ valor: '129,90', descricao: 'Conserto', identificador: 'OS7788' });

    const criacao = criarArtefato(payload, 'M');
    expect(criacao.ok).toBe(true);
    if (!criacao.ok) return;

    const cena = construirCenaBasica(criacao.artefato, 40);
    const bitmap = rasterizarCena(cena, escalaParaVerificacao(40, criacao.artefato.sizeComQuietZone, 8));

    const lido = decodificadorJsQr.decodificar(bitmap);
    expect(lido).toBe(payload);
    expect(conferirBrCode(lido ?? '')).toEqual({ ok: true, motivo: null });
  });
});
