import { SELO_PERMANENCIA } from '@/lib/site';

/**
 * Selo de permanência.
 *
 * O texto vem de `SELO_PERMANENCIA` e **nunca é reescrito** — determinação do
 * brand board, seção 09. Não existe prop de texto neste componente de
 * propósito: se o literal pudesse ser passado de fora, mais cedo ou mais tarde
 * alguém passaria outro.
 *
 * Aplicado no topo do app, no rodapé de exportação em PDF e em material impresso.
 */

export interface SeloPermanenciaProps {
  /** `escuro` inverte para uso sobre Carbon, como o board desenha no header escuro. */
  tom?: 'claro' | 'escuro';
  className?: string;
}

export function SeloPermanencia({ tom = 'claro', className }: SeloPermanenciaProps) {
  const cor = tom === 'escuro' ? 'text-white' : 'text-accent-text';

  return (
    <div className={`flex w-fit items-center gap-3 border border-ultramarine px-4 py-2 ${className ?? ''}`}>
      <span className="size-2 shrink-0 bg-ultramarine" aria-hidden="true" />
      <span className={`type-mono ${cor}`}>{SELO_PERMANENCIA}</span>
    </div>
  );
}
