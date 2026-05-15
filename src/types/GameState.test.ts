import { describe, expect, it } from 'vitest'
import { createInitialGameState, getClockText } from './GameState'

describe('createInitialGameState', () => {
  it('returns a serializable PixiJS-independent state object', () => {
    const state = createInitialGameState()
    const cloned = JSON.parse(JSON.stringify(state))

    expect(cloned.version).toBe(1)
    expect(cloned.map[9][12].type).toBe('player_house')
    expect(Array.isArray(cloned.enemies)).toBe(true)
  })
})

describe('getClockText', () => {
  it('maps the three minute run to thirty in-game minutes', () => {
    const state = createInitialGameState()
    state.elapsedMs = 90_000

    expect(getClockText(state)).toBe('7:15 AM')
  })
})
