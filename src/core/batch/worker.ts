/// <reference lib="webworker" />

import { gerarItem } from './lote';
import type { ItemLote } from './lote';
import type { PedidoLote, RespostaLote } from './protocol';
import { criarZip } from './zip';
import type { EntradaZip } from './zip';

/**
 * Worker de lote.
 *
 * Mil peças significam mil composições, mil rasterizações e mil decodificações
 * de conferência. Na thread principal a página congelaria por dezenas de
 * segundos; aqui a interface continua respondendo e mostra progresso real.
 *
 * O progresso é emitido em blocos e não linha a linha: um `postMessage` por
 * linha faria a fila de mensagens custar mais que o trabalho útil num CSV
 * grande.
 */

const PASSO_PROGRESSO = 10;

self.addEventListener('message', (evento: MessageEvent<PedidoLote>) => {
  const pedido = evento.data;

  void (async () => {
    try {
      const itens: ItemLote[] = [];
      const entradas: EntradaZip[] = [];

      for (const [indice, linha] of pedido.linhas.entries()) {
        const { item, entrada } = await gerarItem(linha, {
          base: pedido.base,
          formato: pedido.formato,
          verificar: pedido.verificar,
        });

        itens.push(item);
        if (entrada !== null) entradas.push(entrada);

        if ((indice + 1) % PASSO_PROGRESSO === 0) {
          const progresso: RespostaLote = {
            tipo: 'progresso',
            concluidas: indice + 1,
            total: pedido.linhas.length,
          };
          self.postMessage(progresso);
        }
      }

      const zip = await criarZip(entradas);
      const pronto: RespostaLote = { tipo: 'pronto', zip, itens };
      self.postMessage(pronto);
    } catch (causa) {
      const erro: RespostaLote = {
        tipo: 'erro',
        mensagem: causa instanceof Error ? causa.message : String(causa),
      };
      self.postMessage(erro);
    }
  })();
});
