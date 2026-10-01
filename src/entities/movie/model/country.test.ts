import { DEFAULT_COUNTRY_DICTIONARY_NAMES } from '../../../test/setup'
import { STATIC_FALLBACK_COUNTRIES } from './country'

describe('STATIC_FALLBACK_COUNTRIES', () => {
  it('каждая страна шорт-листа есть в мок-словаре (написание живого API)', () => {
    // Иначе после загрузки словаря чип шорт-листа пропадает из defaultItems, а до неё
    // `countries.name` уходит в API в несуществующем написании и даёт пустую выдачу.
    for (const name of STATIC_FALLBACK_COUNTRIES) {
      expect(DEFAULT_COUNTRY_DICTIONARY_NAMES).toContain(name)
    }
  })
})
