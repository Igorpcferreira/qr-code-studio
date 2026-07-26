/**
 * Conjunto próprio de ícones.
 *
 * Nenhuma biblioteca pronta atende ao board: grade de 24, traço de 2 px, cantos
 * retos, construção ortogonal sem uma curva sequer. Os oito desenhos vêm
 * literalmente da seção 05 do brand board.
 *
 * Conjunto fechado e tipado: `NomeIcone` é uma união de string, então pedir um
 * ícone que não existe é erro de compilação, não caixa vazia em produção.
 */

export type NomeIcone =
  'baixar' | 'copiar' | 'vetor' | 'imprimir' | 'cor' | 'tamanho' | 'correcao' | 'cadeado';

/** `tracos` usam o traço de 2 px; `solidos` são preenchidos com a cor corrente. */
const DESENHOS: Readonly<Record<NomeIcone, { tracos: string[]; solidos?: string[] }>> = {
  baixar: { tracos: ['M12 3v12', 'M6 11l6 6 6-6', 'M4 20h16'] },
  copiar: { tracos: ['M4 4h11v11H4z', 'M9 9h11v11H9z'] },
  vetor: { tracos: ['M3 3h5v5H3z', 'M16 16h5v5h-5z', 'M8 5h8v11'] },
  imprimir: { tracos: ['M7 3h10v5H7z', 'M3 8h18v8h-4', 'M7 16h10v5H7z'] },
  cor: { tracos: ['M3 3h9v9H3z', 'M12 12h9v9h-9z'], solidos: ['M12 3h9v9h-9z', 'M3 12h9v9H3z'] },
  tamanho: { tracos: ['M3 3h7v7H3z', 'M13 13h8v8h-8z', 'M10 3h11v11'] },
  correcao: {
    tracos: ['M3 3h18v18H3z', 'M9 3v6h6'],
    solidos: ['M3 9h6v6H3z', 'M15 15h6v6h-6z'],
  },
  cadeado: { tracos: ['M4 11h16v10H4z', 'M8 11V6h8v5'], solidos: ['M11 15h2v3h-2z'] },
};

export interface IconeProps {
  nome: NomeIcone;
  /** Lado em pixels. O traço de 2 px é da grade de 24 e escala junto. */
  size?: number;
  /** Texto acessível. Ausente, o ícone é decorativo e sai da árvore. */
  title?: string;
  className?: string;
}

export function Icone({ nome, size = 24, title, className }: IconeProps) {
  const desenho = DESENHOS[nome];
  const acessivel = title !== undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={acessivel ? 'img' : undefined}
      aria-hidden={acessivel ? undefined : true}
      focusable="false"
    >
      {acessivel ? <title>{title}</title> : null}
      {desenho.tracos.map((d) => (
        <path key={d} d={d} />
      ))}
      {desenho.solidos?.map((d) => (
        <path key={d} d={d} fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

export const NOMES_ICONE = Object.keys(DESENHOS) as NomeIcone[];
