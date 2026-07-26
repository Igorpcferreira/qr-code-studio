'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Historico } from '@/core/history/db';
import { abrirHistorico } from '@/core/history/db';
import type { RegistroHistorico } from '@/core/history/registro';
import { chaveDoEstado, criarRegistro, inserir } from '@/core/history/registro';
import { Aviso } from '@/components/ui/Aviso';
import { Botao } from '@/components/ui/Botao';
import { Caixa } from '@/components/ui/Caixa';
import type { EstadoGerador } from '@/state/reducer';

/**
 * Histórico local.
 *
 * Guarda a configuração inteira — conteúdo, cor, moldura, logo embutido — de
 * cada código que passou na verificação de leitura, e a devolve com um clique.
 * Fica no IndexedDB do próprio navegador e não sai dele: não há conta, não há
 * sincronização e não há nada para vazar.
 *
 * A gravação acontece só depois que a verificação confirma a leitura. Guardar
 * configurações quebradas encheria a lista de coisas que o usuário não quer de
 * volta.
 */

const CHAVE_PREFERENCIA = 'qr-historico-ligado';

/** Espera antes de gravar: quem está digitando ainda não terminou de decidir. */
const ESPERA_MS = 1500;

export interface PainelHistoricoProps {
  estado: EstadoGerador;
  /** A configuração corrente passou na verificação de leitura? */
  verificado: boolean;
  /** Conteúdo codificado, ou `null` quando ainda não há artefato. */
  payload: string | null;
  aoRestaurar: (estado: EstadoGerador) => void;
}

function lerPreferencia(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(CHAVE_PREFERENCIA) !== 'nao';
}

export function PainelHistorico({ estado, verificado, payload, aoRestaurar }: PainelHistoricoProps) {
  const banco = useRef<Historico | null>(null);

  const [registros, setRegistros] = useState<readonly RegistroHistorico[]>([]);
  const [ligado, setLigado] = useState(true);
  const [indisponivel, setIndisponivel] = useState(false);

  /*
   * Tudo que vem do navegador é lido depois da montagem, e nunca no corpo do
   * efeito: a página é pré-renderizada em tempo de build, onde não existe
   * `localStorage` nem `indexedDB`. Ler na montagem manteria a marcação do
   * servidor e a do cliente iguais na primeira pintura.
   */
  useEffect(() => {
    let vigente = true;

    void abrirHistorico().then(async (aberto) => {
      if (!vigente) return;

      setLigado(lerPreferencia());

      if (aberto === null) {
        setIndisponivel(true);
        return;
      }
      banco.current = aberto;
      setRegistros(await aberto.listar());
    });

    return () => {
      vigente = false;
    };
  }, []);

  /*
   * A dependência é a chave da configuração, não o objeto: `derivar` devolve um
   * estado novo a cada tecla, e sem o hash o efeito reagendaria a gravação em
   * toda renderização.
   */
  const chave = chaveDoEstado(estado);

  useEffect(() => {
    if (!ligado || !verificado || payload === null || banco.current === null) return undefined;

    const temporizador = setTimeout(() => {
      const registro = criarRegistro({ estado, payload, agora: Date.now() });
      void banco.current?.salvar(registro).then(() => {
        setRegistros((atuais) => inserir(atuais, registro));
      });
    }, ESPERA_MS);

    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `chave` resume `estado`.
  }, [chave, ligado, verificado, payload]);

  const alternar = useCallback((novo: boolean) => {
    setLigado(novo);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CHAVE_PREFERENCIA, novo ? 'sim' : 'nao');
    }
  }, []);

  async function remover(id: string): Promise<void> {
    await banco.current?.remover(id);
    setRegistros((atuais) => atuais.filter((r) => r.id !== id));
  }

  async function limpar(): Promise<void> {
    await banco.current?.limpar();
    setRegistros([]);
  }

  return (
    <section
      aria-labelledby="historico-titulo"
      className="border-hairline bg-surface-card flex flex-col gap-6 border p-8"
    >
      <div className="flex flex-col gap-2">
        <h2 id="historico-titulo" className="type-h3">
          Histórico
        </h2>
        <p className="type-small text-fg-muted max-w-[70ch]">
          As configurações que passaram na verificação ficam guardadas neste navegador — com cor, moldura e
          logo. Nada é enviado a lugar nenhum, e apagar aqui apaga de verdade.
        </p>
      </div>

      {indisponivel ? (
        <Aviso tom="atencao">
          Este navegador não disponibiliza armazenamento local (navegação privada, normalmente). O gerador
          funciona igual; só o histórico fica de fora.
        </Aviso>
      ) : (
        <>
          <div className="border-hairline border">
            <Caixa
              rotulo="Guardar histórico neste navegador"
              descricao="Desligado, nada novo é gravado. O que já está guardado continua até você apagar."
              marcada={ligado}
              onChange={alternar}
            />
          </div>

          {registros.length === 0 ? (
            <p className="type-small text-fg-muted">
              Nenhum código guardado ainda. O primeiro entra assim que a verificação confirmar a leitura.
            </p>
          ) : (
            <>
              <ul className="border-hairline flex flex-col divide-y divide-[var(--color-rule)] border">
                {registros.map((registro) => (
                  <li key={registro.id} className="flex flex-wrap items-center gap-4 p-4">
                    <span className="type-small text-fg min-w-0 flex-1 truncate">{registro.rotulo}</span>
                    <span className="type-mono text-fg-muted">
                      {new Date(registro.criadoEm).toLocaleDateString('pt-BR')}
                    </span>
                    <Botao tipo="fantasma" onClick={() => aoRestaurar(registro.estado)}>
                      Restaurar
                    </Botao>
                    <Botao
                      tipo="fantasma"
                      aria-label={`Apagar ${registro.rotulo}`}
                      onClick={() => void remover(registro.id)}
                    >
                      Apagar
                    </Botao>
                  </li>
                ))}
              </ul>

              <Botao tipo="destrutivo" className="w-fit" onClick={() => void limpar()}>
                Apagar todo o histórico
              </Botao>
            </>
          )}
        </>
      )}
    </section>
  );
}
