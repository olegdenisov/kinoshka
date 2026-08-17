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

/**
 * Интерактивный двухползунковый слайдер годов, построенный на двух перекрывающихся нативных
 * `<input type="range">` вместо самописного pointer-drag — cross-link по `min`/`max` заставляет
 * сам браузер не давать ползункам пересекаться, и даёт нативную клавиатурную поддержку/фокус
 * бесплатно. Полностью управляемый пропами, без внутреннего знания об URL/роутере — по форме
 * аналогичен `GenreSelector`.
 *
 * Локальный стейт зеркалит `[from, to]` для живой визуальной обратной связи во время drag;
 * `onChange` родителя коммитится один раз — по `onMouseUp`/`onTouchEnd` (pointer-drag) и
 * `onKeyUp` (клавиатурное изменение стрелками/Home/End не порождает ни `mouseup`, ни
 * `touchend`, поэтому без `onKeyUp` клавиатурный пользователь мог бы двигать слайдер, но
 * изменение никогда бы не сохранялось).
 */
export const YearRangeSlider = ({
  yearFrom,
  yearTo,
  onChange,
  disabled,
  compact,
}: YearRangeSliderProps) => {
  const [range, setRange] = useState<[number, number]>([
    yearFrom ?? YEAR_SLIDER_MIN,
    yearTo ?? YEAR_SLIDER_MAX,
  ])

  // Всегда отражает последнее значение `range` синхронно, независимо от того, успел ли React
  // перерендерить компонент между native-событием `input` (обновляет `range`) и последующим
  // native-событием `mouseup`/`touchend`/`keyup` (коммитит его родителю) — коммит-хендлеры
  // читают отсюда, а не из замыкания над `range`.
  const rangeRef = useRef(range)
  rangeRef.current = range

  // Пересинхронизация с пропами при монтировании и при любом внешнем изменении
  // yearFrom/yearTo (например "Reset filters" или удаление чипа).
  useEffect(() => {
    setRange([yearFrom ?? YEAR_SLIDER_MIN, yearTo ?? YEAR_SLIDER_MAX])
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
    const [committedFrom, committedTo] = rangeRef.current
    if (committedFrom === YEAR_SLIDER_MIN && committedTo === YEAR_SLIDER_MAX) {
      onChange(null, null)
    } else {
      onChange(committedFrom, committedTo)
    }
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
          onKeyUp={commit}
        />
      </div>
    </div>
  )
}
