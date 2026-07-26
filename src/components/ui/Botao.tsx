import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Botão nos quatro tipos e três estados do brand board, seção 08.
 *
 * O foco não é declarado aqui: `:focus-visible` global em `app/globals.css` já
 * aplica o contorno de 2 px em Ultramarine com deslocamento de 2 px em todo
 * elemento focável. Repetir por componente abriria espaço para divergência.
 */

export type TipoBotao = 'primario' | 'secundario' | 'fantasma' | 'destrutivo';

const BASE =
  'inline-flex items-center justify-center gap-2 font-ui text-sm font-semibold ' +
  'transition-colors disabled:cursor-not-allowed select-none';

const POR_TIPO: Readonly<Record<TipoBotao, string>> = {
  primario: [
    'bg-ultramarine text-white px-5 py-3.5',
    'hover:not-disabled:bg-ultramarine-deep',
    'disabled:bg-rule disabled:text-steel',
  ].join(' '),

  secundario: [
    'border border-fg text-fg px-5 py-3.5',
    'hover:not-disabled:bg-fg hover:not-disabled:text-surface-card',
    'disabled:border-hairline disabled:text-steel',
  ].join(' '),

  fantasma: [
    // `accent-link` e o Ultramarine ajustado por tema: o puro nao e legivel
    // como texto sobre Carbon.
    'text-accent-link px-5 py-3.5',
    'hover:not-disabled:text-ultramarine-deep hover:not-disabled:bg-surface hover:not-disabled:underline',
    'disabled:text-steel',
  ].join(' '),

  destrutivo: [
    'border border-error text-error px-5 py-3.5',
    'hover:not-disabled:bg-error hover:not-disabled:text-white',
    'disabled:border-hairline disabled:text-steel',
  ].join(' '),
};

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tipo?: TipoBotao;
  children: ReactNode;
}

export function Botao({ tipo = 'primario', className, children, type = 'button', ...resto }: BotaoProps) {
  return (
    <button type={type} className={`${BASE} ${POR_TIPO[tipo]} ${className ?? ''}`} {...resto}>
      {children}
    </button>
  );
}
