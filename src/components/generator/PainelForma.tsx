'use client';

import { useMemo } from 'react';
import type { FormaModulo, MatrizModulos } from '@/core/render/formas';
import { FORMAS, caminhoDasPrimitivas, formaModulo, primitivasDoCodigo } from '@/core/render/formas';
import { Chip } from '@/components/ui/Chip';

/**
 * Escolha da forma dos módulos.
 *
 * O ícone de cada chip não é um desenho feito à mão: é a própria função de
 * geometria rodando sobre uma matriz de amostra. Escolher a forma pelo botão
 * errado seria fácil se o ícone fosse aproximado — aqui o que se vê no chip é,
 * literalmente, o que vai para o arquivo.
 */

/**
 * Matriz de amostra, 5 × 5.
 *
 * Desenhada para exercitar o que distingue as formas: corrida horizontal,
 * corrida vertical, cotovelo, cruzamento e módulo isolado. Numa amostra de
 * blocos soltos, `Circuito` e `Pontos` sairiam quase iguais.
 */
const AMOSTRA: readonly (readonly number[])[] = [
  [1, 1, 1, 0, 1],
  [0, 0, 1, 0, 0],
  [1, 1, 1, 1, 1],
  [1, 0, 1, 0, 0],
  [1, 0, 1, 1, 1],
];

const MATRIZ_AMOSTRA: MatrizModulos = {
  size: AMOSTRA.length,
  quietZone: 0,
  isDark: (x, y) => AMOSTRA[y]?.[x] === 1,
};

function IconeForma({ forma }: { forma: FormaModulo }) {
  const caminho = useMemo(
    () => caminhoDasPrimitivas(primitivasDoCodigo(MATRIZ_AMOSTRA, forma, { marcadores: false }), 'escuro'),
    [forma],
  );

  return (
    <svg viewBox="0 0 5 5" className="size-5 shrink-0" aria-hidden="true">
      <path d={caminho} fill="currentColor" />
    </svg>
  );
}

export interface PainelFormaProps {
  forma: FormaModulo;
  onForma: (forma: FormaModulo) => void;
}

export function PainelForma({ forma, onForma }: PainelFormaProps) {
  const definicao = formaModulo(forma);

  return (
    <div className="flex flex-col gap-2.5">
      <span className="type-caption">Forma dos módulos</span>

      <div className="flex flex-wrap gap-2.5">
        {FORMAS.map((f) => (
          <Chip key={f.id} ativo={f.id === forma} onClick={() => onForma(f.id)}>
            <span className="flex items-center gap-2.5">
              <IconeForma forma={f.id} />
              {f.nome}
            </span>
          </Chip>
        ))}
      </div>

      <p className="type-small text-fg-muted">{definicao.descricao}</p>

      {forma === 'quadrado' ? null : (
        <p className="type-small text-fg-muted">
          Os três marcadores de canto continuam sendo peça sólida em qualquer forma — é por eles que o scanner
          acha o código.{' '}
          <strong className="text-fg font-semibold">A verificação de leitura confirma abaixo</strong>, com o
          desenho exato que vai para o arquivo.
        </p>
      )}
    </div>
  );
}
