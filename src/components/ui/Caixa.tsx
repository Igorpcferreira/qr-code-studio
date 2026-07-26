'use client';

import { useId } from 'react';

/**
 * Caixa de marcação — as opções de PDF do board (marcas de corte, sangria,
 * ficha no rodapé).
 *
 * O quadrado desenhado é decorativo; quem carrega o estado é um `<input
 * type="checkbox">` de verdade, apenas visualmente escondido. Trocar o input
 * nativo por uma `<div>` com `role` custaria a semântica de formulário, o
 * suporte a teclado e o comportamento de leitor de tela — tudo para desenhar um
 * quadrado que o CSS desenha de qualquer jeito.
 */

export interface CaixaProps {
  rotulo: string;
  descricao?: string;
  marcada: boolean;
  onChange: (marcada: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Caixa({ rotulo, descricao, marcada, onChange, disabled, className }: CaixaProps) {
  const id = useId();
  const idDescricao = `${id}-desc`;

  return (
    <label
      htmlFor={id}
      className={`bg-surface-card flex cursor-pointer items-center gap-4 p-4 has-disabled:cursor-not-allowed ${className ?? ''}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={marcada}
        disabled={disabled}
        aria-describedby={descricao === undefined ? undefined : idDescricao}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />

      <span
        aria-hidden="true"
        className={`size-[18px] shrink-0 border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ultramarine ${
          marcada
            ? 'border-ultramarine bg-ultramarine shadow-[inset_0_0_0_3px_var(--color-white)]'
            : 'border-steel bg-surface-card'
        }`}
      />

      <span className="flex flex-col gap-0.5">
        <span className="type-small text-fg font-semibold">{rotulo}</span>
        {descricao === undefined ? null : (
          <span id={idDescricao} className="type-small text-fg-muted">
            {descricao}
          </span>
        )}
      </span>

      <span className="type-mono text-ultramarine ml-auto">{marcada ? 'ATIVO' : '—'}</span>
    </label>
  );
}
