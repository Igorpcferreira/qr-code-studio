import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Sem isto o Turbopack sobe a arvore procurando lockfile e pode eleger a pasta
   * do usuario como raiz do workspace, o que muda o que entra no build.
   */
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },

  /**
   * Export estatico puro: nenhuma rota de API, nenhum compute em runtime.
   * E a consequencia arquitetural da tese do produto — se nao ha servidor,
   * nao ha o que desligar quando a assinatura acabar.
   */
  output: 'export',

  /** Cada rota vira uma pasta com index.html: servivel por qualquer host estatico. */
  trailingSlash: true,

  reactStrictMode: true,

  /** Sem otimizacao de imagem em runtime — ela exigiria servidor. */
  images: { unoptimized: true },

  /**
   * O Next 16 removeu `next lint` e a chave `eslint` da config: o lint agora e
   * sempre etapa propria, que e como `npm run check` ja o executa.
   */
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
