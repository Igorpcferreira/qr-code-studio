import type { QrArtifact } from '../qr/types';
import type { Paint, Scene } from '../scene/types';

/**
 * Molduras.
 *
 * Cada uma é uma função pura `(OpcoesMoldura) => Scene`. Escrita uma vez,
 * renderizada em SVG, PNG e PDF pelos três renderers sem que nenhuma delas
 * saiba que formato existe do outro lado.
 *
 * Diferença em relação ao plano: são três arquivos (`tipos`, `comum`,
 * `molduras`) em vez de catorze. Um arquivo por moldura duplicaria os mesmos
 * cinco auxiliares de layout catorze vezes, e o que separa uma moldura da outra
 * cabe em vinte linhas.
 */

/** Máximo de caracteres da chamada de ação. Regra do brand board. */
export const MAX_CHAMADA = 24;

export type IdMoldura =
  // As oito do board
  | 'nenhuma'
  | 'inferior'
  | 'superior'
  | 'contorno'
  | 'cantoneiras'
  | 'placa'
  | 'vertical'
  | 'fundo-escuro'
  // As seis acrescentadas nesta fase
  | 'hangtag'
  | 'grade'
  | 'cartao'
  | 'mesa'
  | 'cartaz'
  | 'faixa';

export interface OpcoesMoldura {
  readonly artefato: QrArtifact;
  /** Lado do código, com quiet zone, em milímetros. */
  readonly ladoCodigoMm: number;
  readonly dark: Paint;
  readonly light: Paint;
  /** Cor da moldura: Carbon, Ultramarine ou Steel, conforme o board. */
  readonly corMoldura: Paint;
  /** Chamada de ação. Impressa, nunca codificada. */
  readonly chamada: string;
  readonly logo: { readonly href: string; readonly ladoMm: number } | null;
  /** Imprime a ficha técnica no rodapé, onde a moldura comporta. */
  readonly incluirFicha: boolean;
  /** Só para a moldura em grade. */
  readonly grade?: { readonly colunas: number; readonly linhas: number };
  /** Título e subtítulo, só para a moldura de cartaz. */
  readonly titulo?: string;
  readonly subtitulo?: string;
}

export interface DefinicaoMoldura {
  readonly id: IdMoldura;
  readonly nome: string;
  readonly descricao: string;
  /** A moldura imprime a chamada de ação? */
  readonly usaChamada: boolean;
  readonly compor: (opcoes: OpcoesMoldura) => Scene;
}

/**
 * Normaliza a chamada de ação: caixa alta e no máximo 24 caracteres.
 *
 * Truncar em vez de recusar porque isto roda enquanto o usuário digita; o campo
 * simplesmente para de aceitar, sem mensagem de erro por caractere.
 */
export function normalizarChamada(bruto: string): string {
  return bruto.toLocaleUpperCase('pt-BR').slice(0, MAX_CHAMADA).trim();
}
