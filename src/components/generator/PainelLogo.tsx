'use client';

import { useId, useRef, useState } from 'react';
import { LIMITE_AREA_LOGO } from '@/core/qr/logo';
import type { VeredictoLogo } from '@/core/qr/logo';
import type { ErrorCorrection } from '@/core/qr/types';
import { Aviso } from '@/components/ui/Aviso';
import { Botao } from '@/components/ui/Botao';
import type { LogoSelecionado } from '@/state/reducer';
import { lerArquivoComoDataUrl } from '@/lib/imagem';

/**
 * Logo central.
 *
 * O limite é 16% da área **da matriz** e exclusivo do nível H, e vem de medição,
 * não do folclore de mercado: os "25% com correção H" que todo concorrente
 * publica não passam em jsQR nem em ZXing. O slider já nasce limitado ao valor
 * seguro, e a verificação de leitura confirma sobre o desenho final.
 */

const FRACAO_MAXIMA = Math.sqrt(LIMITE_AREA_LOGO); // 0,4 do lado da matriz

export interface PainelLogoProps {
  logo: LogoSelecionado | null;
  nivel: ErrorCorrection;
  veredicto: VeredictoLogo | null;
  onLogo: (logo: LogoSelecionado | null) => void;
  onTamanho: (fracao: number) => void;
}

export function PainelLogo({ logo, nivel, veredicto, onLogo, onTamanho }: PainelLogoProps) {
  const idArquivo = useId();
  const idSlider = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  const bloqueado = nivel !== 'H';

  async function aoEscolher(arquivo: File | undefined): Promise<void> {
    if (arquivo === undefined) return;
    const lido = await lerArquivoComoDataUrl(arquivo);
    if (!lido.ok) {
      setErro(lido.erro);
      return;
    }
    setErro(null);
    onLogo({ dataUrl: lido.dataUrl, nome: lido.nome, fracaoLado: FRACAO_MAXIMA });
  }

  return (
    <div className="flex flex-col gap-4">
      {bloqueado ? (
        <Aviso tom="atencao" titulo="Logo central exige correção H">
          Só o nível mais robusto recupera o desenho coberto pelo logo. Mude a correção para H para habilitar.
        </Aviso>
      ) : null}

      <input
        ref={entrada}
        id={idArquivo}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="sr-only"
        disabled={bloqueado}
        onChange={(e) => void aoEscolher(e.target.files?.[0])}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Botao tipo="secundario" disabled={bloqueado} onClick={() => entrada.current?.click()}>
          {logo === null ? 'Escolher imagem' : 'Trocar imagem'}
        </Botao>

        {logo === null ? null : (
          <>
            <span className="type-mono text-fg-muted max-w-[220px] truncate">{logo.nome}</span>
            <Botao tipo="destrutivo" onClick={() => onLogo(null)}>
              Remover
            </Botao>
          </>
        )}
      </div>

      {erro === null ? null : <Aviso tom="erro">{erro}</Aviso>}

      {logo === null ? null : (
        <div className="flex flex-col gap-2.5">
          <label className="type-caption" htmlFor={idSlider}>
            Tamanho do logo
          </label>
          <input
            id={idSlider}
            type="range"
            min={0.1}
            max={FRACAO_MAXIMA}
            step={0.01}
            value={logo.fracaoLado}
            onChange={(e) => onTamanho(Number(e.target.value))}
            className="accent-ultramarine w-full"
          />
          <p className="type-mono text-fg-muted">
            {Math.round(logo.fracaoLado ** 2 * 100)}% da área do código · teto de{' '}
            {Math.round(LIMITE_AREA_LOGO * 100)}%
          </p>
        </div>
      )}

      {veredicto !== null && !veredicto.permitido ? (
        <Aviso tom="atencao" titulo={veredicto.motivo}>
          {veredicto.sugestao}
        </Aviso>
      ) : null}

      <p className="type-small text-fg-muted">
        O limite de 16% vem de teste com decodificador real. O valor de 25% que o mercado repete não passa em
        nenhum dos dois que medimos.
      </p>
    </div>
  );
}
