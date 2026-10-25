import { toggleId } from './toggleId'

describe('toggleId', () => {
  it('добавляет отсутствующий id в конец', () => {
    const ids = [1, 2]
    toggleId(ids, 3)
    expect(ids).toEqual([1, 2, 3])
  })

  it('удаляет присутствующий id, сохраняя порядок остальных', () => {
    const ids = [1, 2, 3]
    toggleId(ids, 2)
    expect(ids).toEqual([1, 3])
  })
})
