import { comporMoldura } from '@/core/frames/molduras';
import { criarArtefato } from '@/core/qr/create';
import type { ResultadoCriacao } from '@/core/qr/create';
import { avaliarLogo, ladoDaMatrizMm } from '@/core/qr/logo';
import type { VeredictoLogo } from '@/core/qr/logo';
import type { QrArtifact } from '@/core/qr/types';
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

  let ladoLogoMm: number | null = null;
  let logo: VeredictoLogo | null = null;
  if (estado.logo !== null) {
    ladoLogoMm = estado.logo.fracaoLado * ladoDaMatrizMm(artefato, lado);
    logo = avaliarLogo(artefato, lado, ladoLogoMm);
  }

  /*
   * A cena vem sempre de uma moldura, mesmo quando o usuário não escolheu
   * nenhuma: "sem moldura" é a primeira das catorze, não um caso especial.
   * Assim existe um caminho só para compor, e não dois que poderiam divergir.
   */
  const cena = comporMoldura(estado.moldura, {
    artefato,
    ladoCodigoMm: lado,
    dark: paint(estado.corEscura),
    light: paint(estado.corClara),
    corMoldura: paint(estado.corMoldura),
    chamada: estado.chamada,
    logo:
      estado.logo === null || ladoLogoMm === null ? null : { href: estado.logo.dataUrl, ladoMm: ladoLogoMm },
    incluirFicha: estado.incluirFicha,
    grade: { colunas: estado.gradeColunas, linhas: estado.gradeLinhas },
  });

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
