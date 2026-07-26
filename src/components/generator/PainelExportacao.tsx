'use client';

import { useState } from 'react';
import { desenharCenaComImagens } from '@/core/render/canvas';
import { renderizarSvg } from '@/core/render/svg';
import type { Scene } from '@/core/scene/types';
import type { Veredicto } from '@/core/verify/verify';
import { Aviso } from '@/components/ui/Aviso';
import { Botao } from '@/components/ui/Botao';
import { Icone } from '@/components/brand/Icone';
import { baixarPng, baixarSvg } from '@/lib/download';
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
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const bloqueado = veredicto !== null && !veredicto.ok;

  function exportarSvg(): void {
    baixarSvg(renderizarSvg(cena, { incluirMetadados: true }), fmt.nomeDeArquivo(payload, 'svg'));
  }

  async function exportarPng(): Promise<void> {
    setOcupado(true);
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
      setOcupado(false);
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

        <Botao tipo="secundario" disabled={bloqueado || ocupado} onClick={() => void exportarPng()}>
          <Icone nome="imprimir" size={18} />
          {ocupado ? 'Gerando…' : 'Baixar PNG'}
        </Botao>

        <Botao tipo="secundario" disabled title="Chega no próximo incremento">
          <Icone nome="vetor" size={18} />
          PDF
        </Botao>
      </div>

      {erro === null ? null : <Aviso tom="erro">{erro}</Aviso>}

      <p className="type-small text-fg-muted">
        SVG é vetorial: escala de cartão de visita a fachada sem perder um módulo. O PNG sai com um número
        inteiro de pixels por módulo, para não criar costura entre eles.
      </p>
    </div>
  );
}
