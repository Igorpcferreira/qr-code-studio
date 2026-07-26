import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [
      '.next/**',
      'out/**',
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypeScript,

  {
    /**
     * A deteccao automatica de versao do eslint-plugin-react usa
     * `context.getFilename()`, removida no ESLint 10, e quebra o lint inteiro.
     * Declarar a versao explicitamente evita esse caminho de codigo.
     */
    settings: {
      react: { version: '19.2' },
    },
  },

  {
    rules: {
      /** O brief exige TypeScript strict sem `any`. Isso e erro, nao aviso. */
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      /** Nada de analytics nem chamada de rede escondida: o produto promete que nada sai do navegador. */
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'O conteudo nunca sai do navegador. Se precisar de rede, discuta antes.' },
      ],

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    /** Scripts de build e configuracao rodam em Node, fora das regras do app. */
    files: ['scripts/**/*.mjs', '*.config.{ts,mjs}'],
    rules: {
      'no-console': 'off',
      'no-restricted-globals': 'off',
    },
  },

  {
    /**
     * O service worker e a unica excecao legitima a proibicao de `fetch`.
     *
     * A regra existe para impedir que codigo do app abra caminho de rede sem
     * discussao. Aqui o `fetch` faz o oposto: intercepta requisicoes que o
     * navegador ja ia fazer e as responde do cache, que e o que permite o
     * gerador funcionar offline.
     */
    files: ['public/sw.js'],
    languageOptions: {
      globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly' },
    },
    rules: {
      'no-restricted-globals': 'off',
    },
  },
];

export default config;
