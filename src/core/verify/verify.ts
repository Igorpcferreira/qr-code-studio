import { avaliarContraste } from '@/lib/contrast';
import type { Bitmap } from '../render/raster';
import { rasterizarCena } from '../render/raster';
import { MODULO_CLARO_PADRAO, MODULO_ESCURO_PADRAO } from '../scene/build';
import type { QrNode, Scene } from '../scene/types';
import type { Decodificador } from './decode';
import { PX_POR_MODULO_VERIFICACAO, decodificadorJsQr, escalaParaVerificacao } from './decode';

/**
 * Verificacao automatica de leitura.
 *
 * Depois de aplicar cor, logo e moldura, o resultado renderizado e decodificado
 * de volta e comparado com o conteudo original. Nenhum concorrente faz isso.
 *
 * O diagnostico vai alem do que o brief pediu. Em vez de apontar uma "causa
 * provavel" por heuristica, quando a leitura falha rodamos **experimentos
 * controlados**: remove o logo e tenta de novo; devolve as cores ao padrao e
 * tenta de novo; aumenta a escala e tenta de novo. O primeiro que fizer o
 * codigo voltar a ler nao e um palpite — e a causa, isolada por eliminacao.
 * Cada tentativa custa poucos milissegundos.
 */

export type TipoCausa = 'polaridade' | 'logo' | 'contraste' | 'densidade' | 'correcao' | 'desconhecida';

export interface Causa {
  readonly tipo: TipoCausa;
  /** `true` quando um experimento controlado isolou a causa, nao uma heuristica. */
  readonly confirmada: boolean;
  readonly mensagem: string;
  readonly sugestao: string;
}

export interface Veredicto {
  readonly ok: boolean;
  /** O que o decodificador leu, ou `null` se nao leu nada. */
  readonly conteudoLido: string | null;
  readonly causa: Causa | null;
  /** Escala em px/mm usada na rasterizacao verificada. */
  readonly escala: number;
}

export interface OpcoesVerificacao {
  readonly decodificador?: Decodificador;
  readonly pxPorModulo?: number;
  /** Bitmaps ja decodificados dos `ImageNode`, indexados pelo `href`. */
  readonly imagens?: ReadonlyMap<string, Bitmap>;
}

function codigoDaCena(cena: Scene): QrNode | null {
  return cena.nodes.find((no): no is QrNode => no.kind === 'qr') ?? null;
}

function semLogo(cena: Scene): Scene {
  return { ...cena, nodes: cena.nodes.filter((no) => no.kind !== 'image') };
}

function comCoresPadrao(cena: Scene): Scene {
  return {
    ...cena,
    background: MODULO_CLARO_PADRAO,
    nodes: cena.nodes.map((no) =>
      no.kind === 'qr' ? { ...no, dark: MODULO_ESCURO_PADRAO, light: MODULO_CLARO_PADRAO } : no,
    ),
  };
}

function tentar(cena: Scene, escala: number, opcoes: OpcoesVerificacao): string | null {
  const decodificador = opcoes.decodificador ?? decodificadorJsQr;
  const bitmap = rasterizarCena(cena, escala, { imagens: opcoes.imagens });
  return decodificador.decodificar(bitmap);
}

export function verificarLeitura(cena: Scene, opcoes: OpcoesVerificacao = {}): Veredicto {
  const codigo = codigoDaCena(cena);
  if (codigo === null) {
    throw new Error('A cena nao contem nenhum codigo para verificar.');
  }

  const esperado = cena.meta.payload;
  const pxPorModulo = opcoes.pxPorModulo ?? PX_POR_MODULO_VERIFICACAO;
  const escala = escalaParaVerificacao(codigo.side, codigo.artifact.sizeComQuietZone, pxPorModulo);

  const lido = tentar(cena, escala, opcoes);

  if (lido === esperado) {
    return { ok: true, conteudoLido: lido, causa: null, escala };
  }

  if (lido !== null) {
    return {
      ok: false,
      conteudoLido: lido,
      escala,
      causa: {
        tipo: 'desconhecida',
        confirmada: true,
        mensagem: 'O código foi lido, mas devolveu conteúdo diferente do que você digitou.',
        sugestao: 'Gere o código novamente. Se persistir, é um defeito — por favor relate.',
      },
    };
  }

  return {
    ok: false,
    conteudoLido: null,
    escala,
    causa: diagnosticar(cena, codigo, esperado, escala, opcoes),
  };
}

function diagnosticar(
  cena: Scene,
  codigo: QrNode,
  esperado: string,
  escala: number,
  opcoes: OpcoesVerificacao,
): Causa {
  /*
   * Polaridade primeiro, e sem experimento: inverter as duas cores mantem a
   * razao de contraste identica, entao nenhum outro teste distinguiria o caso.
   * O decodificador roda com `dontInvert` justamente para que codigo invertido
   * falhe aqui em vez de passar despercebido ate o celular do usuario.
   */
  const contraste = avaliarContraste(codigo.dark.rgb, codigo.light.rgb);
  if (contraste.polaridadeInvertida) {
    return {
      tipo: 'polaridade',
      confirmada: true,
      mensagem: 'O módulo escuro está mais claro que o fundo: o código ficou invertido.',
      sugestao: 'Troque as duas cores de lugar. Muitos leitores recusam código invertido.',
    };
  }

  const temLogo = cena.nodes.some((no) => no.kind === 'image');
  if (temLogo && tentar(semLogo(cena), escala, opcoes) === esperado) {
    return {
      tipo: 'logo',
      confirmada: true,
      mensagem: 'Sem o logo o código lê; com ele, não. O logo está cobrindo módulos demais.',
      sugestao:
        codigo.artifact.errorCorrection === 'H'
          ? 'Reduza o logo. Acima de ~16% da área nem a correção H recupera o desenho.'
          : 'Use correção H e reduza o logo. Logo central só é viável no nível mais robusto.',
    };
  }

  const coresPadrao =
    codigo.dark.rgb === MODULO_ESCURO_PADRAO.rgb && codigo.light.rgb === MODULO_CLARO_PADRAO.rgb;
  if (!coresPadrao && tentar(comCoresPadrao(cena), escala, opcoes) === esperado) {
    return {
      tipo: 'contraste',
      confirmada: true,
      mensagem: `Com as cores padrão o código lê; com as suas, não. O contraste de ${contraste.razao.toFixed(1).replace('.', ',')}:1 não é suficiente.`,
      sugestao: 'Escureça o módulo escuro ou clareie o fundo até passar de 4:1.',
    };
  }

  /*
   * Escala fixa e generosa, nao um multiplicador da atual. Medido: um v40
   * decodifica a 1 px por modulo (alinhamento inteiro perfeito) e **falha** a
   * 1,5 px por modulo, porque a fracao distorce a borda de cada modulo. Um
   * `escala * 3` poderia cair justamente numa fracao ruim e diagnosticar
   * "densidade" como nao confirmada por acaso.
   */
  const escalaGenerosa = escalaParaVerificacao(codigo.side, codigo.artifact.sizeComQuietZone, 12);
  if (tentar(cena, escalaGenerosa, opcoes) === esperado) {
    return {
      tipo: 'densidade',
      confirmada: true,
      mensagem: 'Em tamanho maior o código lê. Nesta densidade os módulos ficam pequenos demais.',
      sugestao: 'Aumente o lado do código ou reduza o conteúdo para baixar a versão do QR.',
    };
  }

  if (codigo.artifact.errorCorrection !== 'H') {
    return {
      tipo: 'correcao',
      confirmada: false,
      mensagem: 'O código não foi lido de volta e nenhuma causa isolada explica sozinha.',
      sugestao: `Suba a correção de ${codigo.artifact.errorCorrection} para H e tente de novo.`,
    };
  }

  return {
    tipo: 'desconhecida',
    confirmada: false,
    mensagem: 'O código não foi lido de volta, e remover logo, cor e densidade não resolveu.',
    sugestao: 'Simplifique o conteúdo ou aumente o tamanho. Não recomendamos exportar assim.',
  };
}
