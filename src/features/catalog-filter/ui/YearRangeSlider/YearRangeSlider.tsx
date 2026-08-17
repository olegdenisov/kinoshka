import type { ChangeEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import { YEAR_SLIDER_MAX, YEAR_SLIDER_MIN } from './yearRangeBounds'

import s from './YearRangeSlider.module.css'

type YearRangeSliderProps = {
  yearFrom: number | null
  yearTo: number | null
  onChange: (yearFrom: number | null, yearTo: number | null) => void
  disabled?: boolean
  /**
   * Мобильный размер ползунка (18px вместо desktop 12px), передаётся вызывающей стороной
   * (`SearchMobile.tsx`) явно — тот же паттерн variant-пропа, что и у `GenreSelector`'s
   * `compact`, вместо `@media` внутри собственного CSS-модуля.
   */
  compact?: boolean
}

const clamp = (value: number) =>
  Math.min(YEAR_SLIDER_MAX, Math.max(YEAR_SLIDER_MIN, value))

/**
 * Клэмпит `yearFrom`/`yearTo` в границы `[YEAR_SLIDER_MIN, YEAR_SLIDER_MAX]` и нормализует
 * порядок (`from <= to`). Без этого шага деплинк/URL со значением вне UI-границ слайдера или с
 * перевёрнутой парой (`yearFrom > yearTo`) рассинхронизировал бы React-контролируемый `value`
 * с нативным DOM-значением `<input type="range">` (браузер молча клэмпит нативный `value` к
 * своим `min`/`max`, но React продолжил бы считать, что там лежит нерасклэмпленное число).
 */
const normalizeRange = (
  yearFrom: number | null,
  yearTo: number | null,
): [number, number] => {
  const from = clamp(yearFrom ?? YEAR_SLIDER_MIN)
  const to = clamp(yearTo ?? YEAR_SLIDER_MAX)
  return from <= to ? [from, to] : [to, from]
}

/**
 * Интерактивный двухползунковый слайдер годов, построенный на двух перекрывающихся нативных
 * `<input type="range">` вместо самописного pointer-drag — cross-link по `min`/`max` заставляет
 * сам браузер не давать ползункам пересекаться, и даёт нативную клавиатурную поддержку/фокус
 * бесплатно. Полностью управляемый пропами, без внутреннего знания об URL/роутере — по форме
 * аналогичен `GenreSelector`.
 *
 * Локальный стейт зеркалит `[from, to]` для живой визуальной обратной связи во время drag;
 * `onChange` родителя коммитится по `onMouseUp`/`onTouchEnd` (pointer-drag) и `onKeyUp`
 * (клавиатурное изменение стрелками/Home/End не порождает ни `mouseup`, ни `touchend`, поэтому
 * без `onKeyUp` клавиатурный пользователь мог бы двигать слайдер, но изменение никогда бы не
 * сохранялось) — но только если закоммиченная пара реально отличается от последней
 * закоммиченной (`lastCommittedRef`), иначе Tab-фокус (доставляет `keyup` новому активному
 * ползунку без изменения значения) или клик без движения вызывали бы паразитный `onChange`.
 * Входящие `yearFrom`/`yearTo` (включая начальный рендер) клэмпятся в `[YEAR_SLIDER_MIN,
 * YEAR_SLIDER_MAX]` и нормализуются по порядку через `normalizeRange`, чтобы вне-диапазонные
 * или перевёрнутые (`yearFrom > yearTo`) значения из URL не рассинхронизировали React-стейт с
 * нативным DOM-значением `<input>`.
 */
export const YearRangeSlider = ({
  yearFrom,
  yearTo,
  onChange,
  disabled,
  compact,
}: YearRangeSliderProps) => {
  const [range, setRange] = useState<[number, number]>(() =>
    normalizeRange(yearFrom, yearTo),
  )

  // Снапшот последней закоммиченной (= последней пришедшей из пропов, нормализованной) пары —
  // commit() сравнивает с ним, чтобы не звать `onChange`, если фактическое значение не
  // изменилось. Без этой проверки onKeyUp/onMouseUp/onTouchEnd коммитили бы безусловно — а
  // клавиатурная навигация (Tab на новый ползунок) тоже доставляет `keyup` без единого
  // изменения значения, что вызывало бы паразитный onChange/setFilters/URL replace.
  const lastCommittedRef = useRef(range)

  // Пересинхронизация с пропами при монтировании и при любом внешнем изменении
  // yearFrom/yearTo (например "Reset filters" или удаление чипа).
  useEffect(() => {
    const normalized = normalizeRange(yearFrom, yearTo)
    setRange(normalized)
    lastCommittedRef.current = normalized
  }, [yearFrom, yearTo])

  const [from, to] = range

  const handleFromChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    setRange(([, prevTo]) => [value, prevTo])
  }

  const handleToChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    setRange(([prevFrom]) => [prevFrom, value])
  }

  const commit = () => {
    const [committedFrom, committedTo] = range
    const [lastFrom, lastTo] = lastCommittedRef.current
    if (committedFrom === lastFrom && committedTo === lastTo) {
      return
    }
    lastCommittedRef.current = [committedFrom, committedTo]
    if (committedFrom === YEAR_SLIDER_MIN && committedTo === YEAR_SLIDER_MAX) {
      onChange(null, null)
    } else {
      onChange(committedFrom, committedTo)
    }
  }

  // Прерванный touch-drag (палец уходит за пределы жеста — вызов, системный жест-свайп и т.п.)
  // не порождает `touchend`, так что без этого хендлера локальный `range` остался бы отражать
  // недокоммиченное промежуточное значение, разойдясь с пропами/URL. Откатываем визуально к
  // последнему закоммиченному значению, ничего не коммитя.
  const handleTouchCancel = () => {
    setRange(lastCommittedRef.current)
  }

  const percentFrom =
    ((from - YEAR_SLIDER_MIN) / (YEAR_SLIDER_MAX - YEAR_SLIDER_MIN)) * 100
  const percentTo =
    ((to - YEAR_SLIDER_MIN) / (YEAR_SLIDER_MAX - YEAR_SLIDER_MIN)) * 100

  return (
    <div className={`${s.container} ${compact ? s.compact : ''}`}>
      <div className={s.yearDisplay}>
        <span>{from}</span>
        <span>{to}</span>
      </div>
      <div className={s.sliderWrap}>
        <div className={s.track} />
        <div
          className={s.fill}
          style={{ left: `${percentFrom}%`, right: `${100 - percentTo}%` }}
        />
        <input
          type='range'
          className={s.input}
          min={YEAR_SLIDER_MIN}
          max={to}
          step={1}
          value={from}
          disabled={disabled}
          aria-label='Year from'
          onChange={handleFromChange}
          onMouseUp={commit}
          onTouchEnd={commit}
          onTouchCancel={handleTouchCancel}
          onKeyUp={commit}
        />
        <input
          type='range'
          className={s.input}
          min={from}
          max={YEAR_SLIDER_MAX}
          step={1}
          value={to}
          disabled={disabled}
          aria-label='Year to'
          onChange={handleToChange}
          onMouseUp={commit}
          onTouchEnd={commit}
          onTouchCancel={handleTouchCancel}
          onKeyUp={commit}
        />
      </div>
    </div>
  )
}
