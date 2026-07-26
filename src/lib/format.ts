/**
 * Formatação em pt-BR para a ficha técnica.
 *
 * `Intl.NumberFormat` fixado em pt-BR e não na locale do navegador: a ficha é
 * um documento técnico e precisa sair igual para todo mundo, inclusive quando
 * impressa no PDF.
 */

const NUMERO = new Intl.NumberFormat('pt-BR');

/** 1782 -> "1.782" */
export function numero(valor: number): string {
  return NUMERO.format(valor);
}

/** Capacidade como o board mostra: "1.782 / 2.303 bytes". */
export function bytes(usados: number, teto: number): string {
  return `${numero(usados)} / ${numero(teto)} bytes`;
}

/** "41 × 41" — com o sinal de multiplicação, não a letra x. */
export function modulos(lado: number): string {
  return `${lado} × ${lado}`;
}

const RECUPERACAO: Readonly<Record<string, number>> = { L: 7, M: 15, Q: 25, H: 30 };

/** "H · 30%" */
export function correcao(nivel: string): string {
  const pct = RECUPERACAO[nivel];
  return pct === undefined ? nivel : `${nivel} · ${pct}%`;
}

/** Decimal com vírgula e casas fixas. */
export function decimal(valor: number, casas = 1): string {
  return valor.toFixed(casas).replace('.', ',');
}

/**
 * Identificador do artefato, no formato do board ("QR-2026-0731").
 *
 * Derivado do conteúdo, não do relógio: dois artefatos iguais precisam ter o
 * mesmo identificador, e um gerador cujo resultado muda a cada segundo não
 * seria reproduzível. Sem data também não há como vazar quando foi gerado.
 */
export function identificador(payload: string, versao: number, nivel: string): string {
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const sufixo = (hash >>> 0).toString(36).toUpperCase().slice(0, 4).padStart(4, '0');
  return `QR-V${versao}${nivel}-${sufixo}`;
}

/** Nome de arquivo seguro, derivado do conteúdo. */
export function nomeDeArquivo(payload: string, extensao: string): string {
  let base = 'qr-code';
  try {
    const url = new URL(payload);
    base = `qr-${url.hostname.replace(/[^a-z0-9]+/gi, '-')}`;
  } catch {
    const limpo = payload
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    if (limpo.length > 0) base = `qr-${limpo.slice(0, 40)}`;
  }
  return `${base.replace(/-+/g, '-').replace(/-$/, '')}.${extensao}`;
}
