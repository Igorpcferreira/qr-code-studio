import { describe, expect, it } from 'vitest';
import {
  LIMIAR_CONTRASTE,
  avaliarContraste,
  formatarRazao,
  hexParaRgb,
  luminanciaRelativa,
  normalizarHex,
  razaoContraste,
} from '@/lib/contrast';

const CARBON = '#0E0F14';
const BRANCO = '#FFFFFF';
const STEEL = '#6E7280';
const ULTRAMARINE = '#2C36F0';

describe('normalizarHex', () => {
  it('aceita as formas validas', () => {
    expect(normalizarHex('#abc')).toBe('#aabbcc');
    expect(normalizarHex('abc')).toBe('#aabbcc');
    expect(normalizarHex('#AABBCC')).toBe('#aabbcc');
    expect(normalizarHex('  #0E0F14  ')).toBe('#0e0f14');
  });

  it('rejeita o resto', () => {
    for (const invalido of ['', '#', '#ab', '#abcd', '#abcde', '#gggggg', 'rgb(0,0,0)', '#1234567']) {
      expect(normalizarHex(invalido), invalido).toBeNull();
    }
  });
});

describe('hexParaRgb', () => {
  it('converte os canais', () => {
    expect(hexParaRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexParaRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexParaRgb('#2C36F0')).toEqual({ r: 44, g: 54, b: 240 });
  });

  it('devolve null para cor invalida', () => {
    expect(hexParaRgb('nao-e-cor')).toBeNull();
  });
});

describe('luminanciaRelativa', () => {
  it('ancora nos extremos definidos pela WCAG', () => {
    expect(luminanciaRelativa('#000000')).toBe(0);
    expect(luminanciaRelativa('#FFFFFF')).toBeCloseTo(1, 10);
  });

  it('cobre os dois ramos da curva de gama', () => {
    // Abaixo do ponto de quebra (0.03928) o canal e linear: (8/255)/12.92.
    expect(luminanciaRelativa('#080808')).toBeCloseTo(0.0024282, 6);
    // Acima dele vale a exponencial.
    expect(luminanciaRelativa('#808080')).toBeCloseTo(0.215861, 5);
  });

  it('pesa verde acima de vermelho e vermelho acima de azul', () => {
    expect(luminanciaRelativa('#00FF00')).toBeGreaterThan(luminanciaRelativa('#FF0000'));
    expect(luminanciaRelativa('#FF0000')).toBeGreaterThan(luminanciaRelativa('#0000FF'));
  });

  it('lanca em cor invalida em vez de devolver numero silenciosamente errado', () => {
    expect(() => luminanciaRelativa('#zz')).toThrow(TypeError);
  });
});

describe('razaoContraste', () => {
  it('vai de 1:1 a 21:1', () => {
    expect(razaoContraste(BRANCO, BRANCO)).toBe(1);
    expect(razaoContraste('#000000', '#FFFFFF')).toBeCloseTo(21, 10);
  });

  it('e simetrica', () => {
    expect(razaoContraste(CARBON, BRANCO)).toBeCloseTo(razaoContraste(BRANCO, CARBON), 12);
  });

  /**
   * O board anuncia "18,4 : 1" para Carbon sobre branco. Pela formula WCAG 2.x
   * o valor e 19,14 — o board esta errado por ~0,7, provavelmente por ter usado
   * luminancia sem correcao de gama. Para Ultramarine ele acerta (7,26 ~ 7,2).
   *
   * Fixamos os valores corretos: uma ferramenta cuja tese e honestidade tecnica
   * nao pode exibir um contraste que ela mesma calcularia diferente.
   */
  it('calcula os pares do brand board pela formula WCAG', () => {
    expect(razaoContraste(CARBON, BRANCO)).toBeCloseTo(19.14, 2);
    expect(razaoContraste(ULTRAMARINE, BRANCO)).toBeCloseTo(7.26, 2);
  });

  /**
   * Os dois pontos que a investigacao mediu com decodificador real. Ancorados
   * aqui para que a documentacao do produto cite numeros conferiveis.
   */
  it('ancora os pares medidos contra decodificador', () => {
    expect(razaoContraste('#6E7280', BRANCO)).toBeCloseTo(4.79, 2); // decodificou
    expect(razaoContraste('#B4B4B4', BRANCO)).toBeCloseTo(2.07, 2); // falhou
  });
});

describe('avaliarContraste', () => {
  it('aprova o par padrao', () => {
    const v = avaliarContraste(CARBON, BRANCO);
    expect(v.nivel).toBe('seguro');
    expect(v.polaridadeInvertida).toBe(false);
    expect(v.mensagem).toBeNull();
  });

  it('reprova abaixo do limiar com a mensagem do board', () => {
    const v = avaliarContraste('#BBBBBB', BRANCO);
    expect(v.nivel).toBe('insuficiente');
    expect(v.razao).toBeLessThan(LIMIAR_CONTRASTE);
    expect(v.mensagem).toContain('4:1');
  });

  it('trata o limiar como inclusivo', () => {
    // Par escolhido por ficar logo acima de 4:1.
    const v = avaliarContraste('#767676', BRANCO);
    expect(v.razao).toBeGreaterThanOrEqual(LIMIAR_CONTRASTE);
    expect(v.nivel).toBe('seguro');
  });

  /**
   * Trava que o brand board nao previu: inverter as duas cores mantem a razao
   * de contraste identica, entao so o numero jamais detectaria o problema — e
   * boa parte dos scanners recusa codigo invertido.
   */
  it('detecta polaridade invertida mesmo com contraste otimo', () => {
    const normal = avaliarContraste(CARBON, BRANCO);
    const invertido = avaliarContraste(BRANCO, CARBON);

    expect(invertido.razao).toBeCloseTo(normal.razao, 12);
    expect(invertido.polaridadeInvertida).toBe(true);
    expect(invertido.nivel).toBe('seguro'); // o numero passa...
    expect(invertido.mensagem).toContain('invertido'); // ...e ainda assim avisamos
  });

  it('a mensagem de polaridade tem prioridade sobre a de contraste', () => {
    const v = avaliarContraste('#FFFFFF', '#EEEEEE');
    expect(v.polaridadeInvertida).toBe(true);
    expect(v.nivel).toBe('insuficiente');
    expect(v.mensagem).toContain('invertido');
  });

  it('cores iguais nao contam como invertidas', () => {
    const v = avaliarContraste(STEEL, STEEL);
    expect(v.razao).toBe(1);
    expect(v.polaridadeInvertida).toBe(false);
    expect(v.nivel).toBe('insuficiente');
  });
});

describe('formatarRazao', () => {
  it('usa virgula decimal, como o board', () => {
    expect(formatarRazao(19.141)).toBe('19,1 : 1');
    expect(formatarRazao(2.07)).toBe('2,1 : 1');
    expect(formatarRazao(1)).toBe('1,0 : 1');
  });

  /**
   * `toFixed` arredonda o valor binario de verdade, e 2.05 e armazenado como
   * 2.0499999... — entao sai "2,0", nao "2,1". Registrado como comportamento
   * conhecido: e uma casa decimal num indicador, nao vale inventar aritmetica
   * decimal para corrigir.
   */
  it('arredonda pelo valor binario em empates', () => {
    expect(formatarRazao(2.05)).toBe('2,0 : 1');
  });
});
