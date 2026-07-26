import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

/**
 * As tres familias sao baixadas e auto-hospedadas em tempo de build pelo
 * next/font. Em runtime nao existe requisicao a fonts.gstatic.com — o que
 * sustenta a promessa de que nada sai do navegador.
 *
 * O board pede "largura expandida quando disponivel". A familia `Archivo
 * Expanded` nao existe no Google Fonts (a requisicao do proprio board retorna
 * HTTP 400); a largura expandida e o eixo `wdth` da variavel Archivo, pedido
 * aqui em `axes` e aplicado via `font-stretch` na utilidade `type-display`.
 */
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo',
});

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-plex-sans',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — QR Code estático, vetorial, de graça`,
    template: `%s — ${SITE_NAME}`,
  },
  description:
    'Gere QR Codes estáticos em SVG, PNG e PDF vetorial. O endereço fica codificado dentro do próprio desenho: não expira, não depende deste site e nada sai do seu navegador.',
  applicationName: SITE_NAME,
  authors: [{ name: 'Igor Ferreira' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: SITE_NAME,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f4f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0f14' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
