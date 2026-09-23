import { createStorageSlot } from '@shared/lib'
import { z } from 'zod'

import { hasVisibleChar } from '../lib/visibleChars'

export const PROFILE_NAME_MAX_LENGTH = 40

// Длина считается в code points (Array.from), а не в UTF-16 code units (`.length` /
// `z.string().max()`): иначе имя из суррогатных пар (эмодзи, редкие символы) могло бы
// не пройти валидацию на ровно допустимой длине либо пройти и быть обрезано неровно.
// Это защита именно от разрезания суррогатных пар; графемные кластеры (флаги,
// ZWJ-последовательности, комбинирующие знаки) состоят из нескольких code points
// и считаются как несколько символов.
// Единственная точка нормализации ввода: trim → обрезка по code points → trim (срез мог упасть
// сразу после пробела) → пустая строка, если видимых символов не осталось. Всё, что вернёт эта
// функция, обязано проходить profileNameSchema ниже: иначе запись и чтение разойдутся, и имя
// молча пропадёт после перезагрузки (уже случавшаяся регрессия). Обрезаем по code points, а не
// .slice() по строке — тот режет суррогатную пару пополам (графемные кластеры вроде
// флагов/ZWJ-последовательностей всё же могут быть разрезаны — сознательное упрощение без
// Intl.Segmenter).
//
// RTL override (U+202E) и другие управляющие символы двунаправленного текста НЕ вырезаются
// здесь, если рядом есть видимые буквы — INVISIBLE_ONLY/hasVisibleChar решают судьбу имени
// целиком, а не каждого code point по отдельности, так что имя вида "видимый текст" с embedded
// RLO проходит нормализацию как есть и визуально рисуется в обратном порядке (косметическая,
// локальная проблема — значение остаётся тем же текстом, скринридер использует логический, а
// не визуальный порядок). Оставлено как принятое ограничение, не починка: вырезание bidi-меток
// потенциально ломает легитимные RTL-имена (иврит, арабский), а не только злонамеренный ввод.
export const normalizeProfileName = (raw: string): string => {
  const sliced = Array.from(raw.trim())
    .slice(0, PROFILE_NAME_MAX_LENGTH)
    .join('')
    .trim()

  return hasVisibleChar(sliced) ? sliced : ''
}

// refine работает и на чтении: слишком длинное, не нормализованное (с пробелами по краям) или
// «невидимое» значение, попавшее в localStorage мимо UI, деградирует в fallback ''.
const profileNameSchema = z
  .string()
  .refine(
    value =>
      value === value.trim() &&
      Array.from(value).length <= PROFILE_NAME_MAX_LENGTH &&
      (value === '' || hasVisibleChar(value)),
  )

export const profileNameSlot = createStorageSlot(
  'kinoshka:profile',
  profileNameSchema,
  '',
)
