import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/lib/site';

export const dynamic = 'force-static';

/**
 * Manifesto do PWA.
 *
 * Instalável não é enfeite aqui: um gerador que funciona offline materializa a
 * promessa de que o produto não depende deste site.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — QR estático, vetorial, de graça`,
    short_name: SITE_NAME,
    description: 'Gerador de QR Code estático que funciona offline. O conteúdo nunca sai do seu navegador.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3f4f7',
    theme_color: '#2c36f0',
    lang: 'pt-BR',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
