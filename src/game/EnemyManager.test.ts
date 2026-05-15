import { describe, expect, it } from 'vitest'
import { ENEMY_SPECS, spawnEnemies } from './EnemyManager'
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
    ...overrides,
  }
}

// path x=0 が存在しないマップ（全セル path だが x=1 から始まる）
function makeNoPathX0Map(): MapPanel[][] {
  return [
    [
      { x: 1, y: 0, type: 'path', connections: { north: false, south: false, east: false, west: false } },
    ],
  ]
}

// rice_field が存在しないマップ（全セル path）
function makeAllPathMap(): MapPanel[][] {
  return [
    [
      { x: 0, y: 0, type: 'path', connections: { north: false, south: false, east: false, west: false } },
    ],
  ]
}

// water パネルが y=0 に存在するマップ
function makeWaterY0Map(): MapPanel[][] {
  return [
    [
      { x: 0, y: 0, type: 'water', connections: { north: false, south: false, east: false, west: false } },
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

describe('spawnEnemies', () => {
  it('elapsedMs=0 では空配列を返す（まだスポーンタイミングではない）', () => {
    const state = createInitialGameState()
    state.phase = 'playing'
    const result = spawnEnemies(state, 0)
    expect(result).toEqual([])
  })

  it('spawnTimer が 30000 に達したとき ground が1体スポーンする', () => {
    const state = createInitialGameState()
    state.phase = 'playing'
    // spawnTimer を 29999 に設定してから delta=1 で30000に到達させる
    state.spawnTimer = 29_999
    const result = spawnEnemies(state, 1)
    const grounds = result.filter((e) => e.type === 'ground')
    expect(grounds.length).toBeGreaterThanOrEqual(1)
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

  it('タイマーが閾値ちょうどの状態で delta=0 ではスポーンしない', () => {
    const state = makeMinimalState({ spawnTimer: 30_000 })
    const result = spawnEnemies(state, 0)
    const grounds = result.filter((e) => e.type === 'ground')
    expect(grounds).toHaveLength(0)
  })

  it('delta が 60001（2区間分超）でも ground は1体だけスポーンする（条件は1回しか評価されない）', () => {
    // prevTimer=0, nextTimer=60001 → floor(0/30000)=0 < floor(60001/30000)=2 だが if 分岐は1回
    const state = createInitialGameState()
    state.phase = 'playing'
    state.spawnTimer = 0
    const result = spawnEnemies(state, 60_001)
    const grounds = result.filter((e) => e.type === 'ground')
    expect(grounds).toHaveLength(1)
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
  it('path x=0 のパネルが存在しないマップで ground がスポーンしない', () => {
    const state = makeMinimalState({
      map: makeNoPathX0Map(),
      spawnTimer: 29_999,
    })
    const result = spawnEnemies(state, 1)
    const grounds = result.filter((e) => e.type === 'ground')
    expect(grounds).toHaveLength(0)
  })

  it('rice_field パネルが存在しないマップで underground がスポーンしない', () => {
    const state = makeMinimalState({
      map: makeAllPathMap(),
      spawnTimer: 29_999,
    })
    const result = spawnEnemies(state, 1)
    const undergrounds = result.filter((e) => e.type === 'underground')
    expect(undergrounds).toHaveLength(0)
  })
})

// ─── water スポーン ───────────────────────────────────────────────

describe('spawnEnemies — water スポーン', () => {
  it('water パネル(y=0)が存在するマップで water がスポーンする', () => {
    const state = makeMinimalState({
      map: makeWaterY0Map(),
      spawnTimer: 29_999,
    })
    const result = spawnEnemies(state, 1)
    const waters = result.filter((e) => e.type === 'water')
    expect(waters.length).toBeGreaterThanOrEqual(1)
  })

  it('water パネルが y=0 でない場合は water がスポーンしない', () => {
    // y=1 の water パネル（フィルタ条件 p.y === 0 を満たさない）
    const mapWithWaterY1: MapPanel[][] = [
      [
        { x: 0, y: 0, type: 'path', connections: { north: false, south: false, east: false, west: false } },
        { x: 0, y: 1, type: 'water', connections: { north: false, south: false, east: false, west: false } },
      ],
    ]
    const state = makeMinimalState({
      map: mapWithWaterY1,
      spawnTimer: 29_999,
    })
    const result = spawnEnemies(state, 1)
    const waters = result.filter((e) => e.type === 'water')
    expect(waters).toHaveLength(0)
  })
})

// ─── スポーン位置 ────────────────────────────────────────────────

describe('spawnEnemies — スポーン位置', () => {
  it('ground がスポーンした敵の x 座標が offsetX 付近（マップ端 x=0 列）である', () => {
    const state = createInitialGameState()
    state.phase = 'playing'
    state.spawnTimer = 29_999
    const result = spawnEnemies(state, 1)
    const grounds = result.filter((e) => e.type === 'ground')
    expect(grounds.length).toBeGreaterThanOrEqual(1)
    // x=0 のパネル → ローカル座標 = 0 * TILE_SIZE + TILE_SIZE/2 + offsetX = offsetX + TILE_SIZE/2
    // cols=19, offsetX = -(19 * TILE_SIZE) / 2
    const cols = 19
    const offsetX = -(cols * TILE_SIZE) / 2
    const expectedX = 0 * TILE_SIZE + TILE_SIZE / 2 + offsetX
    for (const g of grounds) {
      expect(g.x).toBeCloseTo(expectedX, 0)
    }
  })

  it('air がスポーンした敵の x が offsetX - 200 付近である', () => {
    const state = createInitialGameState()
    state.phase = 'playing'
    state.spawnTimer = 44_999
    const result = spawnEnemies(state, 1)
    const airs = result.filter((e) => e.type === 'air')
    expect(airs.length).toBeGreaterThanOrEqual(1)
    const cols = 19
    const offsetX = -(cols * TILE_SIZE) / 2
    for (const a of airs) {
      expect(a.x).toBeCloseTo(offsetX - 200, 0)
    }
  })
})

// ─── ID フォーマット ─────────────────────────────────────────────

describe('spawnEnemies — ID フォーマット', () => {
  it('ground がスポーンした敵の id が "ground-" で始まる', () => {
    const state = createInitialGameState()
    state.phase = 'playing'
    state.spawnTimer = 29_999
    const result = spawnEnemies(state, 1)
    const grounds = result.filter((e) => e.type === 'ground')
    expect(grounds.length).toBeGreaterThanOrEqual(1)
    for (const g of grounds) {
      expect(g.id.startsWith('ground-')).toBe(true)
    }
  })

  it('takokong がスポーンした敵の id が "takokong-" で始まる', () => {
    const state = makeMinimalState({ takokongSpawned: false, elapsedMs: 170_000 })
    const result = spawnEnemies(state, 0)
    const takokongs = result.filter((e) => e.type === 'takokong')
    expect(takokongs.length).toBe(1)
    expect(takokongs[0].id.startsWith('takokong-')).toBe(true)
  })
})
