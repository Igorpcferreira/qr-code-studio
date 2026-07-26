import { describe, expect, it, vi } from 'vitest';
import { criarArtefato } from '@/core/qr/create';
import { construirCenaBasica } from '@/core/scene/build';
import type { Scene } from '@/core/scene/types';
import { VerificacaoCancelada, criarClienteVerificacao } from '@/core/verify/client';
import type { PedidoVerificacao, RespostaVerificacao } from '@/core/verify/protocol';
import { reidratarCena, serializarCena } from '@/core/verify/protocol';
import { verificarLeitura } from '@/core/verify/verify';

function cena(conteudo = 'https://arquivo.gov.br/registro/8841'): Scene {
  const r = criarArtefato(conteudo, 'H');
  if (!r.ok) throw new Error('esperava sucesso');
  return construirCenaBasica(r.artefato, 40);
}

/**
 * Duble de Worker que responde de verdade — roda a mesma verificacao, apenas
 * na thread do teste. Assim o teste exercita o protocolo completo, incluindo a
 * serializacao e a reidratacao do artefato.
 */
class WorkerFalso implements Pick<Worker, 'addEventListener' | 'postMessage' | 'terminate'> {
  private ouvintes: ((e: MessageEvent<RespostaVerificacao>) => void)[] = [];
  encerrado = false;
  recebidos: PedidoVerificacao[] = [];

  addEventListener(_tipo: string, ouvinte: EventListenerOrEventListenerObject): void {
    this.ouvintes.push(ouvinte as (e: MessageEvent<RespostaVerificacao>) => void);
  }

  postMessage(pedido: PedidoVerificacao): void {
    this.recebidos.push(pedido);
    const veredicto = verificarLeitura(reidratarCena(pedido.cena));
    const resposta: RespostaVerificacao = { id: pedido.id, veredicto, margens: null, erro: null };
    queueMicrotask(() => {
      for (const ouvinte of this.ouvintes) ouvinte({ data: resposta } as MessageEvent<RespostaVerificacao>);
    });
  }

  terminate(): void {
    this.encerrado = true;
  }
}

function clienteComDuble(debounceMs = 0) {
  const falso = new WorkerFalso();
  const cliente = criarClienteVerificacao({
    debounceMs,
    criarWorker: () => falso as unknown as Worker,
  });
  return { cliente, falso };
}

describe('serializacao da cena', () => {
  /**
   * Clonagem estruturada descarta funcoes, e `QrArtifact` carrega `isDark`.
   * Sem a reidratacao, o worker receberia um artefato mudo.
   */
  it('sobrevive a ida e volta preservando o comportamento da matriz', () => {
    const original = cena();
    const voltou = reidratarCena(serializarCena(original));

    const a = original.nodes.find((n) => n.kind === 'qr');
    const b = voltou.nodes.find((n) => n.kind === 'qr');
    if (a?.kind !== 'qr' || b?.kind !== 'qr') throw new Error('sem no de codigo');

    expect(b.artifact.size).toBe(a.artifact.size);
    for (let y = 0; y < a.artifact.size; y++) {
      for (let x = 0; x < a.artifact.size; x++) {
        expect(b.artifact.isDark(x, y)).toBe(a.artifact.isDark(x, y));
      }
    }
  });

  it('a cena serializada sobrevive a um round-trip JSON', () => {
    const serializada = serializarCena(cena());
    const viaJson = JSON.parse(JSON.stringify(serializada)) as typeof serializada;
    // `data` vira objeto ao passar por JSON; a clonagem estruturada real
    // preserva o Uint8Array. Aqui basta garantir que nada mais se perdeu.
    expect(Object.keys(viaJson)).toEqual(Object.keys(serializada));
  });
});

describe('cliente de verificacao', () => {
  it('devolve o veredicto do worker', async () => {
    const { cliente, falso } = clienteComDuble();
    const resultado = await cliente.verificar(cena());

    expect(resultado.veredicto.ok).toBe(true);
    expect(falso.recebidos).toHaveLength(1);
    cliente.encerrar();
  });

  /**
   * Quem digita gera dezenas de pedidos. Sem o debounce, cada tecla enfileira
   * uma verificacao completa.
   */
  it('agrupa pedidos rapidos num so envio', async () => {
    vi.useFakeTimers();
    const { cliente, falso } = clienteComDuble(120);

    const primeira = cliente.verificar(cena('a'));
    const segunda = cliente.verificar(cena('b'));
    const terceira = cliente.verificar(cena('c'));

    const cancelamentos = [
      expect(primeira).rejects.toBeInstanceOf(VerificacaoCancelada),
      expect(segunda).rejects.toBeInstanceOf(VerificacaoCancelada),
    ];

    await vi.advanceTimersByTimeAsync(200);
    vi.useRealTimers();

    await Promise.all(cancelamentos);
    await expect(terceira).resolves.toMatchObject({ veredicto: { ok: true } });
    expect(falso.recebidos, 'so o ultimo pedido chega ao worker').toHaveLength(1);

    cliente.encerrar();
  });

  /**
   * O bug que este teste existe para impedir: um pedido substituido enquanto
   * ainda estava no debounce nunca chegava a `pendentes`, e sua promessa ficava
   * pendente para sempre.
   */
  it('rejeita pedido substituido antes mesmo de ser enviado', async () => {
    const { cliente } = clienteComDuble(50);

    const abandonada = cliente.verificar(cena('a'));
    const vencedora = cliente.verificar(cena('b'));

    await expect(abandonada).rejects.toBeInstanceOf(VerificacaoCancelada);
    await expect(vencedora).resolves.toMatchObject({ veredicto: { ok: true } });

    cliente.encerrar();
  });

  it('encerrar cancela o que estiver em voo e derruba o worker', async () => {
    const { cliente, falso } = clienteComDuble(50);
    const pendente = cliente.verificar(cena());

    cliente.encerrar();

    await expect(pendente).rejects.toBeInstanceOf(VerificacaoCancelada);
    expect(falso.encerrado).toBe(true);
    expect(falso.recebidos).toHaveLength(0);
  });

  it('propaga erro do worker como rejeicao', async () => {
    const falso = new WorkerFalso();
    falso.postMessage = function (pedido: PedidoVerificacao) {
      const resposta: RespostaVerificacao = {
        id: pedido.id,
        veredicto: null,
        margens: null,
        erro: 'estourou',
      };
      queueMicrotask(() => {
        for (const o of (this as unknown as { ouvintes: ((e: MessageEvent) => void)[] }).ouvintes) {
          o({ data: resposta } as MessageEvent);
        }
      });
    };

    const cliente = criarClienteVerificacao({ debounceMs: 0, criarWorker: () => falso as unknown as Worker });
    await expect(cliente.verificar(cena())).rejects.toThrow('estourou');
    cliente.encerrar();
  });
});
