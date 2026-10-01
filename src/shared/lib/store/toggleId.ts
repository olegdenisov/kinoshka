// Общий редьюсер-хелпер для слайсов-списков id (favorites, watched, watchlist). Мутирует массив —
// рассчитан на Immer-draft внутри createSlice. Читает ids из стейта, а не из замыкания хука: два
// toggled подряд в одном тике не затирают друг друга.
export const toggleId = (ids: number[], id: number): void => {
  const index = ids.indexOf(id)
  if (index === -1) ids.push(id)
  else ids.splice(index, 1)
}
