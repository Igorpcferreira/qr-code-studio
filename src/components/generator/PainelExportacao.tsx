'use client';

import { useState } from 'react';
import { desenharCenaComImagens } from '@/core/render/canvas';
import { renderizarSvg } from '@/core/render/svg';
import type { Papel } from '@/core/render/pdf';
import type { Scene } from '@/core/scene/types';
import type { Veredicto } from '@/core/verify/verify';
import { Aviso } from '@/components/ui/Aviso';
import { Botao } from '@/components/ui/Botao';
import { Caixa } from '@/components/ui/Caixa';
import { Chip } from '@/components/ui/Chip';
import { Icone } from '@/components/brand/Icone';
import { baixarBytes, baixarPng, baixarSvg } from '@/lib/download';
import * as fmt from '@/lib/format';
import { ajustarParaModuloInteiro, arredondarPx } from '@/lib/units';

/**
 * Exportação.
 *
 * A regra que o brief pediu e que quase ninguém aplicaria: **se a verificação
 * de leitura falhar, o download é bloqueado**. Entregar um arquivo que não lê
 * seria pior do que não entregar nada — o usuário só descobriria depois de
 * mandar imprimir mil etiquetas.
 */

const PAPEIS_UI = [
  { id: 'ajustado', rotulo: 'Ajustado' },
  { id: 'A4', rotulo: 'A4' },
  { id: 'Carta', rotulo: 'Carta' },
  { id: 'Etiqueta50', rotulo: 'Etiqueta 50' },
] as const;

export interface PainelExportacaoProps {
  cena: Scene;
  ladoPx: number;
  modulosComQuietZone: number;
  payload: string;
  veredicto: Veredicto | null;
}

export function PainelExportacao({
  cena,
  ladoPx,
  modulosComQuietZone,
  payload,
  veredicto,
}: PainelExportacaoProps) {
  const [ocupado, setOcupado] = useState<'png' | 'pdf' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [papel, setPapel] = useState<Papel>('ajustado');
  const [marcasDeCorte, setMarcasDeCorte] = useState(false);
  const [sangria, setSangria] = useState(false);
  const [pretoK, setPretoK] = useState(false);

  const bloqueado = veredicto !== null && !veredicto.ok;

  function exportarSvg(): void {
    baixarSvg(renderizarSvg(cena, { incluirMetadados: true }), fmt.nomeDeArquivo(payload, 'svg'));
  }

  /**
   * Carrega o caminho de PDF sob demanda.
   *
   * `pdf-lib`, `fontkit` e as fontes embutidas somam centenas de KB. Ficam fora
   * do bundle inicial e só chegam quando alguém clica aqui.
   */
  async function exportarPdf(): Promise<void> {
    setOcupado('pdf');
    setErro(null);
    try {
      const { renderizarPdf } = await import('@/core/render/pdf');
      const bytes = await renderizarPdf(cena, { papel, marcasDeCorte, sangria, pretoK });
      baixarBytes(bytes, fmt.nomeDeArquivo(payload, 'pdf'), 'application/pdf');
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao gerar o PDF.');
    } finally {
      setOcupado(null);
    }
  }

  async function exportarPng(): Promise<void> {
    setOcupado('png');
    setErro(null);
    try {
      /*
       * O lado é ajustado para caber um número inteiro de pixels por módulo.
       * Medido no incremento 3: um código decodifica a 1 px por módulo e falha
       * a 1,5 — fração distorce a borda e produz costura.
       */
      const lado = ajustarParaModuloInteiro(arredondarPx(ladoPx), modulosComQuietZone);

      const canvas = document.createElement('canvas');
      canvas.width = lado;
      canvas.height = Math.round((lado * cena.height) / cena.width);

      const ctx = canvas.getContext('2d');
      if (ctx === null) throw new Error('Canvas 2D indisponível neste navegador.');

      await desenharCenaComImagens(ctx, cena, lado / cena.width);
      await baixarPng(canvas, fmt.nomeDeArquivo(payload, 'png'));
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao gerar o PNG.');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {bloqueado ? (
        <Aviso tom="erro" titulo="Exportação bloqueada">
          O código gerado não passou na verificação de leitura. Ajuste a configuração antes de baixar — um
          arquivo que não lê custa mais caro depois de impresso.
        </Aviso>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Botao tipo="primario" disabled={bloqueado} onClick={exportarSvg}>
          <Icone nome="baixar" size={18} />
          Baixar SVG
        </Botao>

        <Botao tipo="secundario" disabled={bloqueado || ocupado !== null} onClick={() => void exportarPdf()}>
          <Icone nome="vetor" size={18} />
          {ocupado === 'pdf' ? 'Gerando…' : 'Baixar PDF'}
        </Botao>

        <Botao tipo="secundario" disabled={bloqueado || ocupado !== null} onClick={() => void exportarPng()}>
          <Icone nome="imprimir" size={18} />
          {ocupado === 'png' ? 'Gerando…' : 'Baixar PNG'}
        </Botao>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="type-caption">Papel do PDF</span>
        <div className="flex flex-wrap gap-2.5">
          {PAPEIS_UI.map((p) => (
            <Chip key={p.id} ativo={p.id === papel} onClick={() => setPapel(p.id)}>
              {p.rotulo}
            </Chip>
          ))}
        </div>
      </div>

      <div className="border-hairline flex flex-col gap-px border">
        <Caixa
          rotulo="Marcas de corte"
          descricao="Filetes finos nos quatro cantos da folha."
          marcada={marcasDeCorte}
          onChange={setMarcasDeCorte}
        />
        <Caixa
          rotulo="Sangria de 3 mm"
          descricao="Área de segurança para acabamento em guilhotina."
          marcada={sangria}
          onChange={setSangria}
        />
        <Caixa
          rotulo="Preto 100% K"
          descricao="Uma chapa em vez de quatro. Gráfica e serigrafia rejeitam preto rico."
          marcada={pretoK}
          onChange={setPretoK}
        />
      </div>

      {erro === null ? null : <Aviso tom="erro">{erro}</Aviso>}

      <p className="type-small text-fg-muted">
        SVG e PDF são vetoriais: escalam de cartão de visita a fachada sem perder um módulo. O PNG sai com um
        número inteiro de pixels por módulo, para não criar costura entre eles. O caminho de PDF só é baixado
        quando você clica.
      </p>
    </div>
  );
}
