import { describe, expect, it } from 'vitest';
import { montarConteudo } from '@/core/content';
import {
  montarEmail,
  montarGeo,
  montarSms,
  montarTelefone,
  montarVcard,
  montarWifi,
  normalizarTelefone,
} from '@/core/content/formatos';
import type { DadosVcard, DadosWifi } from '@/core/content/tipos';
import { FORMULARIOS_INICIAIS, TIPOS_CONTEUDO } from '@/core/content/tipos';
import { criarArtefato } from '@/core/qr/create';
import { rasterizarCena } from '@/core/render/raster';
import { construirCenaBasica } from '@/core/scene/build';
import { decodificadorJsQr, escalaParaVerificacao } from '@/core/verify/decode';

const WIFI_BASE: DadosWifi = { ssid: 'Estúdio', senha: 'segredo', seguranca: 'WPA', oculta: false };

const VCARD_BASE: DadosVcard = {
  ...FORMULARIOS_INICIAIS.vcard,
  nome: 'Igor',
  sobrenome: 'Ferreira',
  organizacao: 'Estúdio, Ltda',
  celular: '11987654321',
  email: 'contato@exemplo.com',
};

describe('Wi-Fi', () => {
  it('monta o registro com terminador duplo', () => {
    expect(montarWifi(WIFI_BASE).payload).toBe('WIFI:T:WPA;S:Estúdio;P:segredo;;');
  });

  /**
   * O escape é o que separa um payload que funciona de um que falha só no
   * aparelho de quem escaneia. Ponto e vírgula num SSID corporativo não é caso
   * raro.
   */
  it('escapa os quatro caracteres reservados no SSID e na senha', () => {
    const r = montarWifi({ ...WIFI_BASE, ssid: 'Rede;A,B:C\\D', senha: 'a"b;c' });
    expect(r.payload).toBe('WIFI:T:WPA;S:Rede\\;A\\,B\\:C\\\\D;P:a\\"b\\;c;;');
  });

  /**
   * SSID só de dígitos hexadecimais precisa de aspas: sem elas a especificação
   * manda interpretar o valor como o nome da rede em hexadecimal, e "2024"
   * viraria dois bytes binários.
   */
  it('protege SSID que parece hexadecimal', () => {
    expect(montarWifi({ ...WIFI_BASE, ssid: '2024' }).payload).toContain('S:"2024";');
    expect(montarWifi({ ...WIFI_BASE, ssid: '2024b' }).payload).toContain('S:2024b;');
  });

  it('rede aberta não carrega senha e diz isso', () => {
    const r = montarWifi({ ...WIFI_BASE, seguranca: 'aberta', senha: 'ignorada' });
    expect(r.payload).toBe('WIFI:T:nopass;S:Estúdio;;');
    expect(r.observacao).toMatch(/aberta/);
  });

  it('marca rede oculta e exige SSID e senha', () => {
    expect(montarWifi({ ...WIFI_BASE, oculta: true }).payload).toContain(';H:true;');
    expect(montarWifi({ ...WIFI_BASE, ssid: ' ' }).problema).toMatch(/SSID/);
    expect(montarWifi({ ...WIFI_BASE, senha: '' }).problema).toMatch(/senha/);
  });

  it('avisa que a senha viaja em claro dentro do desenho', () => {
    expect(montarWifi(WIFI_BASE).observacao).toMatch(/legível/);
  });
});

describe('telefone e SMS', () => {
  it('completa o país quando o número vem só com DDD', () => {
    expect(normalizarTelefone('(11) 98765-4321')).toBe('+5511987654321');
    expect(normalizarTelefone('1132165498')).toBe('+551132165498');
    expect(normalizarTelefone('+1 415 555 0132')).toBe('+14155550132');
    expect(normalizarTelefone('123')).toBeNull();
  });

  it('avisa quando completou o país', () => {
    expect(montarTelefone({ numero: '11987654321' })).toMatchObject({
      payload: 'tel:+5511987654321',
      observacao: 'Codificado como +5511987654321.',
    });
    expect(montarTelefone({ numero: '+5511987654321' }).observacao).toBeNull();
  });

  /**
   * `SMSTO:` e não o `sms:` da RFC 5724: o esquema padrão existe, mas os dois
   * sistemas móveis discordam de como anexar o corpo da mensagem.
   */
  it('usa SMSTO com e sem mensagem', () => {
    expect(montarSms({ numero: '11987654321', mensagem: 'Oi' }).payload).toBe('SMSTO:+5511987654321:Oi');
    expect(montarSms({ numero: '11987654321', mensagem: '' }).payload).toBe('SMSTO:+5511987654321');
  });

  it('recusa número inválido nos dois', () => {
    expect(montarTelefone({ numero: 'abc' }).problema).toMatch(/inválido/);
    expect(montarSms({ numero: '1', mensagem: '' }).problema).toMatch(/inválido/);
  });
});

describe('e-mail', () => {
  it('codifica assunto e corpo na consulta', () => {
    const r = montarEmail({ para: 'oi@exemplo.com', assunto: 'Orçamento & prazo', corpo: 'Bom dia' });
    expect(r.payload).toBe('mailto:oi@exemplo.com?subject=Or%C3%A7amento%20%26%20prazo&body=Bom%20dia');
  });

  it('sem assunto nem corpo, sai só o endereço', () => {
    expect(montarEmail({ para: 'oi@exemplo.com', assunto: '', corpo: '' }).payload).toBe(
      'mailto:oi@exemplo.com',
    );
  });

  it('recusa endereço inválido', () => {
    expect(montarEmail({ para: 'sem-arroba', assunto: '', corpo: '' }).problema).toMatch(/inválido/);
    expect(montarEmail({ para: '', assunto: '', corpo: '' }).problema).toMatch(/destinatário/);
  });
});

describe('geolocalização', () => {
  it('aceita vírgula decimal e emite a URI da RFC 5870', () => {
    expect(montarGeo({ latitude: '-23,5505', longitude: '-46.6333' }).payload).toBe('geo:-23.5505,-46.6333');
  });

  it('recusa coordenada fora da faixa', () => {
    expect(montarGeo({ latitude: '95', longitude: '0' }).problema).toMatch(/Latitude/);
    expect(montarGeo({ latitude: '0', longitude: '-200' }).problema).toMatch(/Longitude/);
    expect(montarGeo({ latitude: '', longitude: '' }).problema).toMatch(/latitude e longitude/);
  });
});

describe('vCard', () => {
  it('monta a estrutura 3.0 com CRLF', () => {
    const linhas = montarVcard(VCARD_BASE).payload.split('\r\n');

    expect(linhas[0]).toBe('BEGIN:VCARD');
    expect(linhas[1]).toBe('VERSION:3.0');
    expect(linhas).toContain('N:Ferreira;Igor;;;');
    expect(linhas).toContain('FN:Igor Ferreira');
    expect(linhas).toContain('TEL;TYPE=CELL:+5511987654321');
    expect(linhas).toContain('EMAIL;TYPE=INTERNET:contato@exemplo.com');
    expect(linhas.at(-2)).toBe('END:VCARD');
  });

  it('escapa vírgula, ponto e vírgula e quebra de linha', () => {
    const payload = montarVcard({ ...VCARD_BASE, nota: 'Linha 1\nLinha; 2' }).payload;
    expect(payload).toContain('ORG:Estúdio\\, Ltda');
    expect(payload).toContain('NOTE:Linha 1\\nLinha\\; 2');
  });

  it('completa o esquema do site e monta o endereço com sete componentes', () => {
    const payload = montarVcard({
      ...VCARD_BASE,
      site: 'exemplo.com.br',
      endereco: 'Rua A, 100',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000-000',
      pais: 'Brasil',
    }).payload;

    expect(payload).toContain('URL:https://exemplo.com.br');
    expect(payload).toContain('ADR;TYPE=WORK:;;Rua A\\, 100;São Paulo;SP;01000-000;Brasil');
  });

  it('omite campo vazio em vez de emitir linha em branco', () => {
    const payload = montarVcard({ ...FORMULARIOS_INICIAIS.vcard, nome: 'Ana' }).payload;
    expect(payload).not.toContain('ORG:');
    expect(payload).not.toContain('ADR');
    expect(payload).not.toContain('TEL');
  });

  it('exige ao menos um nome e avisa quando o contato fica longo', () => {
    expect(montarVcard(FORMULARIOS_INICIAIS.vcard).problema).toMatch(/nome/);
    expect(montarVcard({ ...VCARD_BASE, nota: 'x'.repeat(500) }).observacao).toMatch(/versão do QR/);
  });
});

describe('montarConteudo', () => {
  it('completa o esquema da URL e reporta que completou', () => {
    const r = montarConteudo('url', {
      ...FORMULARIOS_INICIAIS,
      url: { valor: 'loja.exemplo.com.br/drop-07' },
    });
    expect(r.payload).toBe('https://loja.exemplo.com.br/drop-07');
    expect(r.observacao).toMatch(/Completamos/);
  });

  it('campo vazio não é erro — é quem ainda não digitou', () => {
    expect(montarConteudo('url', FORMULARIOS_INICIAIS)).toEqual({
      payload: '',
      problema: null,
      observacao: null,
    });
  });

  it('texto livre passa intacto, inclusive espaços', () => {
    const r = montarConteudo('texto', { ...FORMULARIOS_INICIAIS, texto: { valor: '  dois  espaços  ' } });
    expect(r.payload).toBe('  dois  espaços  ');
  });

  it('atende os nove tipos sem cair no vazio por engano', () => {
    // Guarda contra o `switch` esquecer um caso quando o décimo tipo chegar.
    for (const tipo of TIPOS_CONTEUDO) {
      expect(() => montarConteudo(tipo, FORMULARIOS_INICIAIS)).not.toThrow();
    }
  });
});

/**
 * Cada formato vira desenho e volta idêntico. É o mesmo argumento que sustenta
 * o produto inteiro, aplicado aos formatos novos: escapes e acentos precisam
 * sobreviver à codificação, não só à montagem da string.
 */
describe('ida e volta pelo QR', () => {
  const casos: readonly { readonly nome: string; readonly payload: string }[] = [
    { nome: 'wifi', payload: montarWifi({ ...WIFI_BASE, ssid: 'Rede;Café', senha: 'a\\b' }).payload },
    {
      nome: 'email',
      payload: montarEmail({ para: 'oi@exemplo.com', assunto: 'Açaí', corpo: 'Olá' }).payload,
    },
    { nome: 'sms', payload: montarSms({ numero: '11987654321', mensagem: 'Chegou!' }).payload },
    { nome: 'telefone', payload: montarTelefone({ numero: '11987654321' }).payload },
    { nome: 'geo', payload: montarGeo({ latitude: '-23.5505', longitude: '-46.6333' }).payload },
    { nome: 'vcard', payload: montarVcard(VCARD_BASE).payload },
  ];

  for (const { nome, payload } of casos) {
    it(`${nome} sobrevive a virar desenho e voltar`, () => {
      const criacao = criarArtefato(payload, 'M');
      expect(criacao.ok).toBe(true);
      if (!criacao.ok) return;

      const cena = construirCenaBasica(criacao.artefato, 50);
      const escala = escalaParaVerificacao(50, criacao.artefato.sizeComQuietZone, 8);

      expect(decodificadorJsQr.decodificar(rasterizarCena(cena, escala))).toBe(payload);
    });
  }
});
