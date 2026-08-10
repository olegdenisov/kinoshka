/**
 * Клэмп текущей страницы в допустимый диапазон `[1, totalPages]` для рендера/disabled-состояний —
 * не мутирует источник истины (URL), только защищает от временного рассинхрона
 * (напр. смена фильтров ещё не долетела до фетчера).
 */
export const clampPage = (page: number, totalPages: number): number => {
  const safeTotalPages = Math.max(1, totalPages)
  return Math.min(Math.max(page, 1), safeTotalPages)
}

/**
 * Строит список кнопок пагинации вокруг текущей страницы с эллипсисами по краям
 * (`'…L'`/`'…R'`) — общая pure-функция для desktop `Pagination` и mobile `MobilePagination`
 * (вынесена ревью-фазой 2, ранее была продублирована и уже расходилась один раз).
 */
export const buildPageRange = (
  page: number,
  totalPages: number,
): (number | string)[] => {
  const safeTotalPages = Math.max(1, totalPages)
  const safePage = clampPage(page, totalPages)

  const pages: (number | string)[] = [1]
  const left = Math.max(2, safePage - 1)
  const right = Math.min(safeTotalPages - 1, safePage + 1)
  if (left > 2) pages.push('…L')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < safeTotalPages - 1) pages.push('…R')
  if (safeTotalPages > 1) pages.push(safeTotalPages)
  return pages
}
