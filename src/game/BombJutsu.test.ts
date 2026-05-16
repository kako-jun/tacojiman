import { describe, it, expect } from 'vitest'
import { applyBombDamage } from './BombJutsu'
import type { GameState, EnemyState } from '../types/GameState'
import { createInitialGameState } from '../types/GameState'

function makeEnemy(id: string, hp: number, x = 0, y = 0): EnemyState {
  return {
    id,
    type: 'ground',
    hp,
    speed: 1,
    x,
    y,
    routeProgress: 0,
    route: [],
  }
}

function makeState(enemies: EnemyState[]): GameState {
  const state = createInitialGameState()
  state.enemies = enemies
  return state
}

describe('applyBombDamage', () => {
  it('proton: ビーム上（水平方向 |y|<=20）の敵に 1 ダメージ', () => {
    // #38: proton は線分判定。x=0,y=0 のビームは |y|<=20 が当たる
    const state = makeState([makeEnemy('a', 3, 0, 0), makeEnemy('b', 5, 100, 0)])
    const result = applyBombDamage(state, 'proton')
    expect(result.hitResults.get('a')).toBe(2)
    expect(result.hitResults.get('b')).toBe(4)
  })

  it('proton: ビームから縦に離れた敵はダメージなし', () => {
    // #38: |y|>20 はビーム外
    const state = makeState([makeEnemy('a', 3, 0, 50)])
    const result = applyBombDamage(state, 'proton')
    expect(result.hitResults.has('a')).toBe(false)
  })

  it('proton: HP <= 0 の敵が state.enemies から除去される', () => {
    const state = makeState([makeEnemy('a', 1, 0, 0), makeEnemy('b', 3, 0, 0)])
    applyBombDamage(state, 'proton')
    expect(state.enemies.find((e) => e.id === 'a')).toBeUndefined()
    expect(state.enemies.find((e) => e.id === 'b')).toBeDefined()
  })

  it('sol: radius=150 以内の敵だけダメージ、外の敵はダメージなし', () => {
    const inside = makeEnemy('inside', 5, 100, 0)
    const outside = makeEnemy('outside', 5, 200, 0)
    const state = makeState([inside, outside])
    const result = applyBombDamage(state, 'sol')
    expect(result.hitResults.get('inside')).toBe(3)
    expect(result.hitResults.has('outside')).toBe(false)
  })

  it('muteki: 全敵に1ダメージ', () => {
    const state = makeState([makeEnemy('a', 4), makeEnemy('b', 2)])
    const result = applyBombDamage(state, 'muteki')
    expect(result.hitResults.get('a')).toBe(3)
    expect(result.hitResults.get('b')).toBe(1)
  })

  it('jakuhou: 全敵に2ダメージ', () => {
    const state = makeState([makeEnemy('a', 5), makeEnemy('b', 3)])
    const result = applyBombDamage(state, 'jakuhou')
    expect(result.hitResults.get('a')).toBe(3)
    expect(result.hitResults.get('b')).toBe(1)
  })

  it('muddy: ダメージなし（hitResults が空）、地雷が 1 個設置される', () => {
    const state = makeState([makeEnemy('a', 3)])
    const result = applyBombDamage(state, 'muddy')
    expect(result.hitResults.size).toBe(0)
    expect(state.mines).toHaveLength(1)
  })

  it('sentry: ダメージなし、砲台が 1 基設置される', () => {
    const state = makeState([makeEnemy('a', 3)])
    const result = applyBombDamage(state, 'sentry')
    expect(result.hitResults.size).toBe(0)
    expect(state.sentries).toHaveLength(1)
  })

  it('bunshin: ダメージなし、分身が 2 つ設置される', () => {
    const state = makeState([makeEnemy('a', 3)])
    const result = applyBombDamage(state, 'bunshin')
    expect(result.hitResults.size).toBe(0)
    expect(state.decoys).toHaveLength(2)
  })

  it('HP=1 の敵が proton ダメージで除去される（hp=0 → フィルタ）', () => {
    const state = makeState([makeEnemy('x', 1, 0, 0)])
    applyBombDamage(state, 'proton')
    expect(state.enemies).toHaveLength(0)
  })

  it('takokong（hp=42）が proton で hp=41 になる（即死しない）', () => {
    const takokong: EnemyState = {
      id: 'tako1',
      type: 'takokong',
      hp: 42,
      speed: 1,
      x: 0,
      y: 0,
      routeProgress: 0,
      route: [],
    }
    const state = makeState([takokong])
    applyBombDamage(state, 'proton')
    expect(state.enemies[0].hp).toBe(41)
  })

  it('dainsleif: 範囲内敵に初段 1 ダメージが入り、残り 2 段が multiHitBombs に登録される', () => {
    // #38: dainsleif は多段。初段は即時、残り 2 段は multiHitBombs。
    // 範囲 80 なので (0,0) は当たる
    const state = makeState([makeEnemy('a', 5, 0, 0), makeEnemy('b', 2, 0, 0)])
    const result = applyBombDamage(state, 'dainsleif')
    expect(result.hitResults.get('a')).toBe(4)
    expect(result.hitResults.get('b')).toBe(1)
    expect(state.multiHitBombs).toHaveLength(1)
    expect(state.multiHitBombs[0].remainingHits).toBe(2)
  })

  it('dainsleif: 範囲外（>80）の敵は初段ダメージなし', () => {
    const state = makeState([makeEnemy('far', 5, 200, 0)])
    const result = applyBombDamage(state, 'dainsleif')
    expect(result.hitResults.has('far')).toBe(false)
  })

  it('enemies が空配列のとき hitResults も空', () => {
    const state = makeState([])
    const result = applyBombDamage(state, 'proton')
    expect(result.hitResults.size).toBe(0)
    expect(state.enemies).toHaveLength(0)
  })

  it('sol: dist=150 ちょうどの敵はダメージを受ける（境界値）', () => {
    // x=150, y=0 → dist = 150.0
    const atBoundary = makeEnemy('boundary', 5, 150, 0)
    const state = makeState([atBoundary])
    const result = applyBombDamage(state, 'sol')
    expect(result.hitResults.get('boundary')).toBe(3)
  })

  it('sol: dist が 150 を僅かに超える敵はダメージなし（境界値）', () => {
    // x=151, y=0 → dist = 151.0
    const justOutside = makeEnemy('just-outside', 5, 151, 0)
    const state = makeState([justOutside])
    const result = applyBombDamage(state, 'sol')
    expect(result.hitResults.has('just-outside')).toBe(false)
  })
})

// ─── #37 タココング戦への bomb 適用 ───────────────────────────────

describe('applyBombDamage — #37 takokong バリア軽減 + ボーナス', () => {
  function makeTakokongState(hp: number, barrierActive: boolean): GameState {
    const state = createInitialGameState()
    state.enemies = [
      {
        id: 'takokong-1',
        type: 'takokong',
        hp,
        speed: 0.8,
        x: 0,
        y: 0,
        routeProgress: 0,
        route: [],
      },
    ]
    state.takokongState = {
      active: true,
      hp,
      maxHp: 42,
      barrierActive,
      barrierUntilMs: barrierActive ? 999_999 : 0,
      defeated: false,
    }
    return state
  }

  it('proton（damage=1）バリア中はタココング HP が減らない', () => {
    const state = makeTakokongState(42, true)
    // takokong は (0,0) にいるのでビーム上に乗っている
    applyBombDamage(state, 'proton')
    expect(state.takokongState!.hp).toBe(42)
    expect(state.enemies[0].hp).toBe(42)
  })

  it('jakuhou（damage=2）バリア中は damage=1 相当（HP は 1 減る）', () => {
    const state = makeTakokongState(42, true)
    applyBombDamage(state, 'jakuhou')
    expect(state.takokongState!.hp).toBe(41)
  })

  it('proton で HP=1 を撃破するとボーナス +100 が takokongBonus に返る', () => {
    const state = makeTakokongState(1, false)
    const result = applyBombDamage(state, 'proton')
    expect(state.takokongState!.defeated).toBe(true)
    expect(state.takokongState!.active).toBe(false)
    expect(result.takokongBonus).toBe(100)
    expect(state.enemies).toHaveLength(0)
  })

  it('撃破されないボムでは takokongBonus=0', () => {
    const state = makeTakokongState(42, false)
    const result = applyBombDamage(state, 'proton')
    expect(result.takokongBonus).toBe(0)
  })
})
