import type { CSSProperties } from 'react'
import s from './Spinner.module.css'

type SpinnerProps = {
  size?: number
}

export const Spinner = ({ size }: SpinnerProps) => {
  return (
    <span
      className={s.spinner}
      style={
        size !== undefined
          ? ({ '--spinner-size': `${size}px` } as CSSProperties)
          : undefined
      }
    ></span>
  )
}
