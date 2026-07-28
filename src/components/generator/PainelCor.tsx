'use client';

import { useId } from 'react';
import type { VeredictoContraste } from '@/lib/contrast';
import { formatarRazao } from '@/lib/contrast';
import { Botao } from '@/components/ui/Botao';
import { Chip } from '@/components/ui/Chip';
import { PALETAS } from '@/state/reducer';

/**
 * Personalização de cor com indicador de contraste.
 *
 * O número exibido é a razão WCAG, que é um proxy — scanners usam diferença de
 * refletância (ISO/IEC 15415). O texto de apoio diz isso, e quem dá o veredito
 * final é a verificação de leitura, logo abaixo na tela.
 */

interface SeletorProps {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
}

function Seletor({ rotulo, valor, onChange }: SeletorProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label className="type-caption" htmlFor={id}>
        {rotulo}
      </label>
      <div className="border-hairline bg-surface-card flex items-center gap-3 border p-3">
        <input
          id={id}
          type="color"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="border-hairline size-7 shrink-0 cursor-pointer border bg-transparent p-0"
        />
        <span className="type-mono uppercase">{valor}</span>
      </div>
    </div>
  );
}

export interface PainelCorProps {
  corEscura: string;
  corClara: string;
  corOlhos: string | null;
  contraste: VeredictoContraste;
  /** Contraste dos marcadores, só quando eles têm cor própria. */
  contrasteOlhos: VeredictoContraste | null;
  onCorEscura: (valor: string) => void;
  onCorClara: (valor: string) => void;
  onCorOlhos: (valor: string | null) => void;
  onPaleta: (escura: string, clara: string) => void;
  onInverter: () => void;
}

export function PainelCor({
  corEscura,
  corClara,
  corOlhos,
  contraste,
  contrasteOlhos,
  onCorEscura,
  onCorClara,
  onCorOlhos,
  onPaleta,
  onInverter,
}: PainelCorProps) {
  const problema = contraste.polaridadeInvertida || contraste.nivel === 'insuficiente';
  const problemaOlhos =
    contrasteOlhos !== null &&
    (contrasteOlhos.polaridadeInvertida || contrasteOlhos.nivel === 'insuficiente');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <span className="type-caption">Paleta</span>
        <div className="flex flex-wrap gap-2.5">
          {PALETAS.map((p) => (
            <Chip
              key={p.nome}
              ativo={p.escura === corEscura && p.clara === corClara}
              onClick={() => onPaleta(p.escura, p.clara)}
            >
              <span className="flex items-center gap-2.5">
                <span className="border-hairline flex size-4 shrink-0 border" aria-hidden="true">
                  <span className="w-1/2" style={{ background: p.escura }} />
                  <span className="w-1/2" style={{ background: p.clara }} />
                </span>
                {p.nome}
              </span>
            </Chip>
          ))}
        </div>
        <p className="type-small text-fg-muted">
          Todas escuras sobre claro, inclusive a de placa eletrônica.{' '}
          <strong className="text-fg font-semibold">Código claro sobre fundo escuro é recusado</strong> por
          boa parte dos leitores de celular.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Seletor rotulo="Módulo escuro" valor={corEscura} onChange={onCorEscura} />
        <Seletor rotulo="Módulo claro" valor={corClara} onChange={onCorClara} />
      </div>

      <div className={`border p-4 ${problema ? 'border-warning' : 'border-hairline'}`}>
        <p className="type-mono text-fg-muted tracking-[0.06em]">CONTRASTE</p>
        <p className="font-data mt-2 text-[26px] font-medium tabular-nums">
          {formatarRazao(contraste.razao)}
        </p>

        <div className="mt-2.5 flex items-start gap-2">
          <span
            className={`mt-1.5 size-2 shrink-0 ${problema ? 'bg-warning' : 'bg-success'}`}
            aria-hidden="true"
          />
          <p className="type-small">{contraste.mensagem ?? 'Seguro para qualquer scanner.'}</p>
        </div>

        {contraste.polaridadeInvertida ? (
          <Botao tipo="secundario" className="mt-4 w-full" onClick={onInverter}>
            Trocar as duas cores
          </Botao>
        ) : null}
      </div>

      {/*
       * Cor dos marcadores por último e desligada por padrão: quem só quer um
       * código azul troca uma cor, não duas. Ligada, ela ganha medição própria
       * — marcador de baixo contraste derruba a leitura antes de qualquer
       * módulo, porque é por ele que o detector acha o código.
       */}
      <div className="flex flex-col gap-2.5">
        <span className="type-caption">Cor dos marcadores</span>
        <div className="flex flex-wrap gap-2.5">
          <Chip ativo={corOlhos === null} onClick={() => onCorOlhos(null)}>
            Mesma dos módulos
          </Chip>
          <Chip ativo={corOlhos !== null} onClick={() => onCorOlhos(corOlhos ?? corEscura)}>
            <span className="flex items-center gap-2.5">
              <span
                className="border-hairline size-4 shrink-0 border"
                style={{ background: corOlhos ?? corEscura }}
                aria-hidden="true"
              />
              Cor própria
            </span>
          </Chip>
        </div>

        {corOlhos === null ? null : (
          <>
            <Seletor rotulo="Marcadores de canto" valor={corOlhos} onChange={onCorOlhos} />
            {contrasteOlhos === null ? null : (
              <p className={`type-small ${problemaOlhos ? 'text-warning' : 'text-fg-muted'}`}>
                Contraste dos marcadores: {formatarRazao(contrasteOlhos.razao)}.{' '}
                {contrasteOlhos.mensagem ??
                  'Os três cantos são o que o scanner procura primeiro — este número precisa ser tão alto quanto o dos módulos.'}
              </p>
            )}
          </>
        )}
      </div>

      <p className="type-small text-fg-muted">
        A razão de contraste é um bom indicador, mas scanners medem refletância. Quem confirma é a verificação
        de leitura.
      </p>
    </div>
  );
}
