import { describe, expect, it } from 'vitest'
import { generateMap } from './map'

describe('generateMap', () => {
  it('places the player house at the center', () => {
    const map = generateMap(19, 25)

    expect(map[9][12].type).toBe('player_house')
  })

  it('creates connected path and rail networks', () => {
    const map = generateMap(19, 25)

    expect(map[9][10].connections.south).toBe(true)
    expect(map[9][14].connections.north).toBe(true)
    expect(map[4][8].type).toBe('station')
    expect(map[5][8].connections.west).toBe(true)
  })
})
