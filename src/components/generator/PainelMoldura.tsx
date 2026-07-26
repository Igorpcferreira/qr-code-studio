'use client';

import { useId } from 'react';
import { MOLDURAS, moldura } from '@/core/frames/molduras';
import type { IdMoldura } from '@/core/frames/tipos';
import { MAX_CHAMADA } from '@/core/frames/tipos';
import { Caixa } from '@/components/ui/Caixa';
import { Chip } from '@/components/ui/Chip';
import { CHAMADAS_SUGERIDAS, CORES_MOLDURA } from '@/state/reducer';

/**
 * Escolha de moldura, chamada de ação e cor.
 *
 * A regra do board que este painel materializa: **a chamada é impressa, não
 * codificada**. Ela entra no arquivo como texto vetorial e jamais no payload do
 * QR — o campo abaixo não altera o que o código carrega, e o rodapé diz isso.
 */

export interface PainelMolduraProps {
  moldura: IdMoldura;
  chamada: string;
  corMoldura: string;
  incluirFicha: boolean;
  gradeColunas: number;
  gradeLinhas: number;
  onMoldura: (id: IdMoldura) => void;
  onChamada: (texto: string) => void;
  onCorMoldura: (hex: string) => void;
  onIncluirFicha: (valor: boolean) => void;
  onGrade: (colunas: number, linhas: number) => void;
}

const GRADES = [
  { colunas: 2, linhas: 2 },
  { colunas: 3, linhas: 3 },
  { colunas: 4, linhas: 6 },
] as const;

export function PainelMoldura(props: PainelMolduraProps) {
  const idChamada = useId();
  const definicao = moldura(props.moldura);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <span className="type-caption">Moldura</span>
        <div className="flex flex-wrap gap-2.5">
          {MOLDURAS.map((m) => (
            <Chip key={m.id} ativo={m.id === props.moldura} onClick={() => props.onMoldura(m.id)}>
              {m.nome}
            </Chip>
          ))}
        </div>
        <p className="type-small text-fg-muted">{definicao.descricao}</p>
      </div>

      {definicao.usaChamada ? (
        <div className="flex flex-col gap-2.5">
          <label className="type-caption" htmlFor={idChamada}>
            Chamada de ação
          </label>

          <input
            id={idChamada}
            type="text"
            value={props.chamada}
            maxLength={MAX_CHAMADA}
            onChange={(e) => props.onChamada(e.target.value)}
            className="font-display bg-surface-card text-fg border-hairline border px-5 py-3.5 text-[15px] font-extrabold tracking-[0.12em] uppercase outline-none"
          />

          <div className="flex flex-wrap gap-2.5">
            {CHAMADAS_SUGERIDAS.map((c) => (
              <Chip key={c} ativo={c === props.chamada} onClick={() => props.onChamada(c)}>
                {c}
              </Chip>
            ))}
          </div>

          <p className="type-small text-fg-muted">
            {props.chamada.length}/{MAX_CHAMADA} caracteres, sempre em caixa alta.{' '}
            <strong className="text-fg font-semibold">A chamada é impressa, não codificada</strong> — ela não
            entra no conteúdo do QR.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
        <span className="type-caption">Cor da moldura</span>
        <div className="flex flex-wrap gap-2.5">
          {CORES_MOLDURA.map((c) => (
            <Chip key={c.hex} ativo={c.hex === props.corMoldura} onClick={() => props.onCorMoldura(c.hex)}>
              <span className="flex items-center gap-2.5">
                <span className="size-4 shrink-0" style={{ background: c.hex }} aria-hidden="true" />
                {c.nome}
              </span>
            </Chip>
          ))}
        </div>
      </div>

      {props.moldura === 'grade' ? (
        <div className="flex flex-col gap-2.5">
          <span className="type-caption">Códigos por folha</span>
          <div className="flex flex-wrap gap-2.5">
            {GRADES.map((g) => (
              <Chip
                key={`${g.colunas}x${g.linhas}`}
                ativo={g.colunas === props.gradeColunas && g.linhas === props.gradeLinhas}
                onClick={() => props.onGrade(g.colunas, g.linhas)}
              >
                {g.colunas} × {g.linhas} = {g.colunas * g.linhas}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {props.moldura === 'inferior' ? (
        <div className="border-hairline border">
          <Caixa
            rotulo="Ficha técnica impressa"
            descricao="Versão, módulos, correção e endereço abaixo do código."
            marcada={props.incluirFicha}
            onChange={props.onIncluirFicha}
          />
        </div>
      ) : null}
    </div>
  );
}
