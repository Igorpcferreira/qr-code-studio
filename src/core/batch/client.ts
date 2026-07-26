import type { LinhaLote } from './csv';
import type { FormatoLote, ItemLote } from './lote';
import type { PedidoLote, RespostaLote } from './protocol';

/**
 * Cliente do Worker de lote.
 *
 * Mais simples que o de verificação: aqui não existe debounce nem
 * último-pedido-vence. O lote é uma operação explícita, disparada por clique,
 * e a interface bloqueia o botão enquanto ela roda — enfileirar dois lotes
 * seria confundir o usuário, não servi-lo.
 *
 * O worker é criado no momento do pedido e encerrado no fim. Um worker parado
 * segurando o resultado de um ZIP de mil arquivos guardaria dezenas de MB pelo
 * resto da sessão.
 */

export interface ResultadoLote {
  readonly zip: Uint8Array;
  readonly itens: readonly ItemLote[];
}

export interface OpcoesExecucao {
  readonly base: PedidoLote['base'];
  readonly linhas: readonly LinhaLote[];
  readonly formato: FormatoLote;
  readonly verificar: boolean;
  readonly aoProgredir?: (concluidas: number, total: number) => void;
  /** Isolado para que o teste possa injetar um dublê. */
  readonly criarWorker?: () => Worker;
}

function criarWorkerPadrao(): Worker {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
}

export function executarLote(opcoes: OpcoesExecucao): Promise<ResultadoLote> {
  const worker = (opcoes.criarWorker ?? criarWorkerPadrao)();

  return new Promise<ResultadoLote>((resolver, rejeitar) => {
    worker.addEventListener('message', (evento: MessageEvent<RespostaLote>) => {
      const resposta = evento.data;

      if (resposta.tipo === 'progresso') {
        opcoes.aoProgredir?.(resposta.concluidas, resposta.total);
        return;
      }

      worker.terminate();

      if (resposta.tipo === 'erro') rejeitar(new Error(resposta.mensagem));
      else resolver({ zip: resposta.zip, itens: resposta.itens });
    });

    worker.addEventListener('error', (evento) => {
      worker.terminate();
      rejeitar(new Error(evento.message));
    });

    const pedido: PedidoLote = {
      base: opcoes.base,
      linhas: opcoes.linhas,
      formato: opcoes.formato,
      verificar: opcoes.verificar,
    };
    worker.postMessage(pedido);
  });
}
