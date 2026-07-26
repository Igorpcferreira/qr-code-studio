'use client';

import type { ReactNode } from 'react';

/**
 * Controle segmentado — o seletor de correção de erro, de unidade e de DPI.
 *
 * Implementado como `radiogroup` com navegação por setas, não como fileira de
 * botões: um leitor de tela precisa anunciar "opção 4 de 4, selecionada", e o
 * teclado precisa percorrer as opções com as setas, sem tabular por todas.
 */

export interface OpcaoSegmentada<T extends string> {
  readonly valor: T;
  readonly rotulo: string;
  /** Lido por tecnologia assistiva quando o rótulo é curto demais ("L", "Q"). */
  readonly descricao?: string;
}

export interface ControleSegmentadoProps<T extends string> {
  legenda: string;
  opcoes: readonly OpcaoSegmentada<T>[];
  valor: T;
  onChange: (valor: T) => void;
  /** Nó livre à direita da legenda, para a legenda de trade-off do board. */
  apoio?: ReactNode;
  className?: string;
}

export function ControleSegmentado<T extends string>({
  legenda,
  opcoes,
  valor,
  onChange,
  apoio,
  className,
}: ControleSegmentadoProps<T>) {
  const indiceAtual = opcoes.findIndex((o) => o.valor === valor);

  function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>): void {
    const passo =
      evento.key === 'ArrowRight' || evento.key === 'ArrowDown'
        ? 1
        : evento.key === 'ArrowLeft' || evento.key === 'ArrowUp'
          ? -1
          : 0;
    if (passo === 0) return;

    evento.preventDefault();
    // Circular: da última volta para a primeira, como manda o padrão ARIA.
    const proximo = opcoes[(indiceAtual + passo + opcoes.length) % opcoes.length];
    if (proximo !== undefined) onChange(proximo.valor);
  }

  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ''}`}>
      <div className="flex items-baseline gap-3">
        <span className="type-caption" id={`legenda-${legenda}`}>
          {legenda}
        </span>
        {apoio}
      </div>

      <div
        role="radiogroup"
        aria-labelledby={`legenda-${legenda}`}
        onKeyDown={aoTeclar}
        className="flex w-fit border border-fg"
      >
        {opcoes.map((opcao, i) => {
          const ativo = opcao.valor === valor;
          return (
            <button
              key={opcao.valor}
              type="button"
              role="radio"
              aria-checked={ativo}
              /*
               * O rótulo visível vem primeiro no nome acessível. A WCAG 2.5.3
               * exige que o nome contenha o texto que está na tela: substituir
               * "URL" por "Endereço de site" faria comando de voz e leitor de
               * tela discordarem do que o usuário vê.
               */
              aria-label={opcao.descricao === undefined ? undefined : `${opcao.rotulo}, ${opcao.descricao}`}
              // Só a opção ativa entra na ordem de tabulação; as setas fazem o resto.
              tabIndex={ativo ? 0 : -1}
              onClick={() => onChange(opcao.valor)}
              className={[
                'type-mono px-5 py-2.5 transition-colors',
                i < opcoes.length - 1 ? 'border-r border-fg' : '',
                ativo ? 'bg-ultramarine font-medium text-white' : 'bg-surface-card text-fg hover:bg-surface',
              ].join(' ')}
            >
              {opcao.rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}
