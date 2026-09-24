// Stylelint здесь не проверяет стиль (это делает oxfmt), а только проектное правило
// «цвета только через var(--token)» (AGENTS.md → Styles): захардкоженный цвет в CSS-модуле
// игнорирует data-theme='light' и остаётся неправильным в светлой теме. Сами токены
// объявлены в src/app/styles/global.css — он в линт не входит (см. `lint:css` в package.json).
// Намеренные исключения (скрим/стилизация поверх фото, не зависящая от темы) помечаются
// `/* stylelint-disable-next-line … -- причина */` прямо в месте использования.
export default {
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': [
      [
        'rgb',
        'rgba',
        'hsl',
        'hsla',
        'hwb',
        'lab',
        'lch',
        'oklab',
        'oklch',
        'color',
      ],
      {
        message:
          'Use a var(--token) from global.css instead of a literal color.',
      },
    ],
  },
}
