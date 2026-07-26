import type { ErrorCorrection } from './types';
import { NIVEIS_CORRECAO, VERSAO_MAXIMA, VERSAO_MINIMA } from './types';

/**
 * Capacidade em bytes (modo Byte) por versao e nivel de correcao.
 * Tabela do ISO/IEC 18004. Indice 0 = versao 1.
 *
 * Por que uma copia em vez de perguntar a biblioteca: a tabela do `qrcode` so
 * existe em `lib/core/version.js`, que e API privada — nao aparece no ponto de
 * entrada do pacote e pode sumir num upgrade sem aviso. A ficha tecnica e o
 * componente-assinatura do produto e nao pode depender de acesso a interno.
 *
 * Dois testes protegem estes numeros (tests/unit/core/qr/capacity.test.ts):
 *
 *   1. Cross-check das 160 celulas contra `qrcode/lib/core/version.js`. Se um
 *      upgrade mudar qualquer valor, o CI quebra antes de a ficha mentir.
 *   2. Verificacao de fronteira, independente da origem da tabela: `capacidade`
 *      bytes cabem na versao N e `capacidade + 1` nao cabem.
 */
const CAPACIDADE_BYTES: Readonly<Record<ErrorCorrection, readonly number[]>> = {
  L: [
    17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425, 458, 520, 586, 644, 718, 792, 858, 929, 1003,
    1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732, 1840, 1952, 2068, 2188, 2303, 2431, 2563, 2699, 2809,
    2953,
  ],
  M: [
    14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287, 331, 362, 412, 450, 504, 560, 624, 666, 711, 779,
    857, 911, 997, 1059, 1125, 1190, 1264, 1370, 1452, 1538, 1628, 1722, 1809, 1911, 1989, 2099, 2213, 2331,
  ],
  Q: [
    11, 20, 32, 46, 60, 74, 86, 108, 130, 151, 177, 203, 241, 258, 292, 322, 364, 394, 442, 482, 509, 565,
    611, 661, 715, 751, 805, 868, 908, 982, 1030, 1112, 1168, 1228, 1283, 1351, 1423, 1499, 1579, 1663,
  ],
  H: [
    7, 14, 24, 34, 44, 58, 64, 84, 98, 119, 137, 155, 177, 194, 220, 250, 280, 310, 338, 382, 403, 439, 461,
    511, 535, 593, 625, 658, 698, 742, 790, 842, 898, 958, 983, 1051, 1093, 1139, 1219, 1273,
  ],
};

/**
 * Codewords de dados por versao e nivel — o tamanho do contentor, em bytes.
 *
 * Diferente de `CAPACIDADE_BYTES`, que e quanto **texto em modo Byte** cabe.
 * A distincao existe porque o codificador nao usa um modo so: ele quebra o
 * conteudo em segmentos e escolhe Numerico, Alfanumerico ou Byte para cada um,
 * conforme o que for mais denso. Um payload de Pix com 132 caracteres cabe numa
 * versao cuja capacidade em modo Byte e 98, porque a maior parte dele sao
 * digitos, e digito custa 3,33 bits em vez de 8.
 *
 * Por isso a ficha tecnica compara **bits ocupados contra bits disponiveis**, e
 * nao caracteres contra capacidade em modo Byte: sao unidades diferentes, e a
 * comparacao entre elas produz "132 / 98 bytes" — exatamente o tipo de numero
 * impossivel que este projeto corrige no material de origem.
 *
 * Mesma politica de guarda da tabela acima: copia propria, com cross-check das
 * 160 celulas contra a biblioteca em teste.
 */
const CODEWORDS_DE_DADOS: Readonly<Record<ErrorCorrection, readonly number[]>> = {
  L: [
    19, 34, 55, 80, 108, 136, 156, 194, 232, 274, 324, 370, 428, 461, 523, 589, 647, 721, 795, 861, 932, 1006,
    1094, 1174, 1276, 1370, 1468, 1531, 1631, 1735, 1843, 1955, 2071, 2191, 2306, 2434, 2566, 2702, 2812,
    2956,
  ],
  M: [
    16, 28, 44, 64, 86, 108, 124, 154, 182, 216, 254, 290, 334, 365, 415, 453, 507, 563, 627, 669, 714, 782,
    860, 914, 1000, 1062, 1128, 1193, 1267, 1373, 1455, 1541, 1631, 1725, 1812, 1914, 1992, 2102, 2216, 2334,
  ],
  Q: [
    13, 22, 34, 48, 62, 76, 88, 110, 132, 154, 180, 206, 244, 261, 295, 325, 367, 397, 445, 485, 512, 568,
    614, 664, 718, 754, 808, 871, 911, 985, 1033, 1115, 1171, 1231, 1286, 1354, 1426, 1502, 1582, 1666,
  ],
  H: [
    9, 16, 26, 36, 46, 60, 66, 86, 100, 122, 140, 158, 180, 197, 223, 253, 283, 313, 341, 385, 406, 442, 464,
    514, 538, 596, 628, 661, 701, 745, 793, 845, 901, 961, 986, 1054, 1096, 1142, 1222, 1276,
  ],
};

export { CAPACIDADE_BYTES, CODEWORDS_DE_DADOS };

/** Bytes de dados que a versao comporta, somando todos os modos. */
export function codewordsDeDados(versao: number, nivel: ErrorCorrection): number {
  if (!Number.isInteger(versao) || versao < VERSAO_MINIMA || versao > VERSAO_MAXIMA) {
    throw new RangeError(`Versao de QR fora do intervalo ${VERSAO_MINIMA}..${VERSAO_MAXIMA}: ${versao}`);
  }
  const valor = CODEWORDS_DE_DADOS[nivel][versao - 1];
  /* istanbul ignore next -- a checagem de faixa acima ja garante o indice */
  if (valor === undefined) {
    throw new RangeError(`Codewords indisponiveis para v${versao} nivel ${nivel}`);
  }
  return valor;
}

/** Teto de bytes de uma versao num nivel. Lanca se a versao estiver fora de 1..40. */
export function capacidadeBytes(versao: number, nivel: ErrorCorrection): number {
  if (!Number.isInteger(versao) || versao < VERSAO_MINIMA || versao > VERSAO_MAXIMA) {
    throw new RangeError(`Versao de QR fora do intervalo ${VERSAO_MINIMA}..${VERSAO_MAXIMA}: ${versao}`);
  }
  const valor = CAPACIDADE_BYTES[nivel][versao - 1];
  /* istanbul ignore next -- a checagem de faixa acima ja garante o indice */
  if (valor === undefined) {
    throw new RangeError(`Capacidade indisponivel para v${versao} nivel ${nivel}`);
  }
  return valor;
}

/** Maior payload possivel em cada nivel, ou seja a capacidade da versao 40. */
export const CAPACIDADE_MAXIMA_BYTES: Readonly<Record<ErrorCorrection, number>> = {
  L: capacidadeBytes(VERSAO_MAXIMA, 'L'),
  M: capacidadeBytes(VERSAO_MAXIMA, 'M'),
  Q: capacidadeBytes(VERSAO_MAXIMA, 'Q'),
  H: capacidadeBytes(VERSAO_MAXIMA, 'H'),
};

/** Menor versao que comporta `bytes` no nivel dado, ou null se nem a 40 comporta. */
export function versaoMinimaPara(bytes: number, nivel: ErrorCorrection): number | null {
  for (let versao = VERSAO_MINIMA; versao <= VERSAO_MAXIMA; versao++) {
    if (capacidadeBytes(versao, nivel) >= bytes) return versao;
  }
  return null;
}

/**
 * Nivel mais robusto que ainda comporta `bytes`, ou null se nenhum comporta.
 *
 * Usado para sugerir uma saida quando o conteudo nao cabe no nivel escolhido —
 * dizer "nao cabe" sem dizer "cabe em Q" seria deixar o usuario no escuro.
 */
export function melhorNivelPara(bytes: number): ErrorCorrection | null {
  for (let i = NIVEIS_CORRECAO.length - 1; i >= 0; i--) {
    const nivel = NIVEIS_CORRECAO[i];
    if (nivel !== undefined && CAPACIDADE_MAXIMA_BYTES[nivel] >= bytes) return nivel;
  }
  return null;
}
