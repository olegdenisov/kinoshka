import { getGenreLabel } from './genreMap'

describe('genreMap / getGenreLabel', () => {
  it.each([
    ['боевик', 'Action'],
    ['драма', 'Drama'],
    ['фантастика', 'Sci-Fi'],
    ['триллер', 'Thriller'],
    ['мелодрама', 'Romance'],
    ['ужасы', 'Horror'],
    ['детектив', 'Mystery'],
    ['документальный', 'Documentary'],
    ['история', 'Historical'],
    ['приключения', 'Adventure'],
    ['семейный', 'Family'],
    ['фэнтези', 'Fantasy'],
  ])('известное RU-название "%s" → EN-лейбл "%s"', (ru, en) => {
    expect(getGenreLabel(ru)).toBe(en)
  })

  it('неизвестное RU-название возвращается как есть (фолбэк)', () => {
    expect(getGenreLabel('аниме')).toBe('аниме')
  })
})
