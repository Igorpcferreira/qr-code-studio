import * as fmt from '@/lib/format';
import { ajustarParaModuloInteiro, arredondarPx, converter } from '@/lib/units';
import { derivar } from '@/state/derivar';
import type { EstadoGerador } from '@/state/reducer';
import { codificarPng } from '../render/png';
import { rasterizarCena } from '../render/raster';
import { renderizarSvg } from '../render/svg';
import { verificarLeitura } from '../verify/verify';
import type { LinhaLote } from './csv';
import type { EntradaZip } from './zip';

/**
 * Geração em lote.
 *
 * A tese arquitetural do projeto cobra a fatura aqui: como a composição é
 * função pura, gerar mil peças é um laço. Este arquivo não tem uma linha de
 * regra de moldura, cor ou tamanho — ele reaproveita `derivar`, a mesma cadeia
 * que alimenta a prévia.
 *
 * Reaproveitar `derivar` é o ponto, não um atalho: é o que garante que a peça
 * do lote seja idêntica à que o usuário viu na tela antes de mandar processar.
 * Uma segunda implementação da composição, ainda que fiel hoje, teria a chance
 * de divergir amanhã, e a divergência só apareceria depois de mil etiquetas
 * impressas.
 *
 * Roda sem DOM de propósito: SVG é string, PNG passa pelo codificador próprio,
 * e a verificação usa o rasterizador puro. Assim o lote inteiro cabe num Web
 * Worker e continua testável no Node.
 */

export type FormatoLote = 'svg' | 'png';

export interface OpcoesLote {
  /** Configuração-modelo: o que a interface mostra na prévia. */
  readonly base: EstadoGerador;
  readonly formato: FormatoLote;
  /**
   * Decodificar cada peça de volta antes de empacotar.
   *
   * Custa alguns milissegundos por linha e é o que impede um ZIP com mil
   * arquivos dos quais três não leem — que é justamente o defeito que ninguém
   * descobre antes da impressão.
   */
  readonly verificar: boolean;
}

export interface ItemLote {
  /** Linha na planilha, como o usuário a vê. */
  readonly linha: number;
  /** Célula da planilha, sem tratamento. */
  readonly conteudo: string;
  /**
   * O que foi de fato codificado — pode diferir da célula, porque o esquema
   * `https://` é completado aqui como é na interface. O relatório mostra os
   * dois para que a diferença não passe despercebida.
   */
  readonly payload: string;
  readonly nomeArquivo: string;
  readonly ok: boolean;
  /** Preenchido quando `ok` é falso. */
  readonly motivo: string | null;
}

export interface ResultadoItem {
  readonly item: ItemLote;
  /** Ausente quando a linha falhou: não se empacota arquivo que não lê. */
  readonly entrada: EntradaZip | null;
}

/** Nome de arquivo seguro, sem colisão com o que a planilha pediu. */
function nomeDoArquivo(linha: LinhaLote, payload: string, extensao: string): string {
  if (linha.nome === null) return fmt.nomeDeArquivo(payload, extensao);

  const limpo = linha.nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return `${limpo.length === 0 ? `linha-${linha.linha}` : limpo}.${extensao}`;
}

/**
 * Estado do modelo com o conteúdo de uma linha no lugar.
 *
 * O lote atende URL e texto — os dois tipos cujo conteúdo é um valor único.
 * Um CSV que preenchesse os doze campos de um vCard ou os seis de um Pix seria
 * um mapeador de esquema, que é outro produto; aqui a coluna é o payload.
 */
export function estadoDaLinha(base: EstadoGerador, linha: LinhaLote): EstadoGerador {
  const texto = base.tipoConteudo === 'texto';

  return {
    ...base,
    tipoConteudo: texto ? 'texto' : 'url',
    formularios: texto
      ? { ...base.formularios, texto: { valor: linha.conteudo } }
      : { ...base.formularios, url: { valor: linha.conteudo } },
    chamada: linha.chamada ?? base.chamada,
  };
}

/** Processa uma linha. Não lança: linha ruim vira item com motivo. */
export async function gerarItem(linha: LinhaLote, opcoes: OpcoesLote): Promise<ResultadoItem> {
  const estado = estadoDaLinha(opcoes.base, linha);
  const derivado = derivar(estado);

  const falha = (motivo: string): ResultadoItem => ({
    item: {
      linha: linha.linha,
      conteudo: linha.conteudo,
      payload: derivado.conteudo.payload,
      nomeArquivo: '',
      ok: false,
      motivo,
    },
    entrada: null,
  });

  if (derivado.conteudo.problema !== null) return falha(derivado.conteudo.problema);

  if (!derivado.resultado.ok) {
    const erro = derivado.resultado.erro;
    return falha(
      erro.tipo === 'excede-capacidade'
        ? `${erro.bytes} bytes não cabem no nível ${erro.nivel}, que comporta ${erro.capacidade}.`
        : erro.tipo === 'vazio'
          ? 'Linha sem conteúdo.'
          : erro.detalhe,
    );
  }

  const cena = derivado.cena;
  const artefato = derivado.artefato;
  /* istanbul ignore next -- resultado.ok garante os dois */
  if (cena === null || artefato === null) return falha('Não foi possível compor a peça.');

  if (opcoes.verificar) {
    const veredicto = verificarLeitura(cena);
    if (!veredicto.ok) {
      return falha(veredicto.causa?.mensagem ?? 'O código gerado não foi decodificado de volta.');
    }
  }

  const nomeArquivo = nomeDoArquivo(linha, artefato.payload, opcoes.formato);

  const dados =
    opcoes.formato === 'svg'
      ? new TextEncoder().encode(renderizarSvg(cena, { incluirMetadados: true }))
      : await codificarPng(rasterizarCena(cena, escalaPng(opcoes.base, artefato.sizeComQuietZone)));

  return {
    item: {
      linha: linha.linha,
      conteudo: linha.conteudo,
      payload: artefato.payload,
      nomeArquivo,
      ok: true,
      motivo: null,
    },
    entrada: { nome: nomeArquivo, dados },
  };
}

/**
 * Escala em px/mm que dá um número inteiro de pixels por módulo.
 *
 * Mesma regra do PNG avulso: fração de pixel por módulo produz costura entre
 * eles, e a costura é lida como ruído pelo scanner.
 */
function escalaPng(base: EstadoGerador, modulosComQuietZone: number): number {
  const ladoPx = converter(base.lado, base.unidade, 'px', base.dpi);
  const ajustado = ajustarParaModuloInteiro(arredondarPx(ladoPx), modulosComQuietZone);
  const ladoCodigoMm = converter(base.lado, base.unidade, 'mm', base.dpi);

  // px/mm. A moldura amplia a cena, e a mesma escala se aplica à peça inteira.
  return ajustado / ladoCodigoMm;
}
