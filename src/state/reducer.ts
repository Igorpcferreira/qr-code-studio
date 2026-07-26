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
  readonly conteudo: string;
  readonly nivel: ErrorCorrection;
  /** Lado do código na unidade corrente, sem conversão implícita. */
  readonly lado: number;
  readonly unidade: Unidade;
  readonly dpi: Dpi;
  readonly corEscura: string;
  readonly corClara: string;
  readonly logo: LogoSelecionado | null;
}

export const ESTADO_INICIAL: EstadoGerador = {
  conteudo: '',
  nivel: 'H',
  lado: 1024,
  unidade: 'px',
  dpi: DPI_PADRAO,
  corEscura: '#0e0f14',
  corClara: '#ffffff',
  logo: null,
};

export type AcaoGerador =
  | { readonly tipo: 'conteudo'; readonly valor: string }
  | { readonly tipo: 'nivel'; readonly valor: ErrorCorrection }
  | { readonly tipo: 'lado'; readonly valor: number }
  | { readonly tipo: 'unidade'; readonly valor: Unidade }
  | { readonly tipo: 'dpi'; readonly valor: Dpi }
  | { readonly tipo: 'cor-escura'; readonly valor: string }
  | { readonly tipo: 'cor-clara'; readonly valor: string }
  | { readonly tipo: 'inverter-cores' }
  | { readonly tipo: 'logo'; readonly valor: LogoSelecionado | null }
  | { readonly tipo: 'logo-tamanho'; readonly valor: number }
  | { readonly tipo: 'limpar' };

/** Faixa útil: abaixo disso não imprime, acima vira arquivo sem propósito. */
export const LADO_MINIMO_MM = 10;
export const LADO_MAXIMO_MM = 1000;

export function reducer(estado: EstadoGerador, acao: AcaoGerador): EstadoGerador {
  switch (acao.tipo) {
    case 'conteudo':
      return { ...estado, conteudo: acao.valor };

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

    case 'limpar':
      // Preserva as preferências de saída; zera só o que é do artefato.
      return { ...estado, conteudo: '', logo: null };
  }
}

/** Lado em milímetros, que é a unidade base da cena. */
export function ladoMm(estado: EstadoGerador): number {
  return converter(estado.lado, estado.unidade, 'mm', estado.dpi);
}
