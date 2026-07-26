import { useMemo } from 'react';
import { renderizarSvg } from '@/core/render/svg';
import type { Scene } from '@/core/scene/types';

/**
 * Prévia do código.
 *
 * Mostra exatamente o SVG que o usuário vai baixar — mesma função de
 * renderização, mesmo arquivo. Nada de um desenho "de tela" que diverge do
 * arquivo exportado.
 *
 * `dangerouslySetInnerHTML` porque o SVG é uma string que nós geramos: o texto
 * do usuário passa por `escaparXml` no renderizador, e não existe caminho para
 * marcação de terceiro entrar aqui. Um logo enviado pelo usuário entra como
 * `data:` URI num atributo `href`, também escapado.
 */

export interface PreviaProps {
  cena: Scene;
  /** Conteúdo codificado, para o texto alternativo. */
  descricao: string;
}

export function Previa({ cena, descricao }: PreviaProps) {
  const svg = useMemo(() => renderizarSvg(cena), [cena]);

  return (
    <div className="bg-surface flex justify-center p-7">
      <div
        className="border-hairline bg-white p-7"
        // O brief exige que o alternativo descreva o conteúdo codificado.
        role="img"
        aria-label={`QR Code que codifica: ${descricao}`}
      >
        <div
          className="w-[280px] max-w-full [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
