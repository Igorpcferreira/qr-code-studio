'use client';

import { useId } from 'react';
import { ControleSegmentado } from '@/components/ui/ControleSegmentado';
import type { AvaliacaoImpressao } from '@/lib/scan-distance';
import { descreverDistancia } from '@/lib/scan-distance';
import * as fmt from '@/lib/format';
import type { Dpi, Unidade } from '@/lib/units';
import { DPIS_SUPORTADOS } from '@/lib/units';

/**
 * Tamanho, unidade e DPI.
 *
 * A linha de resumo é o diferencial: além do tamanho, informa a distância
 * máxima de leitura e o lado de cada módulo — e avisa quando o módulo cai
 * abaixo de 0,4 mm, ponto em que a impressão comum começa a falhar por
 * espalhamento de tinta. Quase nenhum gerador conta isso.
 */

const UNIDADES = [
  { valor: 'px', rotulo: 'px', descricao: 'Pixels' },
  { valor: 'mm', rotulo: 'mm', descricao: 'Milímetros' },
] as const satisfies readonly { valor: Unidade; rotulo: string; descricao: string }[];

const DPIS = DPIS_SUPORTADOS.map((d) => ({
  valor: String(d) as `${Dpi}`,
  rotulo: String(d),
  descricao: `${d} pontos por polegada`,
}));

export interface PainelTamanhoProps {
  lado: number;
  unidade: Unidade;
  dpi: Dpi;
  impressao: AvaliacaoImpressao | null;
  ladoMm: number;
  onLado: (valor: number) => void;
  onUnidade: (valor: Unidade) => void;
  onDpi: (valor: Dpi) => void;
}

export function PainelTamanho({
  lado,
  unidade,
  dpi,
  impressao,
  ladoMm,
  onLado,
  onUnidade,
  onDpi,
}: PainelTamanhoProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-5">
        <div className="flex flex-col gap-2.5">
          <label className="type-caption" htmlFor={id}>
            Lado
          </label>
          <div className="border-hairline flex border">
            <input
              id={id}
              type="number"
              min={1}
              step={unidade === 'px' ? 8 : 1}
              value={lado}
              onChange={(e) => {
                const valor = Number(e.target.value);
                if (Number.isFinite(valor) && valor > 0) onLado(valor);
              }}
              className="font-data bg-surface-card text-fg w-28 px-4 py-3.5 text-[15px] tabular-nums outline-none"
            />
            <span className="type-mono text-fg-muted border-hairline flex items-center border-l px-4">
              {unidade}
            </span>
          </div>
        </div>

        <ControleSegmentado legenda="Unidade" opcoes={UNIDADES} valor={unidade} onChange={onUnidade} />

        <ControleSegmentado
          legenda="DPI de impressão"
          opcoes={DPIS}
          valor={String(dpi) as `${Dpi}`}
          onChange={(v) => onDpi(Number(v) as Dpi)}
        />
      </div>

      {impressao === null ? null : (
        <div className="flex flex-col gap-1">
          <p className="type-mono text-fg-muted">
            {fmt.decimal(ladoMm)} mm · módulo de {fmt.decimal(impressao.moduloMm, 2)} mm ·{' '}
            {descreverDistancia(ladoMm).replace('Lê até cerca de ', 'lê a até ').replace('.', '')}
          </p>
          {impressao.aviso === null ? null : (
            <p className="type-small text-warning flex items-start gap-2">
              <span className="bg-warning mt-1.5 size-2 shrink-0" aria-hidden="true" />
              {impressao.aviso}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
