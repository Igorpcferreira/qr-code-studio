'use client';

import { useSyncExternalStore } from 'react';
import type { Tema } from '@/lib/tema';
import { assinarTema, definirTema, lerTema } from '@/lib/tema';
import { ControleSegmentado } from '@/components/ui/ControleSegmentado';

/**
 * Seletor de tema.
 *
 * `useSyncExternalStore` e não `useState` + efeito: o tema já está aplicado no
 * DOM pelo script inline antes da hidratação, então o componente precisa ler o
 * estado de fora do React, não montar um segundo. É também o que evita o
 * `setState` dentro de efeito — que o ESLint do React 19 reprova — e o que faz
 * a marcação do servidor bater com a do cliente na primeira pintura.
 *
 * O instantâneo do servidor é `sistema` porque é o que a página pré-renderizada
 * de fato representa: sem `data-theme`, quem manda é o sistema operacional.
 */

const OPCOES = [
  { valor: 'claro', rotulo: 'Claro', descricao: 'Interface clara' },
  { valor: 'escuro', rotulo: 'Escuro', descricao: 'Interface escura' },
  { valor: 'sistema', rotulo: 'Sistema', descricao: 'Segue o sistema operacional' },
] as const satisfies readonly { valor: Tema; rotulo: string; descricao: string }[];

export function SeletorTema({ className }: { className?: string }) {
  const tema = useSyncExternalStore(assinarTema, lerTema, () => 'sistema' as Tema);

  return (
    <ControleSegmentado
      legenda="Tema"
      opcoes={OPCOES}
      valor={tema}
      onChange={definirTema}
      className={className}
    />
  );
}
