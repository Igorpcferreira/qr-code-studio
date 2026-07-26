'use client';

import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

/**
 * Campo de texto com os três estados do board: vazio, válido e inválido.
 *
 * A mensagem de ajuda é ligada ao input por `aria-describedby` e a de erro
 * também recebe `role="alert"` — o brief exige as duas coisas, e sem elas quem
 * usa leitor de tela descobre o erro só ao tentar enviar.
 */

export type EstadoCampo = 'neutro' | 'valido' | 'invalido';

export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  rotulo: string;
  estado?: EstadoCampo;
  /** Texto de apoio, ou a mensagem de erro quando `estado` é `invalido`. */
  ajuda?: string;
  /** Marcador à direita da ajuda, como a contagem de bytes do board. */
  medida?: ReactNode;
  className?: string;
}

const BORDA: Readonly<Record<EstadoCampo, string>> = {
  neutro: 'border-hairline',
  valido: 'border-ultramarine shadow-ring',
  invalido: 'border-error',
};

const COR_AJUDA: Readonly<Record<EstadoCampo, string>> = {
  neutro: 'text-fg-muted',
  valido: 'text-success',
  invalido: 'text-error',
};

export function Campo({ rotulo, estado = 'neutro', ajuda, medida, className, ...resto }: CampoProps) {
  const id = useId();
  const idAjuda = `${id}-ajuda`;

  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ''}`}>
      <label className="type-caption" htmlFor={id}>
        {rotulo}
      </label>

      <input
        id={id}
        // Sem a ligação, a ajuda é texto solto que o leitor de tela não associa.
        aria-describedby={ajuda === undefined ? undefined : idAjuda}
        aria-invalid={estado === 'invalido' ? true : undefined}
        className={`font-data bg-surface-card text-fg placeholder:text-steel border px-5 py-4 text-[15px] outline-none ${BORDA[estado]}`}
        {...resto}
      />

      {ajuda === undefined ? null : (
        <div className="flex items-center gap-2">
          {estado === 'neutro' ? null : (
            <span
              className={`size-2 shrink-0 ${estado === 'valido' ? 'bg-success' : 'bg-error'}`}
              aria-hidden="true"
            />
          )}
          <p
            id={idAjuda}
            // `alert` só no erro: anunciar a ajuda neutra a cada tecla seria ruído.
            role={estado === 'invalido' ? 'alert' : undefined}
            className={`type-small ${COR_AJUDA[estado]}`}
          >
            {ajuda}
          </p>
          {medida === undefined ? null : <span className="type-mono text-fg-muted ml-auto">{medida}</span>}
        </div>
      )}
    </div>
  );
}
