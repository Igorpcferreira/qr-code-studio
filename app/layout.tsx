import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { RegistrarServiceWorker } from '@/components/RegistrarServiceWorker';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { SCRIPT_TEMA } from '@/lib/tema';
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
  authors: [{ name: 'Igor de Castro', url: 'https://www.linkedin.com/in/igor-cferreira/' }],
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
    /*
     * `suppressHydrationWarning` só aqui, e só por causa do script de tema
     * abaixo: ele grava `data-theme` no `<html>` antes da hidratação, e o
     * servidor não tem como saber a preferência que está no navegador de quem
     * pede a página. O atributo divergir é o comportamento correto, não um
     * defeito — sem ele a página piscaria no tema errado.
     *
     * A supressão vale para os atributos deste elemento e nada mais: não desce
     * um nível sequer da árvore, então nenhuma divergência real dentro da
     * aplicação passa a ser escondida por causa disto.
     */
    <html
      lang="pt-BR"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
         * Aplica o tema escolhido antes da primeira pintura. Precisa ser
         * síncrono e inline: ler a preferência depois da hidratação faria a
         * página piscar no tema errado. Não faz requisição — a promessa de que
         * nada sai do navegador continua de pé, e o E2E de rede zero cobre.
         */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
