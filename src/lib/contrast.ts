/**
 * Contraste entre o modulo escuro e o modulo claro.
 *
 * Nota de honestidade tecnica, que a interface tambem exibe: scanners nao usam a
 * razao WCAG, e sim diferenca de refletancia (ISO/IEC 15415). A razao WCAG e um
 * proxy — bom, mas proxy.
 *
 * Os dois pontos medidos nesta refatoracao sao coerentes com o limiar de 4:1 do
 * board: #6E7280 sobre branco (4,79:1) decodificou, e #B4B4B4 sobre branco
 * (2,07:1) falhou. Nao ha aqui evidencia de que o limiar seja conservador
 * demais; ha evidencia de que ele separa os casos que testamos.
 *
 * Quem da o veredito final e a verificacao de leitura real (`/core/verify`),
 * porque contraste nao e a unica causa de falha — logo, moldura e densidade de
 * modulo tambem derrubam a leitura sem mexer na razao.
 */

/** Limiar do brand board: abaixo disso, avisar que pode falhar em scanners. */
export const LIMIAR_CONTRASTE = 4;

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Aceita `#abc`, `#aabbcc` e as mesmas formas sem `#`. Devolve null se invalido. */
export function normalizarHex(entrada: string): string | null {
  const bruto = entrada.trim().replace(/^#/, '').toLowerCase();

  if (/^[0-9a-f]{3}$/.test(bruto)) {
    const [r, g, b] = [bruto[0], bruto[1], bruto[2]];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^[0-9a-f]{6}$/.test(bruto)) {
    return `#${bruto}`;
  }
  return null;
}

export function hexParaRgb(hex: string): Rgb | null {
  const normalizado = normalizarHex(hex);
  if (normalizado === null) return null;
  return {
    r: Number.parseInt(normalizado.slice(1, 3), 16),
    g: Number.parseInt(normalizado.slice(3, 5), 16),
    b: Number.parseInt(normalizado.slice(5, 7), 16),
  };
}

/** Luminancia relativa WCAG 2.x. Devolve 0 (preto) a 1 (branco). */
export function luminanciaRelativa(hex: string): number {
  const rgb = hexParaRgb(hex);
  if (rgb === null) {
    throw new TypeError(`Cor invalida: ${hex}`);
  }
  const canal = (valor: number): number => {
    const s = valor / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(rgb.r) + 0.7152 * canal(rgb.g) + 0.0722 * canal(rgb.b);
}

/** Razao de contraste WCAG entre duas cores. Vai de 1:1 a 21:1, simetrica. */
export function razaoContraste(a: string, b: string): number {
  const la = luminanciaRelativa(a);
  const lb = luminanciaRelativa(b);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return (claro + 0.05) / (escuro + 0.05);
}

export type NivelContraste = 'seguro' | 'insuficiente';

export interface VeredictoContraste {
  readonly razao: number;
  readonly nivel: NivelContraste;
  /**
   * O "modulo escuro" ficou mais claro que o "modulo claro".
   *
   * Trava que o brand board nao previu: muitos scanners recusam codigo
   * invertido, e a razao de contraste sozinha nao detecta isso — inverter duas
   * cores mantem a razao intacta.
   */
  readonly polaridadeInvertida: boolean;
  readonly mensagem: string | null;
}

export function avaliarContraste(moduloEscuro: string, moduloClaro: string): VeredictoContraste {
  const razao = razaoContraste(moduloEscuro, moduloClaro);
  const polaridadeInvertida = luminanciaRelativa(moduloEscuro) > luminanciaRelativa(moduloClaro);
  const nivel: NivelContraste = razao >= LIMIAR_CONTRASTE ? 'seguro' : 'insuficiente';

  let mensagem: string | null = null;
  if (polaridadeInvertida) {
    mensagem = 'O módulo escuro está mais claro que o fundo. Muitos scanners recusam código invertido.';
  } else if (nivel === 'insuficiente') {
    mensagem = 'Abaixo de 4:1 o código pode falhar em scanners. Escureça o módulo escuro.';
  }

  return { razao, nivel, polaridadeInvertida, mensagem };
}

/** Formata a razao como o board mostra: "18,4 : 1". */
export function formatarRazao(razao: number): string {
  return `${razao.toFixed(1).replace('.', ',')} : 1`;
}
