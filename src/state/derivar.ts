import { montarConteudo } from '@/core/content';
import { conferirBrCode } from '@/core/content/pix';
import type { ResultadoConteudo } from '@/core/content/tipos';
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
  /** Payload montado a partir do formulário do tipo corrente. */
  readonly conteudo: ResultadoConteudo;
  readonly resultado: ResultadoCriacao;
  readonly artefato: QrArtifact | null;
  readonly cena: Scene | null;
  readonly contraste: VeredictoContraste;
  readonly impressao: AvaliacaoImpressao | null;
  readonly logo: VeredictoLogo | null;
  /** Lado do logo em mm, quando há logo. */
  readonly ladoLogoMm: number | null;
  /**
   * Conferência estrutural do BR Code, só quando o tipo é Pix.
   *
   * É o segundo nível da verificação: decodificar o QR prova que a string
   * sobreviveu ao desenho, isto prova que a string é um Pix válido. São dois
   * defeitos diferentes e nenhum cobre o outro.
   */
  readonly brCode: { readonly ok: boolean; readonly motivo: string | null } | null;
}

export function derivar(estado: EstadoGerador): Derivado {
  const lado = ladoMm(estado);
  const conteudo = montarConteudo(estado.tipoConteudo, estado.formularios);
  const resultado = criarArtefato(conteudo.payload, estado.nivel);
  const contraste = avaliarContraste(estado.corEscura, estado.corClara);

  const brCode =
    estado.tipoConteudo === 'pix' && conteudo.payload.length > 0 ? conferirBrCode(conteudo.payload) : null;

  if (!resultado.ok) {
    return {
      ladoMm: lado,
      conteudo,
      resultado,
      artefato: null,
      cena: null,
      contraste,
      impressao: null,
      logo: null,
      ladoLogoMm: null,
      brCode,
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
    conteudo,
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
    brCode,
  };
}
