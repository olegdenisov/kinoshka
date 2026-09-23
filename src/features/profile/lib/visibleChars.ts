// Имя из одних невидимых символов (ZWSP U+200B, ZWJ, soft hyphen, RTL override, braille blank
// U+2800 и т.п.) не считается пробелом для String.prototype.trim(), но рисуется пустым кругом и
// пустой строкой имени, а скринридер читает «Your profile:» без имени. «Видимый» символ — любой,
// кроме control/format/разделителей/default-ignorable code points.
const INVISIBLE_ONLY =
  /^[\p{Cf}\p{Cc}\p{Zs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}\u2800]*$/u

export const hasVisibleChar = (value: string): boolean =>
  !INVISIBLE_ONLY.test(value)

// Тот же класс символов, что и INVISIBLE_ONLY выше, но применённый к одному code point —
// нужен getInitials.ts, которому надо пропускать ведущие невидимые code points внутри слова (не
// только решать судьбу всего имени целиком). Имя вида ZWSP+"Ada" целиком проходит
// normalizeProfileName/схему (есть видимые буквы), но firstChar без этой проверки взял бы именно
// невидимый первый code point — initials рисовались бы пустым кружком при непустом имени.
export const isInvisibleCodePoint = (codePoint: string): boolean =>
  INVISIBLE_ONLY.test(codePoint)
