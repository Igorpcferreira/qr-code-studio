import type { ReactNode } from 'react';

/**
 * Caixa de aviso nos três estados do board.
 *
 * `atencao` e `erro` recebem `role="alert"`: são o canal por onde o produto
 * conta que o código pode falhar, e essa informação não pode depender de o
 * usuário estar olhando para o lugar certo da tela.
 */

export type TomAviso = 'sucesso' | 'atencao' | 'erro';

const CORES: Readonly<Record<TomAviso, { borda: string; ponto: string }>> = {
  sucesso: { borda: 'border-success', ponto: 'bg-success' },
  atencao: { borda: 'border-warning', ponto: 'bg-warning' },
  erro: { borda: 'border-error', ponto: 'bg-error' },
};

export interface AvisoProps {
  tom: TomAviso;
  titulo?: string;
  children: ReactNode;
  className?: string;
}

export function Aviso({ tom, titulo, children, className }: AvisoProps) {
  const { borda, ponto } = CORES[tom];

  return (
    <div
      role={tom === 'sucesso' ? 'status' : 'alert'}
      className={`bg-surface-card flex items-start gap-3 border p-4 ${borda} ${className ?? ''}`}
    >
      <span className={`mt-1.5 size-2 shrink-0 ${ponto}`} aria-hidden="true" />
      <div className="flex flex-col gap-1">
        {titulo === undefined ? null : <p className="type-small text-fg font-semibold">{titulo}</p>}
        <div className="type-small text-fg-muted">{children}</div>
      </div>
    </div>
  );
}
