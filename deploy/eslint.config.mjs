import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import boundariesPlugin from 'eslint-plugin-boundaries';

export default [
  {
    files: ['src/**/*.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      boundaries: boundariesPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts'],
        },
      },
      'boundaries/elements': [
        {
          type: 'module',
          pattern: 'src/modules/*',
          mode: 'folder',
          capture: ['moduleName'],
        },
        {
          type: 'core',
          pattern: 'src/core/*',
          mode: 'folder',
        },
      ],
    },
    rules: {
      // Regla de AGENTS.md: any está estrictamente prohibido
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Regla de AGENTS.md: fronteras estrictas entre módulos (solo index o module.manifest)
      'boundaries/entry-point': [
        'error',
        {
          default: 'disallow',
          message:
            'VIOLACIÓN DE FRONTERA DE MÓDULO (AGENTS.md): No puedes importar el archivo interno "${to.internalPath}" de "${to.captured.moduleName}". Solo puedes importar su interfaz pública (index.ts o module.manifest.ts).',
          rules: [
            {
              target: 'module',
              allow: ['index.ts', 'module.manifest.ts'],
            },
            {
              target: 'core',
              allow: ['index.ts'],
            },
          ],
        },
      ],

    },
  },
];
