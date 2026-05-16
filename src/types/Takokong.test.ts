import { describe, expect, it } from 'vitest'
import {
  computeTakokongDamage,
  createInitialGameState,
  createTakokongState,
  isTakokongActive,
  TAKOKONG_BARRIER_DURATION_MS,
  TAKOKONG_MAX_HP,
  tickTakokongBarrier,
  tickTakokongCountdown,
  type GameState,
} from './GameState'

// #37: タココング戦のピュア関数群のテスト

describe('tickTakokongCountdown', () => {
  it('残り 10s より前は null（演出なし）', () => {
    expect(tickTakokongCountdown(100_000, 180_000)).toBeNull()
    expect(tickTakokongCountdown(169_999, 180_000)).toBeNull()
  })

  it('残り 10s ちょうど（=170000ms 経過）で 10 を返す', () => {
    expect(tickTakokongCountdown(170_000, 180_000)).toBe(10)
  })

  it('残り 5.5s で 6 を返す（切り上げ）', () => {
    expect(tickTakokongCountdown(174_500, 180_000)).toBe(6)
  })

  it('残り 0.5s で 1 を返す', () => {
    expect(tickTakokongCountdown(179_500, 180_000)).toBe(1)
  })

  it('残り 0s で 0 を返す', () => {
    expect(tickTakokongCountdown(180_000, 180_000)).toBe(0)
  })

  it('durationMs 超過は null（範囲外扱い）', () => {
    expect(tickTakokongCountdown(180_001, 180_000)).toBeNull()
  })
})

describe('computeTakokongDamage', () => {
  it('バリア中は damage=1 で 0（実質無効）', () => {
    expect(computeTakokongDamage(true, 1)).toBe(0)
  })

  it('バリア中は damage=2 で 1（50% 軽減）', () => {
    expect(computeTakokongDamage(true, 2)).toBe(1)
  })

  it('バリア中は damage=3 で 1（小数切り捨て）', () => {
    expect(computeTakokongDamage(true, 3)).toBe(1)
  })

  it('バリア解除後は damage そのまま', () => {
    expect(computeTakokongDamage(false, 1)).toBe(1)
    expect(computeTakokongDamage(false, 5)).toBe(5)
  })

  it('damage<=0 はバリア有無に関わらず 0', () => {
    expect(computeTakokongDamage(true, 0)).toBe(0)
    expect(computeTakokongDamage(false, -1)).toBe(0)
  })
})

describe('createTakokongState', () => {
  it('HP/maxHp が 42、バリア有効で初期化される', () => {
    const tk = createTakokongState(170_000)
    expect(tk.hp).toBe(TAKOKONG_MAX_HP)
    expect(tk.maxHp).toBe(TAKOKONG_MAX_HP)
    expect(tk.active).toBe(true)
    expect(tk.defeated).toBe(false)
    expect(tk.barrierActive).toBe(true)
    expect(tk.barrierUntilMs).toBe(170_000 + TAKOKONG_BARRIER_DURATION_MS)
  })
})

describe('tickTakokongBarrier', () => {
  it('barrierUntilMs 未満なら barrierActive を維持', () => {
    const tk = createTakokongState(170_000)
    const next = tickTakokongBarrier(tk, 171_000)
    expect(next.barrierActive).toBe(true)
  })

  it('barrierUntilMs 到達でバリア解除', () => {
    const tk = createTakokongState(170_000)
    const next = tickTakokongBarrier(tk, 170_000 + TAKOKONG_BARRIER_DURATION_MS)
    expect(next.barrierActive).toBe(false)
  })

  it('既に barrierActive=false なら何もしない（同じオブジェクト返す）', () => {
    const tk = createTakokongState(170_000)
    const noBar = { ...tk, barrierActive: false }
    const next = tickTakokongBarrier(noBar, 999_999)
    expect(next).toBe(noBar)
  })
})

describe('isTakokongActive', () => {
  function withTakokong(
    overrides: Partial<NonNullable<GameState['takokongState']>>
  ): GameState {
    const state = createInitialGameState()
    state.takokongState = {
      ...createTakokongState(0),
      ...overrides,
    }
    return state
  }

  it('takokongState が null なら false', () => {
    const state = createInitialGameState()
    expect(isTakokongActive(state)).toBe(false)
  })

  it('active=true & defeated=false なら true', () => {
    const state = withTakokong({ active: true, defeated: false })
    expect(isTakokongActive(state)).toBe(true)
  })

  it('active=false なら false', () => {
    const state = withTakokong({ active: false, defeated: false })
    expect(isTakokongActive(state)).toBe(false)
  })

  it('defeated=true なら false（撃破済み）', () => {
    const state = withTakokong({ active: true, defeated: true })
    expect(isTakokongActive(state)).toBe(false)
  })
})
