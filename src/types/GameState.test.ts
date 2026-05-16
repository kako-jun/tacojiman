import { describe, expect, it } from 'vitest'
import {
  createInitialGameState,
  getClockText,
  isHouseTapped,
  pickRandomBomb,
  tryBombRecovery,
  TILE_SIZE,
} from './GameState'
import type { BombType } from './GameState'

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

describe('createInitialGameState — ボム初期化', () => {
  it('開始時 bombStock=1, selectedBomb は 8 種のいずれか', () => {
    const state = createInitialGameState()
    expect(state.bombStock).toBe(1)
    expect(state.selectedBomb).not.toBeNull()
    const validTypes: BombType[] = [
      'proton',
      'muddy',
      'sentry',
      'muteki',
      'sol',
      'dainsleif',
      'jakuhou',
      'bunshin',
    ]
    expect(validTypes).toContain(state.selectedBomb)
  })

  it('回復閾値は [60_000, 120_000] で初期化される', () => {
    const state = createInitialGameState()
    expect(state.bombRecoveryThresholds).toEqual([60_000, 120_000])
  })
})

describe('pickRandomBomb', () => {
  it('rand=0 のとき配列の先頭 proton', () => {
    expect(pickRandomBomb(() => 0)).toBe('proton')
  })

  it('rand→1 直前で配列末尾 bunshin', () => {
    expect(pickRandomBomb(() => 0.9999)).toBe('bunshin')
  })

  it('全 8 種が選ばれうる（複数 rand で網羅）', () => {
    const seen = new Set<BombType>()
    for (let i = 0; i < 8; i++) {
      seen.add(pickRandomBomb(() => i / 8 + 0.001))
    }
    expect(seen.size).toBe(8)
  })
})

describe('tryBombRecovery', () => {
  it('elapsedMs が閾値未満なら回復なし', () => {
    const state = createInitialGameState()
    state.elapsedMs = 30_000
    const r = tryBombRecovery(state, () => 0)
    expect(r.recovered).toBe(0)
    expect(r.newStock).toBe(1)
    expect(r.newThresholds).toEqual([60_000, 120_000])
  })

  it('1 つ目の閾値を超えると 1 個回復し閾値を消費', () => {
    const state = createInitialGameState()
    state.elapsedMs = 70_000
    const r = tryBombRecovery(state, () => 0)
    expect(r.recovered).toBe(1)
    expect(r.newStock).toBe(2)
    expect(r.newThresholds).toEqual([120_000])
    expect(r.newSelected).toBe('proton') // rand=0 → 先頭
  })

  it('2 つの閾値を一度に跨ぐと 2 個回復', () => {
    const state = createInitialGameState()
    state.elapsedMs = 130_000
    const r = tryBombRecovery(state, () => 0)
    expect(r.recovered).toBe(2)
    expect(r.newStock).toBe(3)
    expect(r.newThresholds).toEqual([])
  })

  it('閾値リストが空のとき何もしない', () => {
    const state = createInitialGameState()
    state.bombRecoveryThresholds = []
    state.elapsedMs = 999_999
    const r = tryBombRecovery(state, () => 0)
    expect(r.recovered).toBe(0)
    expect(r.newThresholds).toEqual([])
  })
})

describe('isHouseTapped', () => {
  it('mapLayer の (0, 0) 中心 ±TILE_SIZE/2 範囲が家タップ判定', () => {
    expect(isHouseTapped(0, 0)).toBe(true)
    expect(isHouseTapped(TILE_SIZE / 2, 0)).toBe(true)
    expect(isHouseTapped(0, TILE_SIZE / 2)).toBe(true)
    expect(isHouseTapped(TILE_SIZE / 2 + 1, 0)).toBe(false)
    expect(isHouseTapped(0, TILE_SIZE / 2 + 1)).toBe(false)
  })

  it('明らかに離れた地点は false', () => {
    expect(isHouseTapped(100, 100)).toBe(false)
    expect(isHouseTapped(-100, -100)).toBe(false)
  })
})
