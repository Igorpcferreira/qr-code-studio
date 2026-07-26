import type { Formularios, TipoConteudo } from '@/core/content/tipos';
import { FORMULARIOS_INICIAIS } from '@/core/content/tipos';
import type { IdMoldura } from '@/core/frames/tipos';
import { normalizarChamada } from '@/core/frames/tipos';
import type { ErrorCorrection } from '@/core/qr/types';
import type { Dpi, Unidade } from '@/lib/units';
import { DPI_PADRAO, converter } from '@/lib/units';

/**
 * Estado do gerador.
 *
 * `useReducer` e não uma biblioteca de estado: isto é um único objeto de
 * configuração, ninguém escreve nele de fora da árvore, e o custo real de
 * performance está na cadeia derivada (matriz → cena → verificação), que se
 * resolve com `useMemo` e Web Worker — não com store.
 */

export interface LogoSelecionado {
  readonly dataUrl: string;
  readonly nome: string;
  /** Lado do logo como fração do lado da matriz. */
  readonly fracaoLado: number;
}

export interface EstadoGerador {
  readonly tipoConteudo: TipoConteudo;
  /**
   * Os nove formulários, todos vivos ao mesmo tempo. Espiar outro tipo não
   * pode apagar o vCard que a pessoa acabou de preencher.
   */
  readonly formularios: Formularios;
  readonly nivel: ErrorCorrection;
  /** Lado do código na unidade corrente, sem conversão implícita. */
  readonly lado: number;
  readonly unidade: Unidade;
  readonly dpi: Dpi;
  readonly corEscura: string;
  readonly corClara: string;
  readonly logo: LogoSelecionado | null;

  readonly moldura: IdMoldura;
  /** Já normalizada: caixa alta e no máximo 24 caracteres. */
  readonly chamada: string;
  readonly corMoldura: string;
  readonly incluirFicha: boolean;
  readonly gradeColunas: number;
  readonly gradeLinhas: number;
}

export const ESTADO_INICIAL: EstadoGerador = {
  tipoConteudo: 'url',
  formularios: FORMULARIOS_INICIAIS,
  nivel: 'H',
  lado: 1024,
  unidade: 'px',
  dpi: DPI_PADRAO,
  corEscura: '#0e0f14',
  corClara: '#ffffff',
  logo: null,
  moldura: 'nenhuma',
  chamada: 'ESCANEIE-ME',
  corMoldura: '#0e0f14',
  incluirFicha: false,
  gradeColunas: 3,
  gradeLinhas: 3,
};

/** As quatro chamadas prontas do brand board. */
export const CHAMADAS_SUGERIDAS = ['ESCANEIE-ME', 'APONTE A CÂMERA', 'VER REGISTRO', 'MENU DIGITAL'] as const;

/** As três cores de moldura do board. Um acento só, sem decorativa. */
export const CORES_MOLDURA = [
  { nome: 'Carbon', hex: '#0e0f14' },
  { nome: 'Ultramarine', hex: '#2c36f0' },
  { nome: 'Steel', hex: '#6e7280' },
] as const;

/**
 * Escrita num campo do formulário corrente.
 *
 * Distribuída sobre `TipoConteudo` para que o `patch` seja verificado contra o
 * formulário certo: `{ conteudo: 'pix', patch: { ssid: 'x' } }` não compila.
 * Sem a distribuição, `patch` viraria a união de todos os formulários e
 * qualquer campo passaria em qualquer tipo.
 */
export type AcaoFormulario = {
  [K in TipoConteudo]: {
    readonly tipo: 'formulario';
    readonly conteudo: K;
    readonly patch: Partial<Formularios[K]>;
  };
}[TipoConteudo];

export type AcaoGerador =
  | AcaoFormulario
  | { readonly tipo: 'tipo-conteudo'; readonly valor: TipoConteudo }
  | { readonly tipo: 'nivel'; readonly valor: ErrorCorrection }
  | { readonly tipo: 'lado'; readonly valor: number }
  | { readonly tipo: 'unidade'; readonly valor: Unidade }
  | { readonly tipo: 'dpi'; readonly valor: Dpi }
  | { readonly tipo: 'cor-escura'; readonly valor: string }
  | { readonly tipo: 'cor-clara'; readonly valor: string }
  | { readonly tipo: 'inverter-cores' }
  | { readonly tipo: 'logo'; readonly valor: LogoSelecionado | null }
  | { readonly tipo: 'logo-tamanho'; readonly valor: number }
  | { readonly tipo: 'moldura'; readonly valor: IdMoldura }
  | { readonly tipo: 'chamada'; readonly valor: string }
  | { readonly tipo: 'cor-moldura'; readonly valor: string }
  | { readonly tipo: 'incluir-ficha'; readonly valor: boolean }
  | { readonly tipo: 'grade'; readonly colunas: number; readonly linhas: number }
  | { readonly tipo: 'restaurar'; readonly estado: EstadoGerador }
  | { readonly tipo: 'limpar' };

/** Faixa útil: abaixo disso não imprime, acima vira arquivo sem propósito. */
export const LADO_MINIMO_MM = 10;
export const LADO_MAXIMO_MM = 1000;

export function reducer(estado: EstadoGerador, acao: AcaoGerador): EstadoGerador {
  switch (acao.tipo) {
    case 'tipo-conteudo':
      return { ...estado, tipoConteudo: acao.valor };

    case 'formulario': {
      /*
       * A asserção existe porque a chave computada faz o TypeScript perder a
       * correspondência entre `conteudo` e o formulário correspondente. A união
       * distribuída em `AcaoFormulario` já garantiu isso no ponto de chamada,
       * que é onde o erro seria cometido.
       */
      const formularios = {
        ...estado.formularios,
        [acao.conteudo]: { ...estado.formularios[acao.conteudo], ...acao.patch },
      } as Formularios;

      return { ...estado, formularios };
    }

    case 'nivel': {
      /*
       * Logo central só é viável em H. Baixar o nível com um logo aplicado
       * produziria um código que não lê, então o logo sai junto — melhor
       * perder o logo explicitamente do que exportar um arquivo quebrado.
       */
      const logo = acao.valor === 'H' ? estado.logo : null;
      return { ...estado, nivel: acao.valor, logo };
    }

    case 'lado':
      return { ...estado, lado: acao.valor };

    case 'unidade': {
      if (acao.valor === estado.unidade) return estado;
      // Converte o valor para que o tamanho físico não mude ao trocar a unidade.
      const convertido = converter(estado.lado, estado.unidade, acao.valor, estado.dpi);
      const arredondado = acao.valor === 'px' ? Math.round(convertido) : Number(convertido.toFixed(1));
      return { ...estado, unidade: acao.valor, lado: arredondado };
    }

    case 'dpi': {
      /*
       * Em milímetros o tamanho físico é a fonte da verdade e o DPI só muda a
       * resolução. Em pixels, manter o número e trocar o DPI mudaria o tamanho
       * impresso sem o usuário pedir — então o valor é reconvertido.
       */
      if (estado.unidade === 'mm') return { ...estado, dpi: acao.valor };
      const mm = converter(estado.lado, 'px', 'mm', estado.dpi);
      return { ...estado, dpi: acao.valor, lado: Math.round(converter(mm, 'mm', 'px', acao.valor)) };
    }

    case 'cor-escura':
      return { ...estado, corEscura: acao.valor };

    case 'cor-clara':
      return { ...estado, corClara: acao.valor };

    case 'inverter-cores':
      return { ...estado, corEscura: estado.corClara, corClara: estado.corEscura };

    case 'logo':
      return { ...estado, logo: acao.valor };

    case 'logo-tamanho':
      return estado.logo === null ? estado : { ...estado, logo: { ...estado.logo, fracaoLado: acao.valor } };

    case 'moldura':
      return { ...estado, moldura: acao.valor };

    case 'chamada':
      // Normaliza na entrada: caixa alta e teto de 24 caracteres, sempre.
      return { ...estado, chamada: normalizarChamada(acao.valor) };

    case 'cor-moldura':
      return { ...estado, corMoldura: acao.valor };

    case 'incluir-ficha':
      return { ...estado, incluirFicha: acao.valor };

    case 'grade':
      return {
        ...estado,
        gradeColunas: Math.max(1, Math.min(8, Math.round(acao.colunas))),
        gradeLinhas: Math.max(1, Math.min(12, Math.round(acao.linhas))),
      };

    case 'restaurar':
      /*
       * Substitui o estado inteiro, não faz merge. Um registro do histórico é
       * uma configuração que já funcionou; misturá-la com a atual produziria
       * uma terceira que ninguém verificou.
       *
       * As chaves ausentes ganham o padrão para que um registro gravado por
       * uma versão anterior continue restaurável.
       */
      return { ...ESTADO_INICIAL, ...acao.estado };

    case 'limpar':
      // Preserva as preferências de saída; zera só o que é do artefato.
      return { ...estado, formularios: FORMULARIOS_INICIAIS, logo: null };
  }
}

/** Lado em milímetros, que é a unidade base da cena. */
export function ladoMm(estado: EstadoGerador): number {
  return converter(estado.lado, estado.unidade, 'mm', estado.dpi);
}
