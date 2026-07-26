/**
 * Conversao entre pixel e milimetro.
 *
 * O milimetro e a unidade base do projeto, nao o pixel: o produto existe para
 * impressao, e "1024 px" so significa alguma coisa depois de escolhido o DPI.
 * Pixel e uma conversao de saida.
 */

export const MM_POR_POLEGADA = 25.4;

export type Unidade = 'px' | 'mm';

export const DPIS_SUPORTADOS = [150, 300, 600] as const;
export type Dpi = (typeof DPIS_SUPORTADOS)[number];

export const DPI_PADRAO: Dpi = 300;

export function mmParaPx(mm: number, dpi: number): number {
  return (mm / MM_POR_POLEGADA) * dpi;
}

export function pxParaMm(px: number, dpi: number): number {
  return (px / dpi) * MM_POR_POLEGADA;
}

export function converter(valor: number, de: Unidade, para: Unidade, dpi: number): number {
  if (de === para) return valor;
  return de === 'mm' ? mmParaPx(valor, dpi) : pxParaMm(valor, dpi);
}

/**
 * Arredonda para pixel inteiro sem nunca devolver zero.
 *
 * Um lado de 0 px produziria canvas vazio e divisao por zero na rasterizacao.
 */
export function arredondarPx(px: number): number {
  return Math.max(1, Math.round(px));
}

/**
 * Ajusta o lado para que cada modulo caia num numero inteiro de pixels.
 *
 * Sem isto, o modulo cai em fracao de pixel e o PNG sai com costuras — linhas
 * claras entre modulos que confundem scanner. Devolve o lado utilizavel mais
 * proximo, sempre menor ou igual ao pedido.
 */
export function ajustarParaModuloInteiro(ladoPx: number, modulosComQuietZone: number): number {
  const escala = Math.max(1, Math.floor(ladoPx / modulosComQuietZone));
  return escala * modulosComQuietZone;
}

/** Formata um comprimento como a interface mostra: "1024 px" ou "86,7 mm". */
export function formatarComprimento(valor: number, unidade: Unidade): string {
  if (unidade === 'px') return `${Math.round(valor)} px`;
  return `${valor.toFixed(1).replace('.', ',')} mm`;
}
