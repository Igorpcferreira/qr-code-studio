import { criarArtefato } from '@/core/qr/create';
import type { ResultadoCriacao } from '@/core/qr/create';
import { avaliarLogo, ladoDaMatrizMm } from '@/core/qr/logo';
import type { VeredictoLogo } from '@/core/qr/logo';
import type { QrArtifact } from '@/core/qr/types';
import { construirCenaBasica } from '@/core/scene/build';
import type { Scene } from '@/core/scene/types';
import { paint } from '@/core/scene/types';
import type { VeredictoContraste } from '@/lib/contrast';
import { avaliarContraste } from '@/lib/contrast';
import type { AvaliacaoImpressao } from '@/lib/scan-distance';
import { avaliarImpressao } from '@/lib/scan-distance';
import type { EstadoGerador } from './reducer';
import { ladoMm } from './reducer';

/**
 * Cadeia derivada do estado.
 *
 * Funções puras, fora dos componentes: a interface só chama e memoiza. Isso
 * mantém a lógica testável sem React e evita que um `useMemo` mal colocado
 * recalcule a matriz a cada tecla.
 */

export interface Derivado {
  readonly ladoMm: number;
  readonly resultado: ResultadoCriacao;
  readonly artefato: QrArtifact | null;
  readonly cena: Scene | null;
  readonly contraste: VeredictoContraste;
  readonly impressao: AvaliacaoImpressao | null;
  readonly logo: VeredictoLogo | null;
  /** Lado do logo em mm, quando há logo. */
  readonly ladoLogoMm: number | null;
}

export function derivar(estado: EstadoGerador): Derivado {
  const lado = ladoMm(estado);
  const resultado = criarArtefato(estado.conteudo.trim(), estado.nivel);
  const contraste = avaliarContraste(estado.corEscura, estado.corClara);

  if (!resultado.ok) {
    return {
      ladoMm: lado,
      resultado,
      artefato: null,
      cena: null,
      contraste,
      impressao: null,
      logo: null,
      ladoLogoMm: null,
    };
  }

  const artefato = resultado.artefato;

  const base = construirCenaBasica(artefato, lado, {
    dark: paint(estado.corEscura),
    light: paint(estado.corClara),
  });

  let cena = base;
  let ladoLogoMm: number | null = null;
  let logo: VeredictoLogo | null = null;

  if (estado.logo !== null) {
    ladoLogoMm = estado.logo.fracaoLado * ladoDaMatrizMm(artefato, lado);
    logo = avaliarLogo(artefato, lado, ladoLogoMm);

    const canto = (lado - ladoLogoMm) / 2;
    cena = {
      ...base,
      nodes: [
        ...base.nodes,
        { kind: 'image', x: canto, y: canto, w: ladoLogoMm, h: ladoLogoMm, href: estado.logo.dataUrl },
      ],
    };
  }

  return {
    ladoMm: lado,
    resultado,
    artefato,
    cena,
    contraste,
    impressao: avaliarImpressao({
      ladoMm: lado,
      modulosComQuietZone: artefato.sizeComQuietZone,
      dpi: estado.dpi,
    }),
    logo,
    ladoLogoMm,
  };
}
