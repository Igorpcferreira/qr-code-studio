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
];

export default config;
