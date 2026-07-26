import type { MargemDano } from '@/core/verify/damage';
import type { Veredicto } from '@/core/verify/verify';
import { Aviso } from '@/components/ui/Aviso';

/**
 * Resultado da verificação de leitura.
 *
 * A parte que nenhum concorrente entrega: o código gerado foi decodificado de
 * volta e conferido contra o que o usuário digitou. Quando falha, a causa não é
 * palpite — vem de experimentos controlados, e o relatório diz isso
 * explicitamente para que o usuário saiba o peso da informação.
 */

export interface RelatorioVerificacaoProps {
  veredicto: Veredicto | null;
  margens: readonly MargemDano[] | null;
  verificando: boolean;
}

export function RelatorioVerificacao({ veredicto, margens, verificando }: RelatorioVerificacaoProps) {
  if (verificando) {
    return (
      <p className="type-small text-fg-muted flex items-center gap-2" aria-live="polite">
        <span className="bg-steel size-2 animate-pulse" aria-hidden="true" />
        Verificando a leitura…
      </p>
    );
  }

  if (veredicto === null) return null;

  if (veredicto.ok) {
    return (
      <Aviso tom="sucesso" titulo="Leitura confirmada">
        <p>O código foi decodificado de volta e devolveu exatamente o conteúdo digitado.</p>
        {margens !== null && margens.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {margens.map((m) => (
              <li key={m.eixo} className="type-mono">
                {m.descricao}
              </li>
            ))}
          </ul>
        ) : null}
      </Aviso>
    );
  }

  const causa = veredicto.causa;

  return (
    <Aviso tom="atencao" titulo="Este código pode não ser lido">
      <p>{causa?.mensagem}</p>
      <p className="mt-1">{causa?.sugestao}</p>
      {causa?.confirmada === true ? (
        <p className="type-mono mt-2">Causa isolada por experimento controlado, não por estimativa.</p>
      ) : null}
    </Aviso>
  );
}
