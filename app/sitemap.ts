import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Sitemap estático.
 *
 * Sem `lastModified` derivado do relógio: um sitemap que muda a cada build
 * ensina o buscador a desconfiar da data, e nenhuma destas páginas muda por
 * conta própria.
 */
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const rotas = [
    '',
    'qr-code-url',
    'qr-code-texto',
    'qr-code-pix',
    'qr-code-wifi',
    'qr-code-em-lote',
    'qr-estatico-vs-dinamico',
  ];

  return rotas.map((rota) => ({
    url: rota === '' ? `${SITE_URL}/` : `${SITE_URL}/${rota}/`,
    changeFrequency: 'monthly',
    priority: rota === '' ? 1 : 0.8,
  }));
}
