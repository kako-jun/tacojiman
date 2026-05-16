import { describe, expect, it } from 'vitest'
import { ENEMY_SPECS, selectRandomEnemyType, spawnEnemies } from './EnemyManager'
import { createInitialGameState, TILE_SIZE } from '../types/GameState'
import type { GameState, MapPanel } from '../types/GameState'

// テスト用の最小 GameState を手組みするヘルパー
function makeMinimalState(overrides: Partial<GameState> = {}): GameState {
  const defaultMap: MapPanel[][] = [
    [
      { x: 0, y: 0, type: 'path', connections: { north: false, south: true, east: false, west: false } },
    ],
  ]
  return {
    version: 1,
    elapsedMs: 0,
    durationMs: 180_000,
    score: 0,
    combo: 0,
    bombStock: 1,
    selectedBomb: null,
    morningStartMinutes: 7 * 60,
    map: defaultMap,
    enemies: [],
    camera: { x: 200, y: 300, scale: 1 },
    takokongSpawned: false,
    spawnTimer: 0,
    phase: 'playing',
    player: { panelX: 0, panelY: 0, direction: 'south', isMoving: false },
    shakeState: { remainingMs: 0, intensity: 0 },
    zoomState: null,
    playerHp: 3,
    initialEnemiesSpawned: true,
    initialEnemiesRemaining: 0,
    initialEnemiesNextDelayMs: 0,
    spawnIntervalMs: 500,
    spawnRateUpgradeAccumMs: 0,
    maxEnemies: 40,
    maxEnemiesUpgradeAccumMs: 0,
    ...overrides,
  }
}

// rice_field が存在しないマップ（全セル path）
function makeAllPathMap(): MapPanel[][] {
  return [
    [
      { x: 0, y: 0, type: 'path', connections: { north: false, south: false, east: false, west: false } },
    ],
  ]
}

describe('ENEMY_SPECS', () => {
  it('全5種のエントリがある', () => {
    const keys = Object.keys(ENEMY_SPECS)
    expect(keys).toContain('ground')
    expect(keys).toContain('water')
    expect(keys).toContain('air')
    expect(keys).toContain('underground')
    expect(keys).toContain('takokong')
    expect(keys).toHaveLength(5)
  })

  it('ground は speed > 0, hp=2', () => {
    expect(ENEMY_SPECS.ground.speed).toBeGreaterThan(0)
    expect(ENEMY_SPECS.ground.baseHp).toBe(2)
  })

  it('air は hp=1（他と違い1発で倒れる）', () => {
    expect(ENEMY_SPECS.air.baseHp).toBe(1)
  })

  it('takokong は hp=42', () => {
    expect(ENEMY_SPECS.takokong.baseHp).toBe(42)
  })
})

// ─── 初期 3 体スポーン ─────────────────────────────────────────────

describe('spawnEnemies — 初期 3 体スポーン', () => {
  it('phase=playing で最初の呼び出し直後に地上タコ 1 体が即時スポーンする', () => {
    const state = createInitialGameState()
    state.phase = 'playing'
    const result = spawnEnemies(state, 1)
    const grounds = result.filter((e) => e.type === 'ground')
    expect(grounds.length).toBeGreaterThanOrEqual(1)
    expect(state.initialEnemiesRemaining).toBeLessThanOrEqual(2)
  })

  it('合計 200ms 経過時点で残り 2 体もスポーンしている（合計 3 体）', () => {
    const state = createInitialGameState()
    state.phase = 'playing'
    // 1 体目（即時）
    const first = spawnEnemies(state, 1)
    // 200ms 経過 → 2 体目
    const second = spawnEnemies(state, 200)
    // さらに 200ms 経過 → 3 体目
    const third = spawnEnemies(state, 200)
    const totalGround = [...first, ...second, ...third].filter((e) => e.type === 'ground').length
    expect(totalGround).toBeGreaterThanOrEqual(3)
    expect(state.initialEnemiesSpawned).toBe(true)
    expect(state.initialEnemiesRemaining).toBe(0)
  })

  it('initialEnemiesSpawned=true に達したら初期スポーン分は出ない', () => {
    const state = makeMinimalState({
      initialEnemiesSpawned: true,
      initialEnemiesRemaining: 0,
    })
    // 200ms × 5 経過させても初期 3 体分は再度出てこない
    spawnEnemies(state, 200)
    expect(state.initialEnemiesSpawned).toBe(true)
  })
})

// ─── selectRandomEnemyType（重み付き選択） ────────────────────

describe('selectRandomEnemyType', () => {
  it('rand=0 のとき ground を返す（cumulative 0.5）', () => {
    expect(selectRandomEnemyType(0)).toBe('ground')
  })

  it('rand=0.5 のとき ground を返す（境界、ground=0.5）', () => {
    expect(selectRandomEnemyType(0.5)).toBe('ground')
  })

  it('rand=0.6 のとき water を返す（cumulative 0.75）', () => {
    expect(selectRandomEnemyType(0.6)).toBe('water')
  })

  it('rand=0.8 のとき air を返す（cumulative 0.9）', () => {
    expect(selectRandomEnemyType(0.8)).toBe('air')
  })

  it('rand=0.95 のとき underground を返す（cumulative 1.0）', () => {
    expect(selectRandomEnemyType(0.95)).toBe('underground')
  })

  it('rand=1.0 のとき underground を返す（cumulative 1.0 で境界）', () => {
    expect(selectRandomEnemyType(1.0)).toBe('underground')
  })

  it('takokong は重み付き選択の対象外', () => {
    // 全範囲で takokong は返らない
    for (let r = 0; r <= 1; r += 0.05) {
      expect(selectRandomEnemyType(r)).not.toBe('takokong')
    }
  })
})

// ─── 動的スポーン間隔・最大敵数 ─────────────────────────────────

describe('spawnEnemies — 動的スポーン間隔', () => {
  it('15 秒経過で spawnIntervalMs が ×0.8 になる（500→400）', () => {
    const state = makeMinimalState({ spawnIntervalMs: 500 })
    spawnEnemies(state, 15_000)
    expect(state.spawnIntervalMs).toBeCloseTo(400, 5)
  })

  it('30 秒経過で spawnIntervalMs が 500 → 400 → 320 になる', () => {
    const state = makeMinimalState({ spawnIntervalMs: 500 })
    spawnEnemies(state, 30_000)
    expect(state.spawnIntervalMs).toBeCloseTo(320, 5)
  })

  it('spawnIntervalMs は下限 200ms を下回らない', () => {
    const state = makeMinimalState({ spawnIntervalMs: 500 })
    // 長時間経過させて極小値にする
    spawnEnemies(state, 600_000)
    expect(state.spawnIntervalMs).toBeGreaterThanOrEqual(200)
  })
})

describe('spawnEnemies — 動的最大敵数', () => {
  it('15 秒経過で maxEnemies が 40 → 45 になる', () => {
    const state = makeMinimalState({ maxEnemies: 40 })
    spawnEnemies(state, 15_000)
    expect(state.maxEnemies).toBe(45)
  })

  it('maxEnemies は上限 70 を超えない', () => {
    const state = makeMinimalState({ maxEnemies: 40 })
    spawnEnemies(state, 600_000)
    expect(state.maxEnemies).toBe(70)
  })

  it('現在の敵数が maxEnemies に達しているときは新規スポーンしない', () => {
    // 既に 40 体いる状態で spawnInterval を跨いでもスポーンしない
    const map: MapPanel[][] = [
      [{ x: 0, y: 0, type: 'path', connections: { north: false, south: false, east: false, west: false } }],
    ]
    const fakeEnemies = Array.from({ length: 40 }, (_, i) => ({
      id: `ground-${i}`,
      type: 'ground' as const,
      hp: 2,
      speed: 0.4,
      x: 0,
      y: 0,
      routeProgress: 0,
      route: [],
    }))
    const state = makeMinimalState({
      map,
      enemies: fakeEnemies,
      spawnIntervalMs: 500,
      maxEnemies: 40,
    })
    const result = spawnEnemies(state, 500)
    // takokong 以外はスポーンしない（敵数上限）
    const nonTakokong = result.filter((e) => e.type !== 'takokong')
    expect(nonTakokong).toHaveLength(0)
  })
})

// ─── 境界値・異常系 ───────────────────────────────────────────────

describe('spawnEnemies — 境界値・異常系', () => {
  it('delta=0 のとき何もスポーンしない（spawnTimer も変化しない）', () => {
    const state = makeMinimalState({ spawnTimer: 0 })
    const result = spawnEnemies(state, 0)
    expect(result).toEqual([])
    expect(state.spawnTimer).toBe(0)
  })
})

// ─── 状態遷移 ────────────────────────────────────────────────────

describe('spawnEnemies — 状態遷移', () => {
  it('takokongSpawned=true のとき elapsedMs+delta >= 170000 でも takokong をスポーンしない', () => {
    const state = makeMinimalState({ takokongSpawned: true, elapsedMs: 0 })
    const result = spawnEnemies(state, 200_000)
    const takokongs = result.filter((e) => e.type === 'takokong')
    expect(takokongs).toHaveLength(0)
  })

  it('takokong スポーン後に state.takokongSpawned が true に書き換えられている', () => {
    const state = makeMinimalState({ takokongSpawned: false, elapsedMs: 169_999 })
    spawnEnemies(state, 1)
    expect(state.takokongSpawned).toBe(true)
  })

  it('state.spawnTimer が呼び出しのたびに deltaMS ずつ累積される', () => {
    const state = makeMinimalState({ spawnTimer: 0 })
    spawnEnemies(state, 100)
    expect(state.spawnTimer).toBe(100)
    spawnEnemies(state, 200)
    expect(state.spawnTimer).toBe(300)
  })
})

// ─── マップが空の場合（クラッシュしない確認） ─────────────────────

describe('spawnEnemies — マップ条件が満たされないときクラッシュしない', () => {
  it('rice_field パネルが存在しないマップで spawnEnemies がクラッシュしない', () => {
    const state = makeMinimalState({
      map: makeAllPathMap(),
      spawnTimer: 0,
    })
    expect(() => spawnEnemies(state, 1000)).not.toThrow()
  })

  it('空マップでも spawnEnemies がクラッシュしない', () => {
    const state = makeMinimalState({ map: [] as MapPanel[][] })
    expect(() => spawnEnemies(state, 1000)).not.toThrow()
  })
})

// ─── ID フォーマット ─────────────────────────────────────────────

describe('spawnEnemies — ID フォーマット', () => {
  it('初期スポーンの ground 敵の id が "ground-" で始まる', () => {
    const state = createInitialGameState()
    state.phase = 'playing'
    const result = spawnEnemies(state, 1)
    const grounds = result.filter((e) => e.type === 'ground')
    expect(grounds.length).toBeGreaterThanOrEqual(1)
    for (const g of grounds) {
      expect(g.id.startsWith('ground-')).toBe(true)
    }
  })

  it('takokong がスポーンした敵の id が "takokong-" で始まる', () => {
    const state = makeMinimalState({ takokongSpawned: false, elapsedMs: 170_000 })
    const result = spawnEnemies(state, 1)
    const takokongs = result.filter((e) => e.type === 'takokong')
    expect(takokongs.length).toBe(1)
    expect(takokongs[0].id.startsWith('takokong-')).toBe(true)
  })
})

// ─── スポーン位置 ────────────────────────────────────────────────

describe('spawnEnemies — スポーン位置', () => {
  it('初期 ground スポーンの位置がマップの端の path タイル付近である（centerY 列 y=12, x=0）', () => {
    const state = createInitialGameState()
    state.phase = 'playing'
    const result = spawnEnemies(state, 1)
    const grounds = result.filter((e) => e.type === 'ground')
    expect(grounds.length).toBeGreaterThanOrEqual(1)
    // generateMap(19, 25): centerX=9, centerY=12。x=0, y=12 は path で端からの距離が最小
    const cols = 19
    const rows = 25
    const offsetX = -(cols * TILE_SIZE) / 2
    const offsetY = -(rows * TILE_SIZE) / 2
    const expectedX = 0 * TILE_SIZE + TILE_SIZE / 2 + offsetX
    const expectedY = 12 * TILE_SIZE + TILE_SIZE / 2 + offsetY
    for (const g of grounds) {
      expect(g.x).toBeCloseTo(expectedX, 0)
      expect(g.y).toBeCloseTo(expectedY, 0)
    }
  })
})
