import type { Bitmap } from '../render/raster';
import type { Decodificador } from './decode';

/**
 * Teste de dano simulado.
 *
 * A verificacao basica responde sim ou nao. Esta responde **quanto** — aplica
 * degradacoes crescentes e reporta ate onde o codigo continua legivel. E a
 * diferenca entre "seu codigo funciona" e "seu codigo aguenta 22% de dano",
 * que e a informacao de que alguem imprimindo em etiqueta precisa.
 *
 * Toda aleatoriedade vem de um gerador com semente fixa: dois usuarios com a
 * mesma configuracao precisam ver o mesmo numero, e o teste precisa ser
 * reproduzivel.
 */

export type EixoDano = 'oclusao' | 'ruido' | 'borrao' | 'rotacao';

export interface MargemDano {
  readonly eixo: EixoDano;
  /** Maior intensidade em que o codigo ainda foi lido. */
  readonly tolerancia: number;
  readonly unidade: string;
  readonly descricao: string;
}

/** Congruencial linear: reprodutivel e suficiente para borrar um bitmap. */
function gerador(semente: number): () => number {
  let estado = semente >>> 0;
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 0x100000000;
  };
}

function clonar(b: Bitmap): Bitmap {
  return { data: new Uint8ClampedArray(b.data), width: b.width, height: b.height };
}

/** Cobre `fracao` da area com quadrados opacos espalhados. */
export function aplicarOclusao(origem: Bitmap, fracao: number, semente = 20260731): Bitmap {
  const alvo = clonar(origem);
  if (fracao <= 0) return alvo;

  const aleatorio = gerador(semente);
  const areaAlvo = origem.width * origem.height * fracao;
  const lado = Math.max(2, Math.round(Math.sqrt(areaAlvo / 24)));
  const quantidade = Math.max(1, Math.round(areaAlvo / (lado * lado)));

  for (let i = 0; i < quantidade; i++) {
    const x0 = Math.floor(aleatorio() * (origem.width - lado));
    const y0 = Math.floor(aleatorio() * (origem.height - lado));
    for (let y = y0; y < y0 + lado; y++) {
      for (let x = x0; x < x0 + lado; x++) {
        const j = (y * alvo.width + x) * 4;
        alvo.data[j] = 255;
        alvo.data[j + 1] = 255;
        alvo.data[j + 2] = 255;
      }
    }
  }
  return alvo;
}

/** Ruido uniforme de amplitude `sigma` em cada canal. */
export function aplicarRuido(origem: Bitmap, sigma: number, semente = 20260731): Bitmap {
  const alvo = clonar(origem);
  if (sigma <= 0) return alvo;

  const aleatorio = gerador(semente);
  for (let i = 0; i < alvo.data.length; i += 4) {
    const desvio = (aleatorio() - 0.5) * 2 * sigma;
    alvo.data[i] = (alvo.data[i] ?? 0) + desvio;
    alvo.data[i + 1] = (alvo.data[i + 1] ?? 0) + desvio;
    alvo.data[i + 2] = (alvo.data[i + 2] ?? 0) + desvio;
  }
  return alvo;
}

/** Media de caixa de raio `raio`, separada em duas passadas. */
export function aplicarBorrao(origem: Bitmap, raio: number): Bitmap {
  if (raio <= 0) return clonar(origem);

  const { width, height } = origem;
  const horizontal = new Uint8ClampedArray(origem.data.length);
  const final = new Uint8ClampedArray(origem.data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let soma = 0;
      let n = 0;
      for (let dx = -raio; dx <= raio; dx++) {
        const sx = x + dx;
        if (sx < 0 || sx >= width) continue;
        soma += origem.data[(y * width + sx) * 4] ?? 0;
        n++;
      }
      const media = soma / n;
      const i = (y * width + x) * 4;
      horizontal[i] = media;
      horizontal[i + 1] = media;
      horizontal[i + 2] = media;
      horizontal[i + 3] = 255;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let soma = 0;
      let n = 0;
      for (let dy = -raio; dy <= raio; dy++) {
        const sy = y + dy;
        if (sy < 0 || sy >= height) continue;
        soma += horizontal[(sy * width + x) * 4] ?? 0;
        n++;
      }
      const media = soma / n;
      const i = (y * width + x) * 4;
      final[i] = media;
      final[i + 1] = media;
      final[i + 2] = media;
      final[i + 3] = 255;
    }
  }

  return { data: final, width, height };
}

/** Gira `graus` em torno do centro, expandindo a tela e preenchendo de branco. */
export function aplicarRotacao(origem: Bitmap, graus: number): Bitmap {
  if (graus === 0) return clonar(origem);

  const radianos = (graus * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radianos));
  const sen = Math.abs(Math.sin(radianos));
  const width = Math.ceil(origem.width * cos + origem.height * sen);
  const height = Math.ceil(origem.width * sen + origem.height * cos);

  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const alvo: Bitmap = { data, width, height };

  const cx = width / 2;
  const cy = height / 2;
  const ox = origem.width / 2;
  const oy = origem.height / 2;
  const c = Math.cos(-radianos);
  const s = Math.sin(-radianos);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const sx = Math.round(dx * c - dy * s + ox);
      const sy = Math.round(dx * s + dy * c + oy);
      if (sx < 0 || sy < 0 || sx >= origem.width || sy >= origem.height) continue;

      const de = (sy * origem.width + sx) * 4;
      const para = (y * width + x) * 4;
      data[para] = origem.data[de] ?? 255;
      data[para + 1] = origem.data[de + 1] ?? 255;
      data[para + 2] = origem.data[de + 2] ?? 255;
      data[para + 3] = 255;
    }
  }

  return alvo;
}

interface Eixo {
  readonly eixo: EixoDano;
  readonly passos: readonly number[];
  readonly unidade: string;
  readonly aplicar: (b: Bitmap, intensidade: number) => Bitmap;
  readonly descrever: (tolerancia: number) => string;
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;

const EIXOS: readonly Eixo[] = [
  {
    eixo: 'oclusao',
    passos: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4],
    unidade: 'fração da área',
    aplicar: aplicarOclusao,
    descrever: (t) =>
      t === 0 ? 'Não tolera sujeira nem rasgo.' : `Lê com até ${pct(t)} da área danificada.`,
  },
  {
    eixo: 'ruido',
    passos: [16, 32, 48, 64, 80, 96],
    unidade: 'amplitude por canal',
    aplicar: aplicarRuido,
    descrever: (t) =>
      t === 0 ? 'Sensível a granulação.' : `Tolera impressão granulada até ±${t} por canal.`,
  },
  {
    eixo: 'borrao',
    passos: [1, 2, 3, 4, 5, 6],
    unidade: 'raio em pixels',
    aplicar: aplicarBorrao,
    descrever: (t) => (t === 0 ? 'Exige foco nítido.' : `Lê fora de foco até raio ${t}.`),
  },
  {
    eixo: 'rotacao',
    passos: [10, 20, 30, 45],
    unidade: 'graus',
    aplicar: aplicarRotacao,
    descrever: (t) => (t === 0 ? 'Exige alinhamento.' : `Lê inclinado até ${t}°.`),
  },
];

/**
 * Eixos do relatorio padrao.
 *
 * `rotacao` fica de fora: medido, ela satura em 45 graus nos quatro niveis de
 * correcao — o que era de se esperar, porque os tres padroes de localizacao
 * existem justamente para tornar o QR invariante a rotacao. Um numero que sai
 * igual para toda configuracao nao informa nada, so enche o relatorio. O eixo
 * continua disponivel para quem pedir explicitamente.
 */
export const EIXOS_PADRAO: readonly EixoDano[] = ['oclusao', 'ruido', 'borrao'];

export interface OpcoesDano {
  /** Limita quais eixos medir. Util para manter o CI rapido. */
  readonly eixos?: readonly EixoDano[];
}

/**
 * Mede, eixo a eixo, a maior degradacao que o codigo ainda suporta.
 *
 * Para no primeiro passo que falha: as degradacoes sao monotonicas, entao
 * insistir depois da primeira falha so gastaria tempo.
 */
export function medirMargemDeDano(
  bitmap: Bitmap,
  esperado: string,
  decodificador: Decodificador,
  opcoes: OpcoesDano = {},
): MargemDano[] {
  const selecionados = opcoes.eixos ?? EIXOS_PADRAO;

  return EIXOS.filter((e) => selecionados.includes(e.eixo)).map((eixo) => {
    let tolerancia = 0;

    for (const passo of eixo.passos) {
      if (decodificador.decodificar(eixo.aplicar(bitmap, passo)) !== esperado) break;
      tolerancia = passo;
    }

    return {
      eixo: eixo.eixo,
      tolerancia,
      unidade: eixo.unidade,
      descricao: eixo.descrever(tolerancia),
    };
  });
}
