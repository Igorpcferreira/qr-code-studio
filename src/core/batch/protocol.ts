import type { EstadoGerador } from '@/state/reducer';
import type { LinhaLote } from './csv';
import type { FormatoLote, ItemLote } from './lote';

/**
 * Protocolo entre a interface e o Worker de lote.
 *
 * Diferente do protocolo de verificação, aqui nada precisa ser desidratado: o
 * `EstadoGerador` é um objeto de configuração de valores simples, e as linhas
 * do CSV são strings. O worker reconstrói a cadeia inteira do zero para cada
 * linha, que é o que permite mandar mil linhas num `postMessage` só.
 */

export interface PedidoLote {
  readonly base: EstadoGerador;
  readonly linhas: readonly LinhaLote[];
  readonly formato: FormatoLote;
  readonly verificar: boolean;
}

export type RespostaLote =
  /** Emitida a cada linha concluída, para a barra de progresso. */
  | { readonly tipo: 'progresso'; readonly concluidas: number; readonly total: number }
  | {
      readonly tipo: 'pronto';
      /** ZIP montado, pronto para virar Blob. */
      readonly zip: Uint8Array;
      readonly itens: readonly ItemLote[];
    }
  | { readonly tipo: 'erro'; readonly mensagem: string };
