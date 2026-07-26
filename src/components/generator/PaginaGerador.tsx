import { Cabecalho } from '@/components/Cabecalho';
import { Rodape } from '@/components/Rodape';
import { Gerador } from './Gerador';

/**
 * Casca compartilhada pela home e pelas landings por tipo de conteúdo.
 *
 * As landings existem por busca orgânica — quem procura "gerador de qr code de
 * url" precisa cair numa página que fala disso — mas todas entregam o mesmo
 * gerador. Duplicar a interface por rota só criaria versões que divergem.
 */

export interface PaginaGeradorProps {
  titulo: string;
  subtitulo: string;
}

export function PaginaGerador({ titulo, subtitulo }: PaginaGeradorProps) {
  return (
    <>
      {/* Primeira parada do teclado: pular a navegação e ir direto ao gerador. */}
      <a
        href="#gerador"
        className="bg-ultramarine sr-only px-5 py-3.5 font-semibold text-white focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Pular para o gerador
      </a>

      <Cabecalho />

      <main id="gerador" className="mx-auto max-w-[1200px] px-8 py-14">
        <h1 className="type-display mb-4 max-w-[900px]">{titulo}</h1>
        <p className="type-body text-fg-muted mb-12 max-w-[70ch]">{subtitulo}</p>

        <Gerador />
      </main>

      <Rodape />
    </>
  );
}
