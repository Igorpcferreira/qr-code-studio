/**
 * Leitura de CSV.
 *
 * Escrito à mão e não com biblioteca por dois motivos concretos: o arquivo
 * chega do disco do usuário e não pode sair do navegador, então o custo de
 * auditar uma dependência de parsing é maior que o de escrever setenta linhas;
 * e o caso brasileiro exige detectar o ponto e vírgula, que é o que o Excel em
 * pt-BR grava quando a vírgula é separador decimal.
 *
 * Cobre o RFC 4180: aspas, aspas duplicadas dentro do campo, vírgula e quebra
 * de linha dentro do campo, CRLF e LF misturados.
 */

/** Separadores testados, na ordem de preferência quando há empate. */
const CANDIDATOS = [',', ';', '\t'] as const;

export type Delimitador = (typeof CANDIDATOS)[number];

export interface Csv {
  readonly delimitador: Delimitador;
  /** Linhas já divididas em campos, sem linhas totalmente vazias. */
  readonly linhas: readonly (readonly string[])[];
}

/**
 * Escolhe o delimitador contando ocorrências fora de aspas na primeira linha.
 *
 * Contar no arquivo inteiro daria peso a vírgulas decimais no corpo dos dados;
 * a primeira linha é a que carrega a estrutura.
 */
export function detectarDelimitador(texto: string): Delimitador {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? '';

  let melhor: Delimitador = ',';
  let maior = 0;

  for (const candidato of CANDIDATOS) {
    let contagem = 0;
    let entreAspas = false;

    for (const caractere of primeira) {
      if (caractere === '"') entreAspas = !entreAspas;
      else if (caractere === candidato && !entreAspas) contagem++;
    }

    if (contagem > maior) {
      maior = contagem;
      melhor = candidato;
    }
  }

  return melhor;
}

/**
 * Divide o texto em linhas e campos.
 *
 * O BOM é removido antes de tudo: o Excel grava UTF-8 com BOM, e sem essa
 * remoção o primeiro cabeçalho vira `﻿conteudo` e nunca casa com nada.
 */
export function analisarCsv(bruto: string, delimitador?: Delimitador): Csv {
  const texto = bruto.replace(/^﻿/, '');
  const separador = delimitador ?? detectarDelimitador(texto);

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let entreAspas = false;

  const fecharCampo = (): void => {
    linha.push(campo);
    campo = '';
  };

  const fecharLinha = (): void => {
    fecharCampo();
    // Linha só de campos vazios é ruído de planilha, não dado.
    if (linha.some((c) => c.trim().length > 0)) linhas.push(linha);
    linha = [];
  };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (entreAspas) {
      if (c === '"') {
        // Aspas duplicadas dentro do campo representam uma aspa literal.
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreAspas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"' && campo.length === 0) {
      entreAspas = true;
    } else if (c === separador) {
      fecharCampo();
    } else if (c === '\n') {
      fecharLinha();
    } else if (c !== '\r') {
      campo += c;
    }
  }

  // Arquivo sem quebra de linha no fim ainda tem uma última linha pendente.
  if (campo.length > 0 || linha.length > 0) fecharLinha();

  return { delimitador: separador, linhas };
}

// ---------------------------------------------------------------------------
// Interpretação das colunas
// ---------------------------------------------------------------------------

export interface LinhaLote {
  /** Número da linha na planilha, contando o cabeçalho — é o que o usuário vê. */
  readonly linha: number;
  readonly conteudo: string;
  /** Nome do arquivo pedido pela planilha, sem extensão. */
  readonly nome: string | null;
  /** Chamada de ação por linha. Impressa, nunca codificada. */
  readonly chamada: string | null;
}

export interface Colunas {
  readonly conteudo: number;
  readonly nome: number | null;
  readonly chamada: number | null;
}

const CABECALHOS_CONTEUDO = ['conteudo', 'conteúdo', 'url', 'link', 'texto', 'endereco', 'endereço'];
const CABECALHOS_NOME = ['nome', 'arquivo', 'nome do arquivo', 'id', 'identificador'];
const CABECALHOS_CHAMADA = ['chamada', 'rotulo', 'rótulo', 'legenda', 'cta'];

function normalizar(valor: string): string {
  return valor.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function acharColuna(cabecalho: readonly string[], nomes: readonly string[]): number | null {
  const alvos = nomes.map(normalizar);
  const indice = cabecalho.findIndex((c) => alvos.includes(normalizar(c)));
  return indice === -1 ? null : indice;
}

/**
 * A primeira linha é cabeçalho?
 *
 * Só responde sim quando reconhece um nome de coluna conhecido. Chutar por
 * heurística ("parece texto, deve ser cabeçalho") descartaria silenciosamente
 * a primeira URL de um arquivo sem cabeçalho, que é o erro mais caro possível
 * aqui: some um QR e ninguém percebe.
 */
export function temCabecalho(linhas: readonly (readonly string[])[]): boolean {
  const primeira = linhas[0];
  if (primeira === undefined) return false;

  return (
    acharColuna(primeira, CABECALHOS_CONTEUDO) !== null ||
    (acharColuna(primeira, CABECALHOS_NOME) !== null && acharColuna(primeira, CABECALHOS_CHAMADA) !== null)
  );
}

/** Posição das colunas. Sem cabeçalho, a ordem posicional é conteúdo, nome, chamada. */
export function mapearColunas(linhas: readonly (readonly string[])[], comCabecalho: boolean): Colunas {
  const cabecalho = linhas[0];
  if (!comCabecalho || cabecalho === undefined) return { conteudo: 0, nome: 1, chamada: 2 };

  return {
    conteudo: acharColuna(cabecalho, CABECALHOS_CONTEUDO) ?? 0,
    nome: acharColuna(cabecalho, CABECALHOS_NOME),
    chamada: acharColuna(cabecalho, CABECALHOS_CHAMADA),
  };
}

/** Converte o CSV cru nas linhas que o lote consome. */
export function interpretarCsv(csv: Csv, comCabecalho?: boolean): readonly LinhaLote[] {
  const cabecalho = comCabecalho ?? temCabecalho(csv.linhas);
  const colunas = mapearColunas(csv.linhas, cabecalho);
  const inicio = cabecalho ? 1 : 0;

  const resultado: LinhaLote[] = [];

  for (let i = inicio; i < csv.linhas.length; i++) {
    const campos = csv.linhas[i] ?? [];
    const conteudo = (campos[colunas.conteudo] ?? '').trim();
    if (conteudo.length === 0) continue;

    const nome = colunas.nome === null ? null : (campos[colunas.nome] ?? '').trim();
    const chamada = colunas.chamada === null ? null : (campos[colunas.chamada] ?? '').trim();

    resultado.push({
      linha: i + 1,
      conteudo,
      nome: nome === null || nome.length === 0 ? null : nome,
      chamada: chamada === null || chamada.length === 0 ? null : chamada,
    });
  }

  return resultado;
}
