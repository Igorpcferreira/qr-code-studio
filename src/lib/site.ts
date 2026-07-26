/**
 * URL canonica do site, resolvida em tempo de build.
 *
 * Ordem: variavel explicita > URL de producao injetada pela Vercel > localhost.
 * Assim preview e producao ficam corretos sem editar codigo, e o projeto continua
 * buildavel offline por quem clonar o repositorio.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = 'QR Code Studio';

/**
 * Texto do selo de permanencia.
 *
 * O brand board determina, na secao 09: "Nunca reescrever o texto."
 * Fica aqui, como constante unica, para que nao exista uma segunda versao dele
 * espalhada pela interface, pelo PDF ou pelo material impresso.
 */
export const SELO_PERMANENCIA = 'Estático · não expira · não depende deste site';
