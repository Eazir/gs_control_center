/**
 * Configuración de fronteras modulares para gs_control_center usando eslint-plugin-boundaries.
 * Hace cumplir la regla de oro de AGENTS.md:
 * "Un módulo solo consulta tablas de su propio schema. Nunca importes desde src/modules/<otro>/** salvo su index.ts público o module.manifest.ts"
 */

module.exports = {
  plugins: ['boundaries'],
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
      {
        type: 'contracts',
        pattern: '@gs/contracts',
        mode: 'folder',
      },
    ],
  },
  rules: {
    'boundaries/no-unknown': 'off',
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
        ],
      },
    ],
  },
};
