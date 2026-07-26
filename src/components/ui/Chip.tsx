import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Chip selecionável — molduras, chamadas de ação e chips de exportação.
 *
 * `aria-pressed` em vez de só a classe: sem ele, um leitor de tela anuncia
 * apenas "botão" e o usuário não tem como saber qual moldura está ativa.
 */

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  ativo?: boolean;
  /** Selo à direita, como o "vetorial · imprimível" dos chips de exportação. */
  selo?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Chip({ ativo = false, selo, children, className, ...resto }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={[
        'type-mono inline-flex items-center gap-3 border px-4 py-3 transition-colors',
        ativo
          ? 'border-ultramarine bg-ultramarine text-white'
          : 'border-hairline bg-surface-card text-fg hover:border-fg',
        'disabled:border-hairline disabled:text-steel disabled:cursor-not-allowed',
        className ?? '',
      ].join(' ')}
      {...resto}
    >
      <span>{children}</span>
      {selo === undefined ? null : (
        <span
          className={`font-ui px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] uppercase ${
            ativo ? 'bg-white text-ultramarine-deep' : 'bg-surface text-fg-muted'
          }`}
        >
          {selo}
        </span>
      )}
    </button>
  );
}
