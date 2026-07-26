import type { DadosPix, ResultadoConteudo } from './tipos';

/**
 * Pix — BR Code estático.
 *
 * O payload segue o EMV® QR Code Merchant-Presented Mode (EMV-MPM) com o perfil
 * do Banco Central: uma sequência de blocos TLV (identificador de 2 dígitos,
 * tamanho de 2 dígitos, valor), fechada por um CRC-16 de quatro dígitos hex.
 *
 * Por que este formato é o encaixe exato da tese do produto: um BR Code
 * estático carrega a chave, o nome e a cidade do recebedor **dentro do próprio
 * desenho**. Não existe redirecionamento nem consulta a servidor — o aplicativo
 * do banco lê os campos ali mesmo. Um Pix dinâmico, por contraste, codifica uma
 * URL que o banco precisa consultar para descobrir o valor, e essa URL pode ser
 * desligada. O produto só faz o primeiro, e aqui isso é uma propriedade do
 * formato, não uma escolha de implementação.
 *
 * Referência de campos: EMV-MPM v1.1 e o Manual do BR Code (BCB).
 */

/** Identificador global do arranjo Pix, dentro do template 26. */
export const GUI_PIX = 'br.gov.bcb.pix';

/** Sem `txid`, a especificação manda escrever exatamente isto. */
export const TXID_VAZIO = '***';

export const MAX_NOME = 25;
export const MAX_CIDADE = 15;
export const MAX_TXID = 25;
/** O template 26 inteiro (GUI + chave + descrição) não pode passar disto. */
export const MAX_TEMPLATE_26 = 99;

// ---------------------------------------------------------------------------
// CRC-16/CCITT-FALSE
// ---------------------------------------------------------------------------

/**
 * CRC-16/CCITT-FALSE: polinômio 0x1021, inicial 0xFFFF, sem reflexão de
 * entrada ou saída e sem XOR final.
 *
 * O nome importa porque existem pelo menos cinco CRCs chamados "CCITT" que
 * discordam entre si. O vetor canônico está travado em teste: o CRC de
 * `123456789` nesta variante é 0x29B1, e em nenhuma das outras.
 */
export function crc16(texto: string): number {
  const bytes = new TextEncoder().encode(texto);
  let crc = 0xffff;

  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc;
}

function hex4(valor: number): string {
  return valor.toString(16).toUpperCase().padStart(4, '0');
}

// ---------------------------------------------------------------------------
// TLV
// ---------------------------------------------------------------------------

export interface NoTlv {
  /** Dois dígitos, como aparece no payload. */
  readonly id: string;
  readonly valor: string;
  /** Preenchido só quando o identificador é de um template composto. */
  readonly filhos: readonly NoTlv[] | null;
}

/**
 * Identificadores cujo valor é, por sua vez, uma sequência TLV.
 *
 * 26–51 são os templates de conta do comerciante (o Pix usa o 26), 62 é o de
 * dados adicionais e 64 o de idioma. Fora dessa faixa o valor é texto, e tentar
 * reinterpretá-lo como TLV produziria árvore inventada.
 */
const COMPOSTOS: ReadonlySet<string> = new Set([
  ...Array.from({ length: 26 }, (_, i) => String(26 + i).padStart(2, '0')),
  '62',
  '64',
]);

function bloco(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, '0')}${valor}`;
}

/**
 * Desmonta o payload de volta em blocos. `null` quando o texto não é TLV bem
 * formado — tamanho anunciado maior que o restante, ou cabeçalho não numérico.
 */
export function analisarTlv(texto: string): readonly NoTlv[] | null {
  const nos: NoTlv[] = [];
  let i = 0;

  while (i < texto.length) {
    if (i + 4 > texto.length) return null;

    const id = texto.slice(i, i + 2);
    const tamanhoBruto = texto.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(tamanhoBruto)) return null;

    const fim = i + 4 + Number(tamanhoBruto);
    if (fim > texto.length) return null;

    const valor = texto.slice(i + 4, fim);
    nos.push({ id, valor, filhos: COMPOSTOS.has(id) ? analisarTlv(valor) : null });
    i = fim;
  }

  return nos;
}

/** Busca por caminho de identificadores: `['26', '01']` devolve a chave. */
export function campoTlv(nos: readonly NoTlv[] | null, caminho: readonly string[]): string | null {
  let atual: readonly NoTlv[] | null = nos;

  for (let i = 0; i < caminho.length; i++) {
    if (atual === null) return null;
    const no: NoTlv | undefined = atual.find((n) => n.id === caminho[i]);
    if (no === undefined) return null;
    if (i === caminho.length - 1) return no.valor;
    atual = no.filhos;
  }

  return null;
}

/**
 * Confere o CRC de um BR Code montado.
 *
 * O checksum cobre o payload inteiro **incluindo** o cabeçalho `6304` do
 * próprio campo de CRC — detalhe que a especificação enuncia em uma linha e que
 * derruba metade das implementações de primeira viagem.
 */
export function conferirCrc(brCode: string): boolean {
  if (brCode.length < 8) return false;

  const marcador = brCode.length - 8;
  if (brCode.slice(marcador, marcador + 4) !== '6304') return false;

  return brCode.slice(marcador + 4).toUpperCase() === hex4(crc16(brCode.slice(0, marcador + 4)));
}

// ---------------------------------------------------------------------------
// Chave
// ---------------------------------------------------------------------------

export type TipoChavePix = 'cpf' | 'cnpj' | 'telefone' | 'email' | 'aleatoria';

export interface ChavePix {
  readonly tipo: TipoChavePix;
  /** Já no formato que vai para o payload. */
  readonly valor: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/**
 * Dígitos verificadores de CPF.
 *
 * Vale a checagem completa e não só a contagem de dígitos: uma chave Pix com um
 * dígito trocado gera um QR perfeitamente legível para um destino que não
 * existe, e o erro só aparece na hora de pagar.
 */
function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;

  for (const casas of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < casas; i++) soma += Number(digitos[i]) * (casas + 1 - i);
    const resto = soma % 11;
    const dv = resto < 2 ? 0 : 11 - resto;
    if (dv !== Number(digitos[casas])) return false;
  }

  return true;
}

const PESOS_CNPJ = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Dígitos verificadores de CNPJ, na regra que passou a valer em julho de 2026.
 *
 * A base admite letras e o cálculo usa `código ASCII − 48` no lugar do valor
 * numérico. Para um CNPJ só de dígitos a conta é idêntica à antiga, então uma
 * implementação só atende aos dois casos.
 */
function cnpjValido(base: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(base)) return false;
  if (/^(.)\1{13}$/.test(base)) return false;

  for (const casas of [12, 13]) {
    let soma = 0;
    for (let i = 0; i < casas; i++) {
      const peso = PESOS_CNPJ[PESOS_CNPJ.length - casas + i] ?? 0;
      soma += (base.charCodeAt(i) - 48) * peso;
    }
    const resto = soma % 11;
    const dv = resto < 2 ? 0 : 11 - resto;
    if (dv !== Number(base[casas])) return false;
  }

  return true;
}

/**
 * Classifica e normaliza a chave. `null` quando não corresponde a nenhum dos
 * cinco tipos.
 *
 * Regra de desempate que precisa ser explícita: um celular com DDD e um CPF têm
 * ambos 11 dígitos. A especificação resolve exigindo o telefone em formato
 * internacional (`+55…`), então aqui o `+` é o que decide — sem ele, 11 dígitos
 * são CPF.
 */
export function classificarChave(bruto: string): ChavePix | null {
  const texto = bruto.trim();
  if (texto.length === 0) return null;

  if (UUID.test(texto)) return { tipo: 'aleatoria', valor: texto.toLowerCase() };

  if (texto.includes('@')) {
    return EMAIL.test(texto) && texto.length <= 77 ? { tipo: 'email', valor: texto.toLowerCase() } : null;
  }

  if (texto.startsWith('+')) {
    const digitos = texto.slice(1).replace(/\D/g, '');
    // E.164 termina em 15 dígitos; abaixo de 12 não fecha país, DDD e assinante.
    return digitos.length >= 12 && digitos.length <= 15 ? { tipo: 'telefone', valor: `+${digitos}` } : null;
  }

  const limpo = texto.replace(/[.\-/\s]/g, '').toUpperCase();
  if (/^\d{11}$/.test(limpo)) return cpfValido(limpo) ? { tipo: 'cpf', valor: limpo } : null;
  if (/^[0-9A-Z]{14}$/.test(limpo)) return cnpjValido(limpo) ? { tipo: 'cnpj', valor: limpo } : null;

  return null;
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

/** Combinantes de acento, para a decomposição NFD. */
const ACENTOS = /[̀-ͯ]/g;
/** Tudo fora do ASCII imprimível (espaço a til). */
const FORA_DO_ASCII = /[^ -~]/g;

/**
 * Reduz a ASCII imprimível.
 *
 * O conjunto de caracteres do BR Code é o "Common Character Set" do EMV, que
 * não inclui acento. Remover a acentuação preservando a letra base ("SÃO PAULO"
 * → "SAO PAULO") é o comportamento que os aplicativos de banco esperam; mandar
 * o acento cru produz nome truncado ou ilegível na tela de quem paga.
 */
export function paraAscii(texto: string): string {
  return texto.normalize('NFD').replace(ACENTOS, '').replace(FORA_DO_ASCII, '').replace(/\s+/g, ' ').trim();
}

/** Normaliza o valor digitado para o formato do campo 54: `123.45`. */
export function normalizarValor(bruto: string): number | null {
  const texto = bruto.trim();
  if (texto.length === 0) return null;

  // Aceita "1.234,56" e "1234.56": a vírgula manda quando as duas aparecem.
  const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto;
  const numero = Number(normalizado);

  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

export interface BrCode {
  readonly payload: string;
  readonly chave: ChavePix;
  readonly valor: number | null;
}

/**
 * Monta o payload. Assume dados já validados por `montarPix`.
 *
 * Os identificadores saem em ordem crescente, como a especificação determina.
 * O ponto de iniciação (`01`) fica de fora: ele só é obrigatório quando vale
 * `12` ("use uma vez"), que é caso de código dinâmico. Um estático sem o campo
 * é lido como `11`, reutilizável — que é exatamente o que este produto faz.
 */
export function montarBrCode(dados: DadosPix, chave: ChavePix): BrCode {
  const nome = paraAscii(dados.nome).slice(0, MAX_NOME);
  const cidade = paraAscii(dados.cidade).slice(0, MAX_CIDADE);
  const valor = normalizarValor(dados.valor);

  const txidBruto = paraAscii(dados.identificador).replace(/[^0-9A-Za-z]/g, '');
  const txid = txidBruto.length === 0 ? TXID_VAZIO : txidBruto.slice(0, MAX_TXID);

  /*
   * A descrição é o único campo elástico do template 26, e o template inteiro
   * tem teto de 99 caracteres. Em vez de recusar, corta no que couber: perder o
   * fim de uma descrição opcional é menos grave que impedir o pagamento.
   */
  const semDescricao = bloco('00', GUI_PIX) + bloco('01', chave.valor);
  const folga = MAX_TEMPLATE_26 - semDescricao.length - 4;
  const descricao = folga <= 0 ? '' : paraAscii(dados.descricao).slice(0, folga);

  const template26 = semDescricao + (descricao.length === 0 ? '' : bloco('02', descricao));

  const semCrc =
    bloco('00', '01') +
    bloco('26', template26) +
    // 0000 = sem categoria definida; 986 = BRL na ISO 4217.
    bloco('52', '0000') +
    bloco('53', '986') +
    (valor === null ? '' : bloco('54', valor.toFixed(2))) +
    bloco('58', 'BR') +
    bloco('59', nome) +
    bloco('60', cidade) +
    bloco('62', bloco('05', txid)) +
    '6304';

  return { payload: semCrc + hex4(crc16(semCrc)), chave, valor };
}

/**
 * Monta o BR Code a partir do formulário, ou explica o que falta.
 *
 * As mensagens são específicas de propósito: "chave inválida" não ajuda
 * ninguém a descobrir que trocou um dígito do CPF.
 */
export function montarPix(dados: DadosPix): ResultadoConteudo {
  const vazio = { payload: '', observacao: null };

  if (dados.chave.trim().length === 0) {
    return { ...vazio, problema: 'Informe a chave Pix do recebedor.' };
  }

  const chave = classificarChave(dados.chave);
  if (chave === null) {
    return {
      ...vazio,
      problema:
        'Chave Pix inválida. Use CPF ou CNPJ com dígitos verificadores corretos, ' +
        'e-mail, telefone no formato +55DDNÚMERO, ou chave aleatória.',
    };
  }

  if (paraAscii(dados.nome).length === 0) {
    return { ...vazio, problema: 'Informe o nome do recebedor — ele aparece na tela de quem paga.' };
  }
  if (paraAscii(dados.cidade).length === 0) {
    return { ...vazio, problema: 'Informe a cidade do recebedor. A especificação exige o campo.' };
  }
  if (dados.valor.trim().length > 0 && normalizarValor(dados.valor) === null) {
    return { ...vazio, problema: 'Valor inválido. Use apenas números, como 49,90.' };
  }

  const { payload, valor } = montarBrCode(dados, chave);

  return {
    payload,
    problema: null,
    observacao:
      valor === null
        ? 'Sem valor definido: quem paga digita o quanto quiser.'
        : `Valor fixo de R$ ${valor.toFixed(2).replace('.', ',')}.`,
  };
}

/**
 * Confere um BR Code já montado: CRC correto e campos obrigatórios no lugar.
 *
 * É o segundo nível da verificação de leitura. Decodificar o QR prova que a
 * string sobreviveu ao desenho; isto prova que a string é um Pix válido. São
 * dois defeitos diferentes, e nenhum dos dois é coberto pelo outro.
 */
export function conferirBrCode(payload: string): { readonly ok: boolean; readonly motivo: string | null } {
  if (!conferirCrc(payload)) return { ok: false, motivo: 'CRC-16 não confere.' };

  const nos = analisarTlv(payload);
  if (nos === null) return { ok: false, motivo: 'Estrutura TLV malformada.' };

  if (campoTlv(nos, ['26', '00']) !== GUI_PIX) {
    return { ok: false, motivo: `O template 26 não declara o domínio ${GUI_PIX}.` };
  }

  const obrigatorios = [
    { caminho: ['26', '01'], nome: 'chave' },
    { caminho: ['59'], nome: 'nome do recebedor' },
    { caminho: ['60'], nome: 'cidade' },
  ] as const;

  for (const { caminho, nome } of obrigatorios) {
    const valor = campoTlv(nos, caminho);
    if (valor === null || valor.length === 0) return { ok: false, motivo: `Campo ausente: ${nome}.` };
  }

  return { ok: true, motivo: null };
}
