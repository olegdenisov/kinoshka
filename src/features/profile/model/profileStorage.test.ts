import {
  PROFILE_NAME_MAX_LENGTH,
  normalizeProfileName,
  profileNameSlot,
} from './profileStorage'

beforeEach(() => localStorage.clear())

describe('profileNameSlot', () => {
  it('пустой localStorage → пустая строка', () => {
    expect(profileNameSlot.get()).toBe('')
  })

  it('валидное значение читается корректно', () => {
    profileNameSlot.set('Oleg')

    expect(profileNameSlot.get()).toBe('Oleg')
  })

  it('значение длиннее лимита в code points → fallback ""', () => {
    localStorage.setItem(
      'kinoshka:profile',
      JSON.stringify('a'.repeat(PROFILE_NAME_MAX_LENGTH + 1)),
    )

    expect(profileNameSlot.get()).toBe('')
  })

  it('значение ровно на лимите проходит валидацию', () => {
    const name = 'a'.repeat(PROFILE_NAME_MAX_LENGTH)
    localStorage.setItem('kinoshka:profile', JSON.stringify(name))

    expect(profileNameSlot.get()).toBe(name)
  })

  it('имя из суррогатных пар на границе лимита проходит валидацию', () => {
    // 40 эмодзи = 80 UTF-16 code units, но ровно 40 code points
    const name = '😀'.repeat(PROFILE_NAME_MAX_LENGTH)
    localStorage.setItem('kinoshka:profile', JSON.stringify(name))

    expect(profileNameSlot.get()).toBe(name)
  })

  it.each(['   ', ' Ada ', 'Ada '])(
    'значение с пробелами по краям %j (записано мимо UI) → fallback ""',
    value => {
      localStorage.setItem('kinoshka:profile', JSON.stringify(value))

      expect(profileNameSlot.get()).toBe('')
    },
  )

  it.each([
    ['ZWSP', '\u200B'],
    ['ZWJ', '\u200D'],
    ['soft hyphen', '\u00AD'],
    ['RTL override', '\u202E'],
    ['braille blank', '\u2800'],
    ['hangul filler', '\u3164'],
    ['смесь невидимых', '\u200B\u200D\u2060'],
  ])(
    'невидимое имя (%s), записанное мимо UI → fallback ""',
    (_label, value) => {
      localStorage.setItem('kinoshka:profile', JSON.stringify(value))

      expect(profileNameSlot.get()).toBe('')
    },
  )

  it('невидимые символы рядом с видимыми не мешают имени', () => {
    localStorage.setItem('kinoshka:profile', JSON.stringify('A\u200Bda'))

    expect(profileNameSlot.get()).toBe('A\u200Bda')
  })

  it('set не валидирует запись: над-лимитное значение читается обратно как fallback ""', () => {
    profileNameSlot.set('a'.repeat(PROFILE_NAME_MAX_LENGTH + 1))

    expect(profileNameSlot.get()).toBe('')
  })

  it('невалидный JSON → fallback ""', () => {
    localStorage.setItem('kinoshka:profile', '{not-json')

    expect(profileNameSlot.get()).toBe('')
  })

  it('не-строка → fallback ""', () => {
    localStorage.setItem('kinoshka:profile', JSON.stringify(42))

    expect(profileNameSlot.get()).toBe('')
  })
})

describe('normalizeProfileName', () => {
  it('тримит и обрезает по code points; результат проходит схему чтения', () => {
    profileNameSlot.set(normalizeProfileName('  Ada  '))

    expect(profileNameSlot.get()).toBe('Ada')
  })

  it.each(['', '   ', '\u200B', ' \u200B\u200D ', '\u2800\u2800'])(
    'без видимых символов (%j) → ""',
    input => {
      expect(normalizeProfileName(input)).toBe('')
    },
  )

  it('если после обрезки остались только невидимые символы → ""', () => {
    const input = '\u200B'.repeat(PROFILE_NAME_MAX_LENGTH) + 'Ada'

    expect(normalizeProfileName(input)).toBe('')
  })

  it('обрезка после пробела не оставляет хвостовой пробел', () => {
    const input = 'a'.repeat(PROFILE_NAME_MAX_LENGTH - 1) + ' bcd'

    expect(normalizeProfileName(input)).toBe(
      'a'.repeat(PROFILE_NAME_MAX_LENGTH - 1),
    )
  })
})
