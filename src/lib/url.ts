/**
 * Validação de URL.
 *
 * Herdada da versão 1.0 e corrigida num ponto que a investigação apontou: quem
 * digitava `loja.exemplo.com.br` recebia erro em vez de ter o esquema
 * completado. Exigir que o usuário escreva `https://` é atrito sem propósito —
 * o produto sabe qual esquema quer.
 */

const ESQUEMAS_ACEITOS = ['http:', 'https:'];

export type ResultadoUrl =
  | { readonly valida: true; readonly url: string; readonly completou: boolean }
  | { readonly valida: false; readonly mensagem: string };

/** Completa `https://` quando falta esquema, sem tocar em quem já tem. */
export function completarEsquema(bruto: string): string {
  const texto = bruto.trim();
  if (texto.length === 0) return texto;
  if (/^[a-z][a-z0-9+.-]*:/i.test(texto)) return texto;
  return `https://${texto}`;
}

export function validarUrl(bruto: string): ResultadoUrl {
  const texto = bruto.trim();

  if (texto.length === 0) {
    return { valida: false, mensagem: 'Informe um endereço para codificar.' };
  }
  if (/\s/.test(texto)) {
    return { valida: false, mensagem: 'Endereços não podem conter espaços.' };
  }

  const completado = completarEsquema(texto);
  const completou = completado !== texto;

  let url: URL;
  try {
    url = new URL(completado);
  } catch {
    return { valida: false, mensagem: 'Endereço inválido. Revise o texto e tente de novo.' };
  }

  if (!ESQUEMAS_ACEITOS.includes(url.protocol)) {
    return { valida: false, mensagem: 'Use um endereço http:// ou https://.' };
  }
  if (url.hostname.length === 0 || !url.hostname.includes('.')) {
    return { valida: false, mensagem: 'O domínio parece incompleto.' };
  }

  return { valida: true, url: completado, completou };
}
