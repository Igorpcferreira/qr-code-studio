import type { QrArtifact } from '@/core/qr/types';
import type { MargemDano } from '@/core/verify/damage';
import * as fmt from '@/lib/format';

/**
 * Ficha técnica — o componente-assinatura.
 *
 * Entrega a especificação do artefato, não a promessa de um serviço. É a prova
 * visual de que o usuário recebe algo que possui.
 *
 * O desenho é do board, linha por linha. **Os números não são**: o board exibe
 * "CAPACIDADE 1.782 / 2.303 bytes" para v6 nível H, o que é impossível — o teto
 * do formato em H é 1.273 bytes e em v6/H são 58. Aqui tudo é calculado a
 * partir da tabela ISO/IEC 18004. Numa ferramenta cuja tese é honestidade
 * técnica, herdar um número impossível seria autodestrutivo.
 */

interface LinhaProps {
  rotulo: string;
  children: React.ReactNode;
  destaque?: boolean;
}

function Linha({ rotulo, children, destaque }: LinhaProps) {
  return (
    <div className="border-hairline grid grid-cols-[1fr_auto] gap-4 border-b px-4 py-3 last:border-b-0">
      <dt className="text-fg-muted tracking-[0.06em]">{rotulo}</dt>
      <dd className={`font-medium ${destaque === true ? 'text-accent-link' : ''}`}>{children}</dd>
    </div>
  );
}

export interface FichaTecnicaProps {
  artefato: QrArtifact;
  margens?: readonly MargemDano[] | null;
}

export function FichaTecnica({ artefato, margens }: FichaTecnicaProps) {
  const oclusao = margens?.find((m) => m.eixo === 'oclusao');

  return (
    <section className="border-fg border" aria-labelledby="ficha-titulo">
      <header className="bg-carbon flex justify-between px-4 py-3 text-white">
        <h2 id="ficha-titulo" className="type-eyebrow !text-white">
          Ficha técnica
        </h2>
        <span className="type-eyebrow">
          {fmt.identificador(artefato.payload, artefato.version, artefato.errorCorrection)}
        </span>
      </header>

      <dl className="type-mono">
        <Linha rotulo="VERSÃO">{artefato.version}</Linha>
        <Linha rotulo="MÓDULOS">{fmt.modulos(artefato.size)}</Linha>
        <Linha rotulo="CORREÇÃO">{fmt.correcao(artefato.errorCorrection)}</Linha>
        <Linha rotulo="CAPACIDADE">{fmt.bytes(artefato.byteLength, artefato.capacityBytes)}</Linha>
        <Linha rotulo="ZONA DE SILÊNCIO">{artefato.quietZone} módulos</Linha>
        {oclusao === undefined ? null : (
          <Linha rotulo="MARGEM DE DANO">{Math.round(oclusao.tolerancia * 100)}%</Linha>
        )}
        <Linha rotulo="TIPO" destaque>
          Estático
        </Linha>
      </dl>
    </section>
  );
}
