import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /**
     * Node por padrao: o nucleo (`/core`) e logica pura e deve rodar sem DOM.
     * Testes que precisam de DOM declaram `// @vitest-environment happy-dom` no topo do arquivo.
     */
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/core/**', 'src/lib/**'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
