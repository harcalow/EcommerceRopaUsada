/**
 * Preset de Stylelint compartido (RT-018, ADR-009): los estilos solo pueden usar
 * variables de `@perchados/ui-tokens` (`var(--…)`); los colores y otros valores
 * literales se rechazan en los CSS Modules de `ui-web` y `apps/web`.
 */

import strictValue from 'stylelint-declaration-strict-value';

const TOKEN_ONLY_MESSAGE =
  'Usa un token de @perchados/ui-tokens con var(--…) en lugar de un valor literal (se esperaba "var(--…)", se encontró "${value}").';

/** @type {import('stylelint').Config} */
const config = {
  // Se pasa el objeto (no el nombre) para que se resuelva desde @perchados/config y no desde cada paquete
  plugins: [strictValue],
  rules: {
    'scale-unlimited/declaration-strict-value': [
      [
        '/color$/',
        'background',
        'fill',
        'stroke',
        'box-shadow',
        'font-family',
        'font-size',
        'font-weight',
        'border-radius',
      ],
      {
        ignoreValues: ['transparent', 'currentColor', 'inherit', 'initial', 'unset', 'none', '0', 'normal'],
        ignoreFunctions: false,
        disableFix: true,
        message: TOKEN_ONLY_MESSAGE,
      },
    ],
  },
};

export default config;
