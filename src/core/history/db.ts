import type { RegistroHistorico } from './registro';
import { MAX_REGISTROS, podar } from './registro';

/**
 * Persistência do histórico.
 *
 * IndexedDB e não `localStorage`, pela razão que o roadmap já registrava: uma
 * configuração com logo embutido é um `data:` URI de centenas de KB, e o teto
 * de 5 MB do `localStorage` estoura em poucas entradas. IndexedDB também
 * guarda objetos sem serializar à mão, o que evita um `JSON.parse` de dado
 * antigo com formato diferente.
 *
 * O histórico **nunca sai do navegador** — o que, de quebra, torna esta camada
 * mais simples do que seria: não existe sincronização, conflito nem migração
 * entre dispositivos a resolver.
 *
 * Este arquivo é o único do módulo que depende do navegador; identidade,
 * rótulo e poda ficam em `registro.ts`, testáveis no Node.
 */

const BANCO = 'qr-code-studio';
const DEPOSITO = 'historico';
const VERSAO = 1;

export interface Historico {
  listar(): Promise<readonly RegistroHistorico[]>;
  salvar(registro: RegistroHistorico): Promise<void>;
  remover(id: string): Promise<void>;
  limpar(): Promise<void>;
}

function promessa<T>(pedido: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rejeitar) => {
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error ?? new Error('Falha no IndexedDB.'));
  });
}

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolver, rejeitar) => {
    const pedido = indexedDB.open(BANCO, VERSAO);

    pedido.onupgradeneeded = () => {
      const bd = pedido.result;
      if (!bd.objectStoreNames.contains(DEPOSITO)) {
        bd.createObjectStore(DEPOSITO, { keyPath: 'id' });
      }
    };

    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error ?? new Error('Não foi possível abrir o histórico.'));
    // Navegação anônima em alguns navegadores bloqueia sem erro nem sucesso.
    pedido.onblocked = () => rejeitar(new Error('O histórico está bloqueado por outra aba.'));
  });
}

/**
 * Abre o histórico, ou devolve `null` quando não há IndexedDB.
 *
 * Devolver `null` em vez de lançar é deliberado: navegação privada e políticas
 * corporativas desligam o IndexedDB, e nesse caso o produto continua inteiro —
 * só não guarda histórico. Perder o gerador por causa de um recurso acessório
 * seria a troca errada.
 */
export async function abrirHistorico(): Promise<Historico | null> {
  if (typeof indexedDB === 'undefined') return null;

  let bd: IDBDatabase;
  try {
    bd = await abrirBanco();
  } catch {
    return null;
  }

  function transacao(modo: IDBTransactionMode): IDBObjectStore {
    return bd.transaction(DEPOSITO, modo).objectStore(DEPOSITO);
  }

  return {
    async listar() {
      const registros = await promessa<RegistroHistorico[]>(transacao('readonly').getAll());
      return podar(registros);
    },

    async salvar(registro) {
      await promessa(transacao('readwrite').put(registro));

      /*
       * A poda acontece na gravação e não na leitura: um banco que só cresce
       * acabaria guardando centenas de logos embutidos, e o usuário nunca
       * veria o problema — só a quota do navegador veria.
       */
      const registros = await promessa<RegistroHistorico[]>(transacao('readonly').getAll());
      if (registros.length <= MAX_REGISTROS) return;

      const manter = new Set(podar(registros).map((r) => r.id));
      const escrita = transacao('readwrite');
      for (const antigo of registros) {
        if (!manter.has(antigo.id)) escrita.delete(antigo.id);
      }
    },

    async remover(id) {
      await promessa(transacao('readwrite').delete(id));
    },

    async limpar() {
      await promessa(transacao('readwrite').clear());
    },
  };
}
