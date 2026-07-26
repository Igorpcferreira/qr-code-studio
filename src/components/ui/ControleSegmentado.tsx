'use client';

import { useId } from 'react';
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
  /**
   * `grade` para conjuntos que não cabem numa linha — os nove tipos de
   * conteúdo. É só disposição: a semântica de `radiogroup` e a navegação por
   * setas continuam idênticas, que é o motivo de não existir um segundo
   * componente para isso.
   */
  layout?: 'linha' | 'grade';
  className?: string;
}

export function ControleSegmentado<T extends string>({
  legenda,
  opcoes,
  valor,
  onChange,
  apoio,
  layout = 'linha',
  className,
}: ControleSegmentadoProps<T>) {
  const indiceAtual = opcoes.findIndex((o) => o.valor === valor);
  const grade = layout === 'grade';

  /*
   * `useId` e não um identificador derivado da legenda: "Tipo de conteúdo" tem
   * espaço, e `aria-labelledby` trata espaço como separador de referências.
   * Uma legenda de três palavras viraria três ids inexistentes e o grupo
   * ficaria sem nome acessível.
   */
  const idLegenda = useId();

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
        <span className="type-caption" id={idLegenda}>
          {legenda}
        </span>
        {apoio}
      </div>

      <div
        role="radiogroup"
        aria-labelledby={idLegenda}
        onKeyDown={aoTeclar}
        className={grade ? 'grid grid-cols-2 gap-2.5 sm:grid-cols-3' : 'flex w-fit border border-fg'}
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
               *
               * Na grade a descrição já está impressa dentro do botão, então
               * repeti-la em `aria-label` seria anunciá-la duas vezes.
               */
              aria-label={
                grade || opcao.descricao === undefined ? undefined : `${opcao.rotulo}, ${opcao.descricao}`
              }
              // Só a opção ativa entra na ordem de tabulação; as setas fazem o resto.
              tabIndex={ativo ? 0 : -1}
              onClick={() => onChange(opcao.valor)}
              className={
                grade
                  ? [
                      'flex flex-col items-start gap-1 border px-4 py-3 text-left transition-colors',
                      ativo
                        ? 'border-ultramarine bg-ultramarine text-white'
                        : 'border-hairline bg-surface-card text-fg hover:border-fg',
                    ].join(' ')
                  : [
                      'type-mono px-5 py-2.5 transition-colors',
                      i < opcoes.length - 1 ? 'border-r border-fg' : '',
                      ativo
                        ? 'bg-ultramarine font-medium text-white'
                        : 'bg-surface-card text-fg hover:bg-surface',
                    ].join(' ')
              }
            >
              <span className="type-mono">{opcao.rotulo}</span>
              {grade && opcao.descricao !== undefined ? (
                <span className={`type-small ${ativo ? 'text-white/80' : 'text-fg-muted'}`}>
                  {opcao.descricao}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
