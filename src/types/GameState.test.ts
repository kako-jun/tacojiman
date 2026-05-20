import { describe, expect, it } from 'vitest'
import {
  createInitialGameState,
  getClockText,
  isHouseTapped,
  pickDecoyTarget,
  pickRandomBomb,
  pickSentryTarget,
  tickMultiHitBomb,
  togglePausePhase,
  triggerMineIfHit,
  tryBombRecovery,
  TILE_SIZE,
} from './GameState'
import type {
  BombType,
  DecoyState,
  EnemyState,
  MineState,
  MultiHitBombState,
  SentryState,
} from './GameState'

describe('createInitialGameState', () => {
  it('returns a serializable PixiJS-independent state object', () => {
    const state = createInitialGameState()
    const cloned = JSON.parse(JSON.stringify(state))

    expect(cloned.version).toBe(1)
    expect(cloned.map[13][13].type).toBe('player_house')
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

// ─── #38 仕掛け系ボムのピュア関数 ──────────────────────────────

function makeEnemyAt(x: number, y: number): EnemyState {
  return {
    id: 'e1',
    type: 'ground',
    hp: 2,
    speed: 1,
    x,
    y,
    routeProgress: 0,
    route: [],
  }
}

describe('triggerMineIfHit (#38)', () => {
  const mine: MineState = {
    id: 'm1',
    x: 0,
    y: 0,
    triggerRange: 30,
    explosionRange: 60,
    damage: 1,
  }

  it('triggerRange 内の敵は true', () => {
    expect(triggerMineIfHit(mine, makeEnemyAt(20, 0))).toBe(true)
  })

  it('triggerRange ちょうどなら true', () => {
    expect(triggerMineIfHit(mine, makeEnemyAt(30, 0))).toBe(true)
  })

  it('triggerRange を超えると false', () => {
    expect(triggerMineIfHit(mine, makeEnemyAt(31, 0))).toBe(false)
  })
})

describe('pickSentryTarget (#38)', () => {
  const sentry: SentryState = {
    id: 's1',
    x: 0,
    y: 0,
    remainingMs: 5_000,
    fireCooldownMs: 0,
    range: 100,
    damage: 1,
  }

  it('射程内が無ければ null', () => {
    expect(pickSentryTarget(sentry, [makeEnemyAt(200, 0)])).toBeNull()
  })

  it('射程内の最近敵を返す', () => {
    const a = { ...makeEnemyAt(50, 0), id: 'a' }
    const b = { ...makeEnemyAt(80, 0), id: 'b' }
    expect(pickSentryTarget(sentry, [b, a])?.id).toBe('a')
  })

  it('敵が空なら null', () => {
    expect(pickSentryTarget(sentry, [])).toBeNull()
  })
})

describe('pickDecoyTarget (#38)', () => {
  const decoy: DecoyState = {
    id: 'd1',
    x: 0,
    y: 0,
    remainingMs: 5_000,
    lureRange: 120,
  }

  it('lureRange 内なら true', () => {
    expect(pickDecoyTarget(decoy, makeEnemyAt(100, 0))).toBe(true)
  })

  it('lureRange 外なら false', () => {
    expect(pickDecoyTarget(decoy, makeEnemyAt(200, 0))).toBe(false)
  })
})

describe('tickMultiHitBomb (#38)', () => {
  function makeBomb(remainingHits: number, nextIn = 200): MultiHitBombState {
    return {
      id: 'mh1',
      x: 0,
      y: 0,
      range: 80,
      damage: 1,
      remainingHits,
      nextHitInMs: nextIn,
      hitIntervalMs: 200,
    }
  }

  it('nextHitInMs が残っていれば fired=false で減算', () => {
    const r = tickMultiHitBomb(makeBomb(3, 200), 50)
    expect(r.fired).toBe(false)
    expect(r.remaining?.nextHitInMs).toBe(150)
    expect(r.remaining?.remainingHits).toBe(3)
  })

  it('nextHitInMs <= 0 で fired=true、残りヒットあれば再充填', () => {
    const r = tickMultiHitBomb(makeBomb(3, 100), 100)
    expect(r.fired).toBe(true)
    expect(r.remaining?.remainingHits).toBe(2)
    expect(r.remaining?.nextHitInMs).toBe(200)
  })

  it('最後の 1 ヒットを撃つと remaining=null', () => {
    const r = tickMultiHitBomb(makeBomb(1, 0), 50)
    expect(r.fired).toBe(true)
    expect(r.remaining).toBeNull()
  })
})

describe('createInitialGameState — #38 仕掛け系配列が初期化', () => {
  it('mines / sentries / decoys / multiHitBombs は空配列', () => {
    const state = createInitialGameState()
    expect(state.mines).toEqual([])
    expect(state.sentries).toEqual([])
    expect(state.decoys).toEqual([])
    expect(state.multiHitBombs).toEqual([])
  })
})

describe('togglePausePhase (#45)', () => {
  it('playing → paused', () => {
    expect(togglePausePhase('playing')).toBe('paused')
  })
  it('paused → playing', () => {
    expect(togglePausePhase('paused')).toBe('playing')
  })
  it('ready / ending は変化なし', () => {
    expect(togglePausePhase('ready')).toBe('ready')
    expect(togglePausePhase('ending')).toBe('ending')
  })
})
