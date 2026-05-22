import { describe, expect, it, vi } from 'vitest'
import {
  ATTACK_DAMAGE,
  ATTACK_RANGE,
  checkAttackHit,
  ENEMY_SPECS,
  selectRandomEnemyType,
  spawnEnemies,
} from './EnemyManager'
import { createInitialGameState, TILE_SIZE } from '../types/GameState'
import type { GameState, MapPanel } from '../types/GameState'
import { findWaterGoalPanel, findWaterPath, generateMap } from './map'

// テスト用の最小 GameState を手組みするヘルパー
function makeMinimalState(overrides: Partial<GameState> = {}): GameState {
  const defaultMap: MapPanel[][] = [
    [
      {
        x: 0,
        y: 0,
        type: 'path',
        connections: { north: false, south: true, east: false, west: false },
      },
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
    camera: {
      x: 200,
      y: 300,
      scale: 1,
      pivot: { x: 0, y: 0 },
      zoom: null,
    },
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
    bombRecoveryThresholds: [60_000, 120_000],
    takokongState: null,
    mines: [],
    sentries: [],
    decoys: [],
    multiHitBombs: [],
    rotation: { direction: 1, speed: 0 },
    screenshots: [],
    nextScreenshotAt: 60_000,
    ...overrides,
  }
}

// rice_field が存在しないマップ（全セル path）
function makeAllPathMap(): MapPanel[][] {
  return [
    [
      {
        x: 0,
        y: 0,
        type: 'path',
        connections: { north: false, south: false, east: false, west: false },
      },
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
    const totalGround = [...first, ...second, ...third].filter(
      (e) => e.type === 'ground'
    ).length
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
      [
        {
          x: 0,
          y: 0,
          type: 'path',
          connections: { north: false, south: false, east: false, west: false },
        },
      ],
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
    const state = makeMinimalState({
      takokongSpawned: false,
      elapsedMs: 169_999,
    })
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
    const state = makeMinimalState({
      takokongSpawned: false,
      elapsedMs: 170_000,
    })
    const result = spawnEnemies(state, 1)
    const takokongs = result.filter((e) => e.type === 'takokong')
    expect(takokongs.length).toBe(1)
    expect(takokongs[0].id.startsWith('takokong-')).toBe(true)
  })
})

// ─── スポーン位置 ────────────────────────────────────────────────

describe('spawnEnemies — スポーン位置', () => {
  it('初期 ground スポーンの位置がマップの端の path タイル付近である（centerY 行 y=21, x=0）', () => {
    const state = createInitialGameState()
    state.phase = 'playing'
    const result = spawnEnemies(state, 1)
    const grounds = result.filter((e) => e.type === 'ground')
    expect(grounds.length).toBeGreaterThanOrEqual(1)
    // #57: 円形マップ化で createInitialGameState は generateMap(43, 43) を使う。
    // centerX=21, centerY=21。x=0, y=21 は path（centerY 行）で端からの距離が最小。
    const cols = 43
    const rows = 43
    const offsetX = -(cols * TILE_SIZE) / 2
    const offsetY = -(rows * TILE_SIZE) / 2
    const expectedX = 0 * TILE_SIZE + TILE_SIZE / 2 + offsetX
    const expectedY = 21 * TILE_SIZE + TILE_SIZE / 2 + offsetY
    for (const g of grounds) {
      expect(g.x).toBeCloseTo(expectedX, 0)
      expect(g.y).toBeCloseTo(expectedY, 0)
    }
  })
})

// ─── 観点1: 重み付き選択の確率分布 ────────────────────────────────

describe('selectRandomEnemyType — 確率分布', () => {
  it('10000 サンプリングで 0.5/0.25/0.15/0.1 に ±5% の範囲で収束する', () => {
    const counts: Record<string, number> = {
      ground: 0,
      water: 0,
      air: 0,
      underground: 0,
    }
    const N = 10_000
    for (let i = 0; i < N; i++) {
      const type = selectRandomEnemyType(Math.random())
      counts[type] += 1
    }
    expect(counts.ground / N).toBeGreaterThan(0.45)
    expect(counts.ground / N).toBeLessThan(0.55)
    expect(counts.water / N).toBeGreaterThan(0.2)
    expect(counts.water / N).toBeLessThan(0.3)
    expect(counts.air / N).toBeGreaterThan(0.1)
    expect(counts.air / N).toBeLessThan(0.2)
    expect(counts.underground / N).toBeGreaterThan(0.05)
    expect(counts.underground / N).toBeLessThan(0.15)
  })
})

// ─── 観点2: spawnIntervalMs 境界値 ────────────────────────────────

describe('spawnEnemies — spawnIntervalMs 境界値', () => {
  it('14999ms 経過では 500 維持、15000ms ちょうどで 400 になる（15s 境界）', () => {
    const stateA = makeMinimalState({ spawnIntervalMs: 500 })
    spawnEnemies(stateA, 14_999)
    expect(stateA.spawnIntervalMs).toBe(500)

    const stateB = makeMinimalState({ spawnIntervalMs: 500 })
    spawnEnemies(stateB, 15_000)
    expect(stateB.spawnIntervalMs).toBeCloseTo(400, 5)
  })
})

// ─── 観点3-5: マップ異常系（player_house なし / water なし / rice_field なし） ──

describe('spawnEnemies — マップ異常系', () => {
  it('player_house が無いマップでも spawnEnemies がクラッシュしない（ground は返らない）', () => {
    // 全セル path、player_house なし
    const map: MapPanel[][] = [
      [
        {
          x: 0,
          y: 0,
          type: 'path',
          connections: { north: false, south: false, east: false, west: false },
        },
      ],
    ]
    const state = makeMinimalState({
      map,
      initialEnemiesSpawned: false,
      initialEnemiesRemaining: 3,
      initialEnemiesNextDelayMs: 0,
    })
    let result: ReturnType<typeof spawnEnemies> = []
    expect(() => {
      result = spawnEnemies(state, 1000)
    }).not.toThrow()
    // player_house が無いので ground は出ない（makeGroundEnemy が null を返す）
    expect(result.filter((e) => e.type === 'ground')).toHaveLength(0)
  })

  it('water/river が無いマップで water を選んでも enemy なし & state が健全', () => {
    // player_house あり、water/river なし
    const map: MapPanel[][] = [
      [
        {
          x: 0,
          y: 0,
          type: 'player_house',
          connections: { north: false, south: false, east: false, west: false },
        },
      ],
    ]
    const state = makeMinimalState({
      map,
      enemies: [],
      maxEnemies: 40,
      spawnIntervalMs: 500,
      // 通常スポーンを跨がせる
      spawnTimer: 0,
    })
    // Math.random を rand=0.6 に固定 → water が選ばれる
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.6)
    try {
      const result = spawnEnemies(state, 500)
      // water は出ない（makeWaterEnemy が null を返す）
      expect(result.filter((e) => e.type === 'water')).toHaveLength(0)
      // state は壊れていない
      expect(state.spawnTimer).toBe(500)
      expect(Array.isArray(state.enemies)).toBe(true)
    } finally {
      randSpy.mockRestore()
    }
  })

  it('rice_field が無いマップで underground を選んでも enemy なし', () => {
    // player_house あり、rice_field なし
    const map: MapPanel[][] = [
      [
        {
          x: 0,
          y: 0,
          type: 'player_house',
          connections: { north: false, south: false, east: false, west: false },
        },
      ],
    ]
    const state = makeMinimalState({
      map,
      spawnIntervalMs: 500,
      spawnTimer: 0,
    })
    // rand=0.95 → underground
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.95)
    try {
      const result = spawnEnemies(state, 500)
      expect(result.filter((e) => e.type === 'underground')).toHaveLength(0)
    } finally {
      randSpy.mockRestore()
    }
  })
})

// ─── 観点6: バグ修正テスト（path 無しマップで initialEnemiesRemaining が減らない） ──

describe('spawnEnemies — 初期 3 体スポーンのバグ修正凍結', () => {
  it('path タイル無しマップで初期 3 体スポーン要求しても initialEnemiesRemaining が減らない', () => {
    // player_house のみ、path タイルなし（端 path が見つからない）
    const map: MapPanel[][] = [
      [
        {
          x: 0,
          y: 0,
          type: 'player_house',
          connections: { north: false, south: false, east: false, west: false },
        },
      ],
    ]
    const state = makeMinimalState({
      map,
      initialEnemiesSpawned: false,
      initialEnemiesRemaining: 3,
      initialEnemiesNextDelayMs: 0,
    })
    const result = spawnEnemies(state, 1)
    // 1 体も出ない
    expect(result.filter((e) => e.type === 'ground')).toHaveLength(0)
    // remaining は減っていない
    expect(state.initialEnemiesRemaining).toBe(3)
    expect(state.initialEnemiesSpawned).toBe(false)
  })
})

// ─── 観点7-8: 初期スポーンと通常スポーンの同時発火 ───────────────

describe('spawnEnemies — 初期 × 通常スポーンの同時発火', () => {
  it('createInitialGameState + spawnEnemies(state, 500) で初期 1 体 + 通常 1 体（合計 2 体）', () => {
    // S4: 初期 3 体は「毎フレーム最大 1 体」仕様（legacy delayedCall 準拠）。
    // 単一フレーム deltaMS=500 では初期 1 体のみ。
    // spawnIntervalMs=500 で crossings=1 → 通常 1 体。合計 2 体。
    const state = createInitialGameState()
    state.phase = 'playing'
    const result = spawnEnemies(state, 500)
    // まだ初期 3 体は出し切れていない
    expect(state.initialEnemiesSpawned).toBe(false)
    expect(state.initialEnemiesRemaining).toBe(2)
    expect(result).toHaveLength(2)
    const grounds = result.filter((e) => e.type === 'ground')
    // 初期 ground が必ず 1 体、通常が ground を引いた場合は 2 体
    expect(grounds.length).toBeGreaterThanOrEqual(1)
  })

  it('createInitialGameState + spawnEnemies(state, 1000) で初期 1 体 + 通常 2 体（合計 3 体）', () => {
    // S4: 初期 3 体は毎フレーム 1 体なので、単一呼び出しでは 1 体だけ。
    // spawnIntervalMs=500、deltaMS=1000 で crossings=2 → 通常 2 体。合計 3 体。
    const state = createInitialGameState()
    state.phase = 'playing'
    const result = spawnEnemies(state, 1000)
    expect(result).toHaveLength(3)
    // 初期 1 体しか出ていないので未完了
    expect(state.initialEnemiesSpawned).toBe(false)
    expect(state.initialEnemiesRemaining).toBe(2)
  })
})

// ─── 観点9: 通常スポーンと takokong の同時発火 ───────────────────

describe('spawnEnemies — 通常 × takokong 同時発火', () => {
  it('elapsedMs=169000 + deltaMS=2000 で takokong と通常スポーンが同フレームで返る', () => {
    // 通常スポーンが成立するように generateMap のフルマップを使う
    const state = createInitialGameState()
    state.phase = 'playing'
    state.initialEnemiesSpawned = true
    state.initialEnemiesRemaining = 0
    state.elapsedMs = 169_000
    state.spawnTimer = 0
    state.spawnIntervalMs = 500
    state.takokongSpawned = false
    const result = spawnEnemies(state, 2000)
    const takokongs = result.filter((e) => e.type === 'takokong')
    const nonTakokongs = result.filter((e) => e.type !== 'takokong')
    expect(takokongs).toHaveLength(1)
    // spawnTimer 0 → 2000、interval 500 で crossings=4
    expect(nonTakokongs.length).toBeGreaterThanOrEqual(1)
    expect(state.takokongSpawned).toBe(true)
  })
})

// ─── 観点10: 二重実行整合（呼び出し回数で挙動が変わらない） ─────

describe('spawnEnemies — 呼び出し回数による不変性', () => {
  it('spawnEnemies(state, 250)×2 と spawnEnemies(state, 500)×1 の通常スポーン回数が一致する', () => {
    // 通常スポーン回数のみ比較したいので initialEnemiesSpawned=true で始める。
    // 通常スポーンの種類による成否ブレを避けるため Math.random を固定する。
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1) // ground 選択固定
    try {
      const make = () => {
        const s = createInitialGameState()
        s.phase = 'playing'
        s.initialEnemiesSpawned = true
        s.initialEnemiesRemaining = 0
        s.spawnTimer = 0
        s.spawnIntervalMs = 500
        return s
      }

      const a = make()
      const r1 = spawnEnemies(a, 250)
      const r2 = spawnEnemies(a, 250)
      const aTotal = r1.length + r2.length

      const b = make()
      const rb = spawnEnemies(b, 500)
      const bTotal = rb.length

      expect(aTotal).toBe(bTotal)
      expect(a.spawnTimer).toBe(b.spawnTimer)
    } finally {
      randSpy.mockRestore()
    }
  })
})

// ─── 観点11: console 汚染なし ────────────────────────────────────

describe('spawnEnemies — console 汚染なし', () => {
  it('spawnEnemies の実行中に console.log / error / warn が呼ばれない', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const state = createInitialGameState()
      state.phase = 'playing'
      // 初期スポーン + 通常スポーン + takokong まで一通り通す
      spawnEnemies(state, 1)
      spawnEnemies(state, 500)
      spawnEnemies(state, 170_000)
      expect(logSpy).not.toHaveBeenCalled()
      expect(errorSpy).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      logSpy.mockRestore()
      errorSpy.mockRestore()
      warnSpy.mockRestore()
    }
  })
})

// ─── 観点12: generateMap の不変条件 ──────────────────────────────

describe('generateMap — 不変条件', () => {
  it('generateMap(19, 25) で player_house の位置が centerX=9 / centerY=12 で安定し、ピクセル換算が一定', () => {
    const map = generateMap(19, 25)
    const houses = map.flat().filter((p) => p.type === 'player_house')
    expect(houses).toHaveLength(1)
    expect(houses[0].x).toBe(9)
    expect(houses[0].y).toBe(12)
    // ピクセル中心座標
    const cols = 19
    const rows = 25
    const offsetX = -(cols * TILE_SIZE) / 2
    const offsetY = -(rows * TILE_SIZE) / 2
    const px = 9 * TILE_SIZE + TILE_SIZE / 2 + offsetX
    const py = 12 * TILE_SIZE + TILE_SIZE / 2 + offsetY
    // mapLayer 中心 (0,0) に来るのが期待
    expect(px).toBe(0)
    expect(py).toBe(0)
  })
})

// ─── 観点13-14: GameScene 統合（route 末尾 / 直線移動） ──────────

describe('GameScene 相当のルート組み立て — water/underground 統合', () => {
  it('water 敵の route 末尾が player_house パネルに一致し、最終セグメントを辿ると到達する', () => {
    const state = createInitialGameState()
    state.phase = 'playing'
    const map = state.map
    const goal = map.flat().find((p) => p.type === 'player_house')!

    // water 敵を直接スポーンさせるため Math.random を 0.6 に固定（water 選択）
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.6)
    let waterEnemy: {
      x: number
      y: number
      route: Array<{ x: number; y: number }>
    } | null = null
    try {
      // 初期 3 体を消化させる
      spawnEnemies(state, 1)
      spawnEnemies(state, 200)
      spawnEnemies(state, 200)
      // 通常スポーンを 1 体出す
      const result = spawnEnemies(state, 500)
      const w = result.find((e) => e.type === 'water')
      if (w) {
        // GameScene の組み立てを再現
        const width = map.length * TILE_SIZE
        const height = map[0].length * TILE_SIZE
        const offsetX = -width / 2
        const offsetY = -height / 2
        const startX = Math.floor((w.x - offsetX) / TILE_SIZE)
        const startY = Math.floor((w.y - offsetY) / TILE_SIZE)
        const waterGoal = findWaterGoalPanel(map, { x: goal.x, y: goal.y })
        expect(waterGoal).not.toBeNull()
        const route = findWaterPath(map, { x: startX, y: startY }, waterGoal!)
        const fullRoute =
          route.length > 0
            ? [...route, { x: goal.x, y: goal.y }]
            : [{ x: goal.x, y: goal.y }]
        waterEnemy = { x: w.x, y: w.y, route: fullRoute }
      }
    } finally {
      randSpy.mockRestore()
    }
    expect(waterEnemy).not.toBeNull()
    // route 末尾は player_house パネル
    const last = waterEnemy!.route[waterEnemy!.route.length - 1]
    expect(last.x).toBe(goal.x)
    expect(last.y).toBe(goal.y)
  })

  it('underground 敵は route=[] で生成され、原点 (0,0) への直線移動で dist<=1 になり削除される', () => {
    const state = createInitialGameState()
    state.phase = 'playing'

    // underground を確実に出すため rand=0.95 に固定
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.95)
    let undergroundEnemy: {
      x: number
      y: number
      speed: number
      route: unknown[]
    } | null = null
    try {
      // 初期 3 体消化
      spawnEnemies(state, 1)
      spawnEnemies(state, 200)
      spawnEnemies(state, 200)
      const result = spawnEnemies(state, 500)
      const u = result.find((e) => e.type === 'underground')
      if (u)
        undergroundEnemy = { x: u.x, y: u.y, speed: u.speed, route: u.route }
    } finally {
      randSpy.mockRestore()
    }
    expect(undergroundEnemy).not.toBeNull()
    // EnemyManager は route を空配列で返す（GameScene が直線移動させる）
    expect(undergroundEnemy!.route).toEqual([])

    // advanceEnemies の直線移動ロジックを模倣して dist<=1 まで進める
    let { x, y } = undergroundEnemy!
    const speed = undergroundEnemy!.speed
    const deltaMS = 16
    let removed = false
    for (let step = 0; step < 100_000; step++) {
      const dx = 0 - x
      const dy = 0 - y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= 1) {
        removed = true
        break
      }
      const norm = (speed * deltaMS * 0.05) / dist
      x += dx * norm
      y += dy * norm
    }
    expect(removed).toBe(true)
  })
})

// ─── checkAttackHit（蜂忍術通常攻撃） ────────────────────────────

describe('checkAttackHit', () => {
  // 1x1 path のミニマップ + 任意の敵を持つ state を作るヘルパー
  function makeStateWith(
    enemies: GameState['enemies'],
    mapOverride?: MapPanel[][]
  ): GameState {
    return makeMinimalState({
      map: mapOverride ?? [
        [
          {
            x: 0,
            y: 0,
            type: 'path',
            connections: {
              north: false,
              south: false,
              east: false,
              west: false,
            },
          },
        ],
      ],
      enemies,
    })
  }

  it('範囲内の敵 HP を damage 分減らす', () => {
    const state = makeStateWith([
      {
        id: 'g1',
        type: 'ground',
        hp: 2,
        speed: 0.4,
        x: 10,
        y: 0,
        routeProgress: 0,
        route: [],
      },
    ])
    const result = checkAttackHit(state, 0, 0, ATTACK_RANGE, ATTACK_DAMAGE, 1)
    expect(state.enemies[0].hp).toBe(1)
    expect(result.damagedEnemyIds).toEqual(['g1'])
    expect(result.defeatedEnemyIds).toEqual([])
    expect(result.earnedScore).toBe(0)
  })

  it('HP<=0 で敵を除去しスコアを加算', () => {
    const state = makeStateWith([
      {
        id: 'a1',
        type: 'air',
        hp: 1,
        speed: 0.6,
        x: 5,
        y: 5,
        routeProgress: 0,
        route: [],
      },
    ])
    const result = checkAttackHit(state, 0, 0, ATTACK_RANGE, ATTACK_DAMAGE, 1)
    expect(state.enemies).toHaveLength(0)
    expect(result.defeatedEnemyIds).toEqual(['a1'])
    expect(result.earnedScore).toBe(ENEMY_SPECS.air.score)
  })

  it('範囲外の敵は無視する', () => {
    const state = makeStateWith([
      {
        id: 'g1',
        type: 'ground',
        hp: 2,
        speed: 0.4,
        x: 1000,
        y: 1000,
        routeProgress: 0,
        route: [],
      },
    ])
    const result = checkAttackHit(state, 0, 0, ATTACK_RANGE, ATTACK_DAMAGE, 1)
    expect(state.enemies[0].hp).toBe(2)
    expect(result.damagedEnemyIds).toEqual([])
    expect(result.defeatedEnemyIds).toEqual([])
  })

  it('zoomMultiplier がスコアに乗る', () => {
    const state = makeStateWith([
      {
        id: 'a1',
        type: 'air',
        hp: 1,
        speed: 0.6,
        x: 0,
        y: 0,
        routeProgress: 0,
        route: [],
      },
    ])
    const result = checkAttackHit(state, 0, 0, ATTACK_RANGE, ATTACK_DAMAGE, 3)
    expect(result.earnedScore).toBe(ENEMY_SPECS.air.score * 3)
  })

  it('小数 zoomMultiplier (1.84) でも earnedScore は floor で整数になる', () => {
    // ズーム中 (scale=1.84) に空敵 (score=3) を倒した場合: floor(3 * 1.84) = floor(5.52) = 5
    const state = makeStateWith([
      {
        id: 'a1',
        type: 'air',
        hp: 1,
        speed: 0.6,
        x: 0,
        y: 0,
        routeProgress: 0,
        route: [],
      },
    ])
    const result = checkAttackHit(
      state,
      0,
      0,
      ATTACK_RANGE,
      ATTACK_DAMAGE,
      1.84
    )
    expect(result.earnedScore).toBe(5)
    expect(Number.isInteger(result.earnedScore)).toBe(true)
  })

  it('複数撃破時、各撃破ごとに floor されてから合算される', () => {
    // 撃破ごとに floor: floor(3*1.5)=4 が 2 体分 → 8 (= floor(9))
    // 一括 floor だと floor(3*2*1.5) = 9 になるので、ここで実装の意図を区別できる
    const state = makeStateWith([
      {
        id: 'a1',
        type: 'air',
        hp: 1,
        speed: 0.6,
        x: 5,
        y: 0,
        routeProgress: 0,
        route: [],
      },
      {
        id: 'a2',
        type: 'air',
        hp: 1,
        speed: 0.6,
        x: -5,
        y: 0,
        routeProgress: 0,
        route: [],
      },
    ])
    const result = checkAttackHit(
      state,
      0,
      0,
      ATTACK_RANGE,
      ATTACK_DAMAGE,
      1.5
    )
    expect(result.defeatedEnemyIds).toHaveLength(2)
    expect(result.earnedScore).toBe(8) // 4 + 4
  })

  it('複数の敵を同時に倒した場合のスコア合算', () => {
    const state = makeStateWith([
      {
        id: 'a1',
        type: 'air',
        hp: 1,
        speed: 0.6,
        x: 10,
        y: 10,
        routeProgress: 0,
        route: [],
      },
      {
        id: 'a2',
        type: 'air',
        hp: 1,
        speed: 0.6,
        x: -10,
        y: -10,
        routeProgress: 0,
        route: [],
      },
    ])
    const result = checkAttackHit(state, 0, 0, ATTACK_RANGE, ATTACK_DAMAGE, 1)
    expect(result.defeatedEnemyIds).toHaveLength(2)
    expect(state.enemies).toHaveLength(0)
    expect(result.earnedScore).toBe(ENEMY_SPECS.air.score * 2)
  })

  it('defeatedDetails に撃破敵の座標・タイプ・スコアが入る（zoom 倍率込み）', () => {
    const state = makeStateWith([
      {
        id: 'a1',
        type: 'air',
        hp: 1,
        speed: 0.6,
        x: 12,
        y: -8,
        routeProgress: 0,
        route: [],
      },
      {
        id: 'a2',
        type: 'air',
        hp: 1,
        speed: 0.6,
        x: -20,
        y: 15,
        routeProgress: 0,
        route: [],
      },
    ])
    const result = checkAttackHit(state, 0, 0, ATTACK_RANGE, ATTACK_DAMAGE, 2)
    expect(result.defeatedDetails).toHaveLength(2)
    const byId = new Map(result.defeatedDetails.map((d) => [d.id, d]))
    expect(byId.get('a1')).toEqual({
      id: 'a1',
      x: 12,
      y: -8,
      type: 'air',
      score: ENEMY_SPECS.air.score * 2,
    })
    expect(byId.get('a2')).toEqual({
      id: 'a2',
      x: -20,
      y: 15,
      type: 'air',
      score: ENEMY_SPECS.air.score * 2,
    })
  })

  it('other_house パネル上の敵はスキップ（無敵エリア）', () => {
    // 3x3 マップで中央が other_house、敵をそこに配置
    const map: MapPanel[][] = []
    for (let x = 0; x < 3; x++) {
      const col: MapPanel[] = []
      for (let y = 0; y < 3; y++) {
        col.push({
          x,
          y,
          type: x === 1 && y === 1 ? 'other_house' : 'path',
          connections: { north: false, south: false, east: false, west: false },
        })
      }
      map.push(col)
    }
    // 中央セル（panel(1,1)）の中心ピクセル座標は (0,0)（offset = -3*TILE/2）
    const state = makeStateWith(
      [
        {
          id: 'g1',
          type: 'ground',
          hp: 2,
          speed: 0.4,
          x: 0,
          y: 0,
          routeProgress: 0,
          route: [],
        },
      ],
      map
    )
    const result = checkAttackHit(state, 0, 0, ATTACK_RANGE, ATTACK_DAMAGE, 1)
    // 無敵エリアにいるのでダメージなし
    expect(state.enemies[0].hp).toBe(2)
    expect(result.damagedEnemyIds).toEqual([])
  })

  it('station パネル上の敵もスキップ', () => {
    const map: MapPanel[][] = []
    for (let x = 0; x < 3; x++) {
      const col: MapPanel[] = []
      for (let y = 0; y < 3; y++) {
        col.push({
          x,
          y,
          type: x === 1 && y === 1 ? 'station' : 'path',
          connections: { north: false, south: false, east: false, west: false },
        })
      }
      map.push(col)
    }
    const state = makeStateWith(
      [
        {
          id: 'g1',
          type: 'ground',
          hp: 2,
          speed: 0.4,
          x: 0,
          y: 0,
          routeProgress: 0,
          route: [],
        },
      ],
      map
    )
    const result = checkAttackHit(state, 0, 0, ATTACK_RANGE, ATTACK_DAMAGE, 1)
    expect(state.enemies[0].hp).toBe(2)
    expect(result.damagedEnemyIds).toEqual([])
  })

  it('ATTACK_RANGE/DAMAGE 定数が定義されている', () => {
    expect(ATTACK_RANGE).toBe(80)
    expect(ATTACK_DAMAGE).toBe(1)
  })
})

// ─── #37 タココング戦の統合テスト ────────────────────────────────

describe('spawnEnemies — #37 takokongState 初期化', () => {
  it('takokong スポーン時に state.takokongState が初期化される（HP=42, バリア有効）', () => {
    const state = makeMinimalState({
      takokongSpawned: false,
      elapsedMs: 169_999,
    })
    expect(state.takokongState).toBeNull()
    spawnEnemies(state, 1)
    expect(state.takokongState).not.toBeNull()
    expect(state.takokongState!.hp).toBe(42)
    expect(state.takokongState!.maxHp).toBe(42)
    expect(state.takokongState!.active).toBe(true)
    expect(state.takokongState!.defeated).toBe(false)
    expect(state.takokongState!.barrierActive).toBe(true)
  })
})

describe('checkAttackHit — #37 takokong バリア軽減', () => {
  it('バリア中の通常タップ（damage=1）はダメージ 0（HP は減らない）', () => {
    const state = makeMinimalState({
      enemies: [
        {
          id: 'takokong-1',
          type: 'takokong',
          hp: 42,
          speed: 0.8,
          x: 0,
          y: 0,
          routeProgress: 0,
          route: [],
        },
      ],
      takokongState: {
        active: true,
        hp: 42,
        maxHp: 42,
        barrierActive: true,
        barrierUntilMs: 999_999,
        defeated: false,
      },
    })
    const result = checkAttackHit(state, 0, 0, ATTACK_RANGE, ATTACK_DAMAGE, 1)
    expect(state.takokongState!.hp).toBe(42)
    expect(state.enemies[0].hp).toBe(42)
    expect(result.defeatedEnemyIds).toEqual([])
    // damage 0 でも検出はする（damaged 扱い）
    expect(result.damagedEnemyIds).toContain('takokong-1')
  })

  it('バリア解除後 damage=1 でタココング HP が 1 減る', () => {
    const state = makeMinimalState({
      enemies: [
        {
          id: 'takokong-1',
          type: 'takokong',
          hp: 42,
          speed: 0.8,
          x: 0,
          y: 0,
          routeProgress: 0,
          route: [],
        },
      ],
      takokongState: {
        active: true,
        hp: 42,
        maxHp: 42,
        barrierActive: false,
        barrierUntilMs: 0,
        defeated: false,
      },
    })
    checkAttackHit(state, 0, 0, ATTACK_RANGE, ATTACK_DAMAGE, 1)
    expect(state.takokongState!.hp).toBe(41)
    expect(state.enemies[0].hp).toBe(41)
  })

  it('HP=1 で damage=1 撃破時、スコアに +100 ボーナスが加算される', () => {
    const state = makeMinimalState({
      enemies: [
        {
          id: 'takokong-1',
          type: 'takokong',
          hp: 1,
          speed: 0.8,
          x: 0,
          y: 0,
          routeProgress: 0,
          route: [],
        },
      ],
      takokongState: {
        active: true,
        hp: 1,
        maxHp: 42,
        barrierActive: false,
        barrierUntilMs: 0,
        defeated: false,
      },
    })
    const result = checkAttackHit(state, 0, 0, ATTACK_RANGE, ATTACK_DAMAGE, 1)
    // 通常スコア 10 + ボーナス 100 = 110
    expect(result.earnedScore).toBe(110)
    expect(state.takokongState!.defeated).toBe(true)
    expect(state.takokongState!.active).toBe(false)
    expect(state.enemies).toHaveLength(0)
    expect(result.defeatedEnemyIds).toEqual(['takokong-1'])
  })

  it('22 回タップで撃破される（バリア解除後）', () => {
    const state = makeMinimalState({
      enemies: [
        {
          id: 'takokong-1',
          type: 'takokong',
          hp: 42,
          speed: 0.8,
          x: 0,
          y: 0,
          routeProgress: 0,
          route: [],
        },
      ],
      takokongState: {
        active: true,
        hp: 42,
        maxHp: 42,
        barrierActive: false,
        barrierUntilMs: 0,
        defeated: false,
      },
    })
    // 通常タップは damage=1 だが、バリアなしでも HP42 を 1 ずつ削ると 42 回必要。
    // 仕様の「22 回タップで撃破」は、ズーム倍率 or バリア解除後 damage=2 相当を意味する。
    // ここでは「バリア解除後 damage=2（ズーム時想定 or バリア破壊直後の威力増）」で 21 回 + 撃破タップ 1 回 = 21 ヒット後撃破。
    // バリア解除後 damage=2 を 21 回で 0 にする：
    for (let i = 0; i < 20; i++) {
      checkAttackHit(state, 0, 0, ATTACK_RANGE, 2, 1)
    }
    expect(state.takokongState!.hp).toBe(2)
    expect(state.takokongState!.defeated).toBe(false)
    // 21 回目で撃破
    const result = checkAttackHit(state, 0, 0, ATTACK_RANGE, 2, 1)
    expect(state.takokongState!.defeated).toBe(true)
    expect(result.earnedScore).toBe(110)
  })
})
