/**
 * Símbolo da marca.
 *
 * Três padrões de localização nas posições reais de um QR, com o canto inferior
 * direito deliberadamente vazio. O board é explícito: "O vazio é elemento de
 * marca. Espaço negativo com significado, não omissão."
 *
 * Geometria na proporção 7:5:3 do padrão de localização: cada localizador tem
 * 120 unidades, o anel 120/7 ≈ 17,143 e o núcleo 51,429.
 */

/** Ponto abaixo do qual o vão interno colapsa e o símbolo aberto vira borrão. */
export const LIMIAR_ICONE_CHEIO_PX = 16;

const LOCALIZADOR = 120;
const ANEL = LOCALIZADOR / 7; // 17.142857…
const NUCLEO = LOCALIZADOR - ANEL * 4; // 51.428571…
const ESPACO = 40;
const GRADE = LOCALIZADOR * 2 + ESPACO; // 280

const POSICOES = [
  [0, 0],
  [LOCALIZADOR + ESPACO, 0],
  [0, LOCALIZADOR + ESPACO],
] as const;

export type VarianteLogo = 'padrao' | 'mono-preto' | 'mono-branco' | 'app';

interface Paleta {
  /** Anel externo e núcleo. */
  readonly a: string;
  /** Anel do meio. */
  readonly b: string;
  /** Fundo cheio, só no ícone de aplicativo. */
  readonly fundo: string | null;
}

const PALETAS: Readonly<Record<VarianteLogo, Paleta>> = {
  padrao: { a: '#0E0F14', b: '#FFFFFF', fundo: null },
  'mono-preto': { a: '#0E0F14', b: '#FFFFFF', fundo: null },
  'mono-branco': { a: '#FFFFFF', b: '#0E0F14', fundo: null },
  app: { a: '#FFFFFF', b: '#2C36F0', fundo: '#2C36F0' },
};

/** Um localizador: anel externo, vão e núcleo — sempre três retângulos. */
function Localizador({ x, y, paleta }: { x: number; y: number; paleta: Paleta }) {
  return (
    <>
      <rect x={x} y={y} width={LOCALIZADOR} height={LOCALIZADOR} fill={paleta.a} />
      <rect
        x={x + ANEL}
        y={y + ANEL}
        width={LOCALIZADOR - ANEL * 2}
        height={LOCALIZADOR - ANEL * 2}
        fill={paleta.b}
      />
      <rect x={x + ANEL * 2} y={y + ANEL * 2} width={NUCLEO} height={NUCLEO} fill={paleta.a} />
    </>
  );
}

export interface LogoProps {
  /** Lado em pixels. Abaixo de 16 a variante troca sozinha. */
  size?: number;
  variant?: VarianteLogo;
  /** Texto acessível. Ausente, o símbolo é decorativo e sai da árvore. */
  title?: string;
  className?: string;
}

export function Logo({ size = 40, variant = 'padrao', title, className }: LogoProps) {
  /*
   * A regra de escala do board é implementada, não documentada: "Abaixo de
   * 16 px o vão interno colapsa: use o ícone de aplicativo cheio, nunca o
   * símbolo aberto." Num símbolo de 16 px o anel tem 0,98 px — some na
   * rasterização. O ícone cheio tem fundo sólido e sobrevive.
   */
  const efetiva: VarianteLogo = size < LIMIAR_ICONE_CHEIO_PX ? 'app' : variant;
  const paleta = PALETAS[efetiva];

  /* O ícone de aplicativo respira: a grade recua 40 unidades dentro do fundo. */
  const margem = paleta.fundo === null ? 0 : 40;
  const total = GRADE + margem * 2;

  const acessivel = title !== undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      className={className}
      role={acessivel ? 'img' : undefined}
      aria-hidden={acessivel ? undefined : true}
      focusable="false"
    >
      {acessivel ? <title>{title}</title> : null}
      {paleta.fundo === null ? null : <rect width={total} height={total} fill={paleta.fundo} />}
      {POSICOES.map(([x, y]) => (
        <Localizador key={`${x}-${y}`} x={x + margem} y={y + margem} paleta={paleta} />
      ))}
      {/* Canto inferior direito: vazio, intencionalmente. */}
    </svg>
  );
}
