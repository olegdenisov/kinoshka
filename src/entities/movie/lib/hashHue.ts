// Целочисленный хеш (вариант Knuth multiplicative hashing) перед взятием % 360 —
// нужен, чтобы соседние id (обычно идущие подряд) не давали визуально похожие
// оттенки постера, как было бы при простом id % 360.
export const hashHue = (id: number): number => {
  const hash = Math.imul(id ^ (id >>> 16), 2654435761) >>> 0

  return hash % 360
}
