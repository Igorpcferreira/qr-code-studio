'use client';

import { useRef, useState } from 'react';
import type { LinhaLote } from '@/core/batch/csv';
import { analisarCsv, interpretarCsv, temCabecalho } from '@/core/batch/csv';
import type { FormatoLote, ItemLote } from '@/core/batch/lote';
import { Aviso } from '@/components/ui/Aviso';
import { Botao } from '@/components/ui/Botao';
import { Caixa } from '@/components/ui/Caixa';
import { Chip } from '@/components/ui/Chip';
import { Icone } from '@/components/brand/Icone';
import { baixarBytes } from '@/lib/download';
import * as fmt from '@/lib/format';
import type { EstadoGerador } from '@/state/reducer';

/**
 * Geração em lote a partir de CSV.
 *
 * O modelo mental é "configure uma peça, aplique a muitas": tudo que está na
 * tela — nível, tamanho, cor, moldura, opções de gráfica — vira a configuração
 * do lote, e a planilha entra só com o conteúdo. Um segundo formulário de
 * configuração aqui seria a mesma interface duas vezes, com a chance de as
 * duas divergirem.
 *
 * O arquivo é lido com `File.text()` e nunca sai da máquina. Não existe upload
 * — não existe servidor para onde subir.
 */

const MODELO_CSV = [
  'url;nome;chamada',
  'https://exemplo.com.br/menu;menu-mesa-01;VER MENU',
  'https://exemplo.com.br/vinhos;carta-vinhos;APONTE A CÂMERA',
  'exemplo.com.br/wifi;senha-wifi;',
].join('\r\n');

/** Teto de linhas. Acima disso o navegador é o gargalo, não o algoritmo. */
const MAX_LINHAS = 2000;

export interface PainelLoteProps {
  /** Configuração-modelo: o estado que a prévia está mostrando. */
  base: EstadoGerador;
}

type Fase =
  | { readonly nome: 'ocioso' }
  | { readonly nome: 'processando'; readonly concluidas: number; readonly total: number }
  | { readonly nome: 'pronto'; readonly itens: readonly ItemLote[] };

export function PainelLote({ base }: PainelLoteProps) {
  const entrada = useRef<HTMLInputElement>(null);

  const [linhas, setLinhas] = useState<readonly LinhaLote[] | null>(null);
  const [arquivo, setArquivo] = useState<{ readonly nome: string; readonly texto: string } | null>(null);
  const [comCabecalho, setComCabecalho] = useState(true);
  const [formato, setFormato] = useState<FormatoLote>('svg');
  const [verificar, setVerificar] = useState(true);
  const [fase, setFase] = useState<Fase>({ nome: 'ocioso' });
  const [erro, setErro] = useState<string | null>(null);

  async function aoEscolherArquivo(lista: FileList | null): Promise<void> {
    const escolhido = lista?.item(0);
    if (escolhido === null || escolhido === undefined) return;

    setErro(null);
    setFase({ nome: 'ocioso' });

    const texto = await escolhido.text();
    setArquivo({ nome: escolhido.name, texto });

    interpretar(texto, temCabecalho(analisarCsv(texto).linhas));
  }

  /**
   * O texto do arquivo fica em memória para permitir reinterpretar sem pedir o
   * arquivo de novo. Quem tem uma planilha sem cabeçalho cujo primeiro valor
   * parece um nome de coluna precisa poder corrigir com um clique.
   */
  function interpretar(texto: string, cabecalho: boolean): void {
    const interpretadas = interpretarCsv(analisarCsv(texto), cabecalho);
    setComCabecalho(cabecalho);

    if (interpretadas.length === 0) {
      setLinhas(null);
      setErro('Nenhuma linha com conteúdo. Confira se a coluna do conteúdo é a primeira ou tem cabeçalho.');
      return;
    }

    setErro(null);
    setLinhas(interpretadas.slice(0, MAX_LINHAS));
  }

  async function gerar(): Promise<void> {
    if (linhas === null) return;

    setErro(null);
    setFase({ nome: 'processando', concluidas: 0, total: linhas.length });

    try {
      /*
       * Carregado sob demanda: o cliente arrasta o Worker de lote, que por sua
       * vez arrasta o codificador de PNG e o de ZIP. Quem nunca usa lote não
       * paga por eles no carregamento inicial.
       */
      const { executarLote } = await import('@/core/batch/client');

      const { zip, itens } = await executarLote({
        base,
        linhas,
        formato,
        verificar,
        aoProgredir: (concluidas, total) => setFase({ nome: 'processando', concluidas, total }),
      });

      baixarBytes(zip, `qr-lote-${itens.filter((i) => i.ok).length}-pecas.zip`, 'application/zip');
      setFase({ nome: 'pronto', itens });
    } catch (causa) {
      setFase({ nome: 'ocioso' });
      setErro(causa instanceof Error ? causa.message : 'Falha ao gerar o lote.');
    }
  }

  const processando = fase.nome === 'processando';
  const falhas = fase.nome === 'pronto' ? fase.itens.filter((i) => !i.ok) : [];

  return (
    <section
      aria-labelledby="lote-titulo"
      className="border-hairline bg-surface-card flex flex-col gap-6 border p-8"
    >
      <div className="flex flex-col gap-2">
        <h2 id="lote-titulo" className="type-h3">
          Gerar em lote
        </h2>
        <p className="type-small text-fg-muted max-w-[70ch]">
          Uma planilha CSV vira muitos códigos, empacotados num ZIP. Cada peça usa exatamente a configuração
          acima — nível, tamanho, cor, moldura. O arquivo é lido no seu navegador e não sobe para lugar
          nenhum.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/*
         * O input fica escondido porque o botão desenhado é quem convida ao
         * clique, mas escondido não é o mesmo que sem nome: um leitor de tela
         * ainda o encontra na árvore, e sem rótulo ele é anunciado só como
         * "arquivo". O Lighthouse pegou exatamente isso.
         */}
        <label htmlFor="lote-arquivo" className="sr-only">
          Planilha CSV com o conteúdo de cada código
        </label>
        <input
          ref={entrada}
          id="lote-arquivo"
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="sr-only"
          onChange={(e) => void aoEscolherArquivo(e.target.files)}
        />
        <Botao tipo="secundario" onClick={() => entrada.current?.click()} disabled={processando}>
          <Icone nome="baixar" size={18} />
          Escolher planilha
        </Botao>

        <Botao
          tipo="fantasma"
          onClick={() =>
            baixarBytes(new TextEncoder().encode(MODELO_CSV), 'modelo-lote.csv', 'text/csv;charset=utf-8')
          }
        >
          Baixar modelo
        </Botao>

        {arquivo === null ? null : <span className="type-mono text-fg-muted">{arquivo.nome}</span>}
      </div>

      {linhas === null ? null : (
        <>
          <div className="border-hairline flex flex-col gap-3 border p-4">
            <p className="type-small text-fg">
              <strong>{fmt.numero(linhas.length)}</strong> linhas prontas
              {comCabecalho ? ', com cabeçalho reconhecido' : ', sem cabeçalho — a primeira linha é dado'}.
            </p>
            <ul className="type-mono text-fg-muted flex flex-col gap-1">
              {linhas.slice(0, 3).map((l) => (
                <li key={l.linha} className="truncate">
                  linha {l.linha} · {l.conteudo}
                  {l.chamada === null ? '' : ` · ${l.chamada}`}
                </li>
              ))}
              {linhas.length > 3 ? <li>…</li> : null}
            </ul>
            {arquivo === null ? null : (
              <button
                type="button"
                className="type-small text-accent-link w-fit underline"
                onClick={() => interpretar(arquivo.texto, !comCabecalho)}
              >
                {comCabecalho ? 'A primeira linha não é cabeçalho' : 'A primeira linha é cabeçalho'}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="type-caption">Formato de saída</span>
            <div className="flex flex-wrap gap-2.5">
              <Chip ativo={formato === 'svg'} selo="vetorial" onClick={() => setFormato('svg')}>
                SVG
              </Chip>
              <Chip ativo={formato === 'png'} selo="raster" onClick={() => setFormato('png')}>
                PNG
              </Chip>
            </div>
          </div>

          <div className="border-hairline border">
            <Caixa
              rotulo="Verificar cada peça"
              descricao="Decodifica cada código de volta antes de empacotar. Linha que não lê fica de fora do ZIP e aparece no relatório."
              marcada={verificar}
              onChange={setVerificar}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Botao tipo="primario" disabled={processando} onClick={() => void gerar()}>
              <Icone nome="vetor" size={18} />
              {processando ? 'Gerando…' : `Gerar ${fmt.numero(linhas.length)} códigos`}
            </Botao>

            {fase.nome === 'processando' ? (
              <p className="type-mono text-fg-muted" aria-live="polite">
                {fmt.numero(fase.concluidas)} de {fmt.numero(fase.total)}
              </p>
            ) : null}
          </div>
        </>
      )}

      {erro === null ? null : <Aviso tom="erro">{erro}</Aviso>}

      {fase.nome === 'pronto' ? (
        <Aviso tom={falhas.length === 0 ? 'sucesso' : 'atencao'} titulo="Lote concluído">
          <p>
            {fmt.numero(fase.itens.length - falhas.length)} de {fmt.numero(fase.itens.length)} peças no ZIP.
          </p>
          {falhas.length === 0 ? null : (
            <ul className="mt-2 flex flex-col gap-1">
              {falhas.slice(0, 10).map((f) => (
                <li key={f.linha} className="type-mono">
                  linha {f.linha}: {f.motivo}
                </li>
              ))}
              {falhas.length > 10 ? <li className="type-mono">…e mais {falhas.length - 10}.</li> : null}
            </ul>
          )}
        </Aviso>
      ) : null}
    </section>
  );
}
