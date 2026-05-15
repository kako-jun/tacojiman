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
  it('proton: 全敵に1ダメージが入る', () => {
    const state = makeState([makeEnemy('a', 3), makeEnemy('b', 5)])
    const result = applyBombDamage(state, 'proton')
    expect(result.hitResults.get('a')).toBe(2)
    expect(result.hitResults.get('b')).toBe(4)
  })

  it('proton: HP <= 0 の敵が state.enemies から除去される', () => {
    const state = makeState([makeEnemy('a', 1), makeEnemy('b', 3)])
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

  it('muddy: ダメージなし（hitResults が空）', () => {
    const state = makeState([makeEnemy('a', 3)])
    const result = applyBombDamage(state, 'muddy')
    expect(result.hitResults.size).toBe(0)
  })

  it('sentry: ダメージなし', () => {
    const state = makeState([makeEnemy('a', 3)])
    const result = applyBombDamage(state, 'sentry')
    expect(result.hitResults.size).toBe(0)
  })

  it('bunshin: ダメージなし', () => {
    const state = makeState([makeEnemy('a', 3)])
    const result = applyBombDamage(state, 'bunshin')
    expect(result.hitResults.size).toBe(0)
  })

  it('HP=1 の敵が proton ダメージで除去される（hp=0 → フィルタ）', () => {
    const state = makeState([makeEnemy('x', 1)])
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
})
