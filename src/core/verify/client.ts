import type { Bitmap } from '../render/raster';
import type { Scene } from '../scene/types';
import type { MargemDano } from './damage';
import type { PedidoVerificacao, RespostaVerificacao } from './protocol';
import { serializarCena } from './protocol';
import type { Veredicto } from './verify';

/**
 * Cliente do Worker de verificacao.
 *
 * Resolve dois problemas que a interface teria de qualquer jeito:
 *
 *   1. **Ultimo pedido vence.** Quem digita gera dezenas de pedidos; so o
 *      estado final interessa. Respostas de pedidos superados sao descartadas
 *      pelo id, e a promessa correspondente e resolvida como cancelada em vez
 *      de ficar pendente para sempre.
 *   2. **Debounce.** Sem ele, cada tecla enfileira uma verificacao completa.
 */

export interface ResultadoVerificacao {
  readonly veredicto: Veredicto;
  readonly margens: readonly MargemDano[] | null;
}

export interface OpcoesPedido {
  readonly imagens?: ReadonlyMap<string, Bitmap>;
  readonly medirDano?: boolean;
}

/** Sinaliza que um pedido foi substituido por outro mais recente. */
export class VerificacaoCancelada extends Error {
  constructor() {
    super('Verificação cancelada por um pedido mais recente.');
    this.name = 'VerificacaoCancelada';
  }
}

type Pendente = {
  resolver: (r: ResultadoVerificacao) => void;
  rejeitar: (e: Error) => void;
};

export interface ClienteVerificacao {
  verificar(cena: Scene, opcoes?: OpcoesPedido): Promise<ResultadoVerificacao>;
  encerrar(): void;
}

/** Cria o Worker. Isolado para que o teste possa injetar um duble. */
function criarWorkerPadrao(): Worker {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
}

export interface OpcoesCliente {
  readonly debounceMs?: number;
  readonly criarWorker?: () => Worker;
}

export const DEBOUNCE_PADRAO_MS = 120;

export function criarClienteVerificacao(opcoes: OpcoesCliente = {}): ClienteVerificacao {
  const debounceMs = opcoes.debounceMs ?? DEBOUNCE_PADRAO_MS;
  const worker = (opcoes.criarWorker ?? criarWorkerPadrao)();

  let proximoId = 0;
  const pendentes = new Map<number, Pendente>();
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  /**
   * Pedido que ainda esta no debounce e portanto nao chegou a `pendentes`.
   * Sem guarda-lo, substituir um pedido antes de ele ser enviado deixaria a
   * promessa correspondente pendente para sempre.
   */
  let agendado: Pendente | null = null;

  worker.addEventListener('message', (evento: MessageEvent<RespostaVerificacao>) => {
    const { id, veredicto, margens, erro } = evento.data;
    const pendente = pendentes.get(id);
    pendentes.delete(id);
    if (pendente === undefined) return;

    if (erro !== null || veredicto === null) {
      pendente.rejeitar(new Error(erro ?? 'Falha desconhecida na verificação.'));
      return;
    }
    pendente.resolver({ veredicto, margens });
  });

  function descartarAnteriores(): void {
    if (agendado !== null) {
      agendado.rejeitar(new VerificacaoCancelada());
      agendado = null;
    }
    for (const [, pendente] of pendentes) pendente.rejeitar(new VerificacaoCancelada());
    pendentes.clear();
  }

  return {
    verificar(cena, pedidoOpcoes = {}) {
      if (temporizador !== null) clearTimeout(temporizador);
      descartarAnteriores();

      return new Promise<ResultadoVerificacao>((resolver, rejeitar) => {
        agendado = { resolver, rejeitar };

        temporizador = setTimeout(() => {
          temporizador = null;
          agendado = null;
          const id = proximoId++;
          pendentes.set(id, { resolver, rejeitar });

          const pedido: PedidoVerificacao = {
            id,
            cena: serializarCena(cena),
            imagens: pedidoOpcoes.imagens === undefined ? undefined : [...pedidoOpcoes.imagens],
            medirDano: pedidoOpcoes.medirDano ?? false,
          };
          worker.postMessage(pedido);
        }, debounceMs);
      });
    },

    encerrar() {
      if (temporizador !== null) clearTimeout(temporizador);
      temporizador = null;
      descartarAnteriores();
      worker.terminate();
    },
  };
}
