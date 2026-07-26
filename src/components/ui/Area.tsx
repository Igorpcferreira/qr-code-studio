'use client';

import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';

/**
 * Campo de texto de várias linhas.
 *
 * Gêmeo do `Campo`, com a mesma moldura e a mesma ligação de ajuda por
 * `aria-describedby`. Existe porque corpo de e-mail e observação de contato são
 * conteúdos com quebra de linha, e forçá-los num `<input>` esconde do usuário
 * exatamente o que ele está codificando.
 */

export interface AreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  rotulo: string;
  ajuda?: string;
  className?: string;
}

export function Area({ rotulo, ajuda, className, rows = 3, ...resto }: AreaProps) {
  const id = useId();
  const idAjuda = `${id}-ajuda`;

  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ''}`}>
      <label className="type-caption" htmlFor={id}>
        {rotulo}
      </label>

      <textarea
        id={id}
        rows={rows}
        aria-describedby={ajuda === undefined ? undefined : idAjuda}
        className="font-data border-hairline bg-surface-card text-fg placeholder:text-steel resize-y border px-5 py-4 text-[15px] outline-none"
        {...resto}
      />

      {ajuda === undefined ? null : (
        <p id={idAjuda} className="type-small text-fg-muted">
          {ajuda}
        </p>
      )}
    </div>
  );
}
