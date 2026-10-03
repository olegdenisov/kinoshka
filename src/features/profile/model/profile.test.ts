import { context } from '@reatom/core'

import { readPersisted, seedPersisted } from '../../../test/persist'
import {
  PROFILE_NAME_MAX_LENGTH,
  normalizeProfileName,
  profileInitials,
  profileName,
  setProfileName,
} from './profile'

const KEY = 'kinoshka:profile'

const readFresh = () => context.start(() => profileName())

describe('profileName', () => {
  it('пустой localStorage → пустая строка', () => {
    expect(profileName()).toBe('')
  })

  it('setProfileName нормализует значение и пишет конверт в localStorage', () => {
    setProfileName('  Ada  ')

    expect(profileName()).toBe('Ada')
    expect(readPersisted(KEY)).toBe('Ada')
  })

  it('профиль переживает пересоздание контекста', () => {
    setProfileName('Ada')
    context.reset()

    expect(readFresh()).toBe('Ada')
  })

  it("profileName.set('') очищает имя", () => {
    setProfileName('Ada')
    profileName.set('')

    expect(profileName()).toBe('')
    expect(readPersisted(KEY)).toBe('')
  })

  it('значение длиннее лимита в code points → ""', () => {
    seedPersisted(KEY, 'a'.repeat(PROFILE_NAME_MAX_LENGTH + 1))

    expect(readFresh()).toBe('')
  })

  it('значение ровно на лимите проходит валидацию', () => {
    const name = 'a'.repeat(PROFILE_NAME_MAX_LENGTH)
    seedPersisted(KEY, name)

    expect(readFresh()).toBe(name)
  })

  it('имя из суррогатных пар на границе лимита проходит валидацию', () => {
    // 40 эмодзи = 80 UTF-16 code units, но ровно 40 code points
    const name = '😀'.repeat(PROFILE_NAME_MAX_LENGTH)
    seedPersisted(KEY, name)

    expect(readFresh()).toBe(name)
  })

  it.each(['   ', ' Ada ', 'Ada '])(
    'значение с пробелами по краям %j (записано мимо UI) → ""',
    value => {
      seedPersisted(KEY, value)

      expect(readFresh()).toBe('')
    },
  )

  it.each([
    ['ZWSP', '​'],
    ['ZWJ', '‍'],
    ['soft hyphen', '­'],
    ['RTL override', '‮'],
    ['braille blank', '⠀'],
    ['hangul filler', 'ㅤ'],
    ['смесь невидимых', '​‍⁠'],
  ])('невидимое имя (%s), записанное мимо UI → ""', (_label, value) => {
    seedPersisted(KEY, value)

    expect(readFresh()).toBe('')
  })

  it('невидимые символы рядом с видимыми не мешают имени', () => {
    seedPersisted(KEY, 'A​da')

    expect(readFresh()).toBe('A​da')
  })

  it('невалидный JSON → ""', () => {
    localStorage.setItem(KEY, '{not-json')

    expect(readFresh()).toBe('')
  })

  it('не-строка → ""', () => {
    seedPersisted(KEY, 42)

    expect(readFresh()).toBe('')
  })
})

describe('setProfileName', () => {
  it.each(['', '   ', '​', ' ​‍ ', '⠀⠀'])(
    'без видимых символов (%j) → ""',
    input => {
      setProfileName(input)

      expect(profileName()).toBe('')
    },
  )

  it('результат записи проходит схему чтения после пересоздания контекста', () => {
    setProfileName('  Ada  ')
    context.reset()

    expect(readFresh()).toBe('Ada')
  })
})

describe('profileInitials', () => {
  it('пересчитываются при смене имени', () => {
    expect(profileInitials()).toBe('')

    setProfileName('Ada Lovelace')
    expect(profileInitials()).toBe('AL')

    profileName.set('')
    expect(profileInitials()).toBe('')
  })
})

describe('normalizeProfileName', () => {
  it('если после обрезки остались только невидимые символы → ""', () => {
    const input = '​'.repeat(PROFILE_NAME_MAX_LENGTH) + 'Ada'

    expect(normalizeProfileName(input)).toBe('')
  })

  it('обрезка после пробела не оставляет хвостовой пробел', () => {
    const input = 'a'.repeat(PROFILE_NAME_MAX_LENGTH - 1) + ' bcd'

    expect(normalizeProfileName(input)).toBe(
      'a'.repeat(PROFILE_NAME_MAX_LENGTH - 1),
    )
  })

  it('не режет суррогатную пару на лимите', () => {
    const input = '😀'.repeat(PROFILE_NAME_MAX_LENGTH + 5)

    expect(Array.from(normalizeProfileName(input))).toHaveLength(
      PROFILE_NAME_MAX_LENGTH,
    )
  })
})
