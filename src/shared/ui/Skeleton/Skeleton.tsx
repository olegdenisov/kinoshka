import s from "./Skeleton.module.css"

type Props = {
  width?: number | string
  height?: number | string
  borderRadius?: number | string
  className?: string
}

export const Skeleton = ({
  width = "100%",
  height = 16,
  borderRadius = 8,
  className,
}: Props) => {
  return (
    <div
      className={`${s.skeleton} ${className ?? ""}`}
      style={{
        width,
        height,
        borderRadius,
      }}
    />
  )
}
