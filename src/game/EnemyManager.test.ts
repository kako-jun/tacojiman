import { describe, expect, it } from 'vitest'
import { ENEMY_SPECS, spawnEnemies } from './EnemyManager'
import { createInitialGameState } from '../types/GameState'

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
