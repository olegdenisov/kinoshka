import { normalizeProfileName } from '../model/profileStorage'
import { getInitials } from './getInitials'
import { isInvisibleCodePoint } from './visibleChars'

describe('getInitials', () => {
  it.each(['', '   ', '\n\t'])('возвращает пустую строку для %j', name => {
    expect(getInitials(name)).toBe('')
  })

  it('одно слово даёт первую букву в верхнем регистре', () => {
    expect(getInitials('oleg')).toBe('O')
    expect(getInitials('олег')).toBe('О')
  })

  // Регрессия: раньше toLocaleUpperCase() без аргумента брал системную локаль среды выполнения,
  // так что одно и то же имя рисовало разные инициалы на разных устройствах — на турецкой/
  // азербайджанской локали 'i' переходит в 'İ' вместо обычной 'I'. getInitials зафиксирован на
  // одной локали ('en'), поэтому не должен повторять турецкое поведение независимо от того, какая
  // локаль реально настроена у посетителя.
  it('регистр буквы "i" не зависит от системной локали (не как в турецкой İ)', () => {
    expect(getInitials('ivan')).toBe('I')
    // сравнение с самой турецкой локалью — показывает, от чего именно мы отвязались
    expect('ivan'.toLocaleUpperCase('tr')).toBe('İVAN')
  })

  it('два слова дают первые буквы обоих', () => {
    expect(getInitials('oleg denisov')).toBe('OD')
  })

  it('игнорирует повторяющиеся пробелы между словами', () => {
    expect(getInitials('олег  денисов')).toBe('ОД')
  })

  it('игнорирует пробелы по краям', () => {
    expect(getInitials('  oleg denisov  ')).toBe('OD')
  })

  it('из трёх и более слов берёт только первые два', () => {
    expect(getInitials('oleg ivanovich denisov')).toBe('OI')
  })

  it('слово, начинающееся со знака пунктуации, даёт этот знак', () => {
    expect(getInitials('- oleg')).toBe('-O')
  })

  it('неразрывный пробел и прочие Unicode-пробелы разделяют слова', () => {
    expect(getInitials('oleg\u00A0denisov')).toBe('OD')
    expect(getInitials('oleg\u2003denisov')).toBe('OD')
    expect(getInitials('\u00A0\u00A0')).toBe('')
  })

  it('буква, раскрывающаяся при upper-case (ß → SS), даёт один символ на слово', () => {
    expect(getInitials('ßeta')).toBe('S')
    expect(getInitials('ßeta ßeta')).toBe('SS')
  })

  it('не режет суррогатную пару пополам', () => {
    expect(getInitials('😀 smile')).toBe('😀S')
    expect(getInitials('𝒜lice')).toBe('𝒜')
  })

  it.each([
    ['ZWSP', '\u200BAda'],
    ['ZWJ', '\u200DAda'],
    ['soft hyphen', '\u00ADAda'],
    ['word joiner', '\u2060Ada'],
    ['LRM', '\u200EAda'],
    ['RLM', '\u200FAda'],
    ['RLO', '\u202EAda'],
    ['braille blank', '\u2800Ada'],
  ])(
    'ведущий невидимый code point (%s) не становится инициалом — виден первый настоящий символ',
    (_label, name) => {
      // страховка от вакуумного прохода: если невидимый символ потеряется, name станет 'Ada'
      expect(name).not.toBe('Ada')
      expect(getInitials(name)).toBe('A')
    },
  )

  it('слово из одних невидимых code points не даёт инициал, инициал берётся из следующего слова', () => {
    expect(getInitials('\u200B\u200D Ada')).toBe('A')
  })

  it('ведущий невидимый code point во втором слове тоже пропускается', () => {
    expect(getInitials('Ada \u200BLovelace')).toBe('AL')
  })

  // Инвариант из бэклога код-ревью: если normalizeProfileName() оставила имя непустым (значит,
  // в нём есть хотя бы один видимый символ), getInitials() над этим же именем обязана вернуть
  // непустую строку — а не невидимый code point, который выглядит пустым кружком в аватаре.
  it.each([
    '\u200BAda',
    'Ada\u200B',
    '\u200D\u200D Ada',
    'Ada \u200BLovelace',
    '\u202E\u200EAda',
    '\u2800Ada Lovelace',
  ])(
    'getInitials(normalizeProfileName(%j)) непусто и состоит из видимых символов',
    raw => {
      const normalized = normalizeProfileName(raw)
      expect(normalized).not.toBe('')

      const initials = getInitials(normalized)
      expect(initials).not.toBe('')
      expect(Array.from(initials).some(cp => !isInvisibleCodePoint(cp))).toBe(
        true,
      )
    },
  )
})
