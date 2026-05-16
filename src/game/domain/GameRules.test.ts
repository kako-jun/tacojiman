import { describe, expect, it } from 'vitest'
import {
  createRotationConfig,
  ENEMY_SPAWN_WEIGHTS,
  MAX_ENEMIES_CAP,
  SPAWN_INTERVAL_MIN_MS,
} from './GameRules'

describe('ENEMY_SPAWN_WEIGHTS (#43)', () => {
  it('合計 1.0', () => {
    const sum =
      ENEMY_SPAWN_WEIGHTS.ground +
      ENEMY_SPAWN_WEIGHTS.water +
      ENEMY_SPAWN_WEIGHTS.air +
      ENEMY_SPAWN_WEIGHTS.underground
    expect(sum).toBeCloseTo(1.0, 5)
  })
  it('ground が最大重み', () => {
    expect(ENEMY_SPAWN_WEIGHTS.ground).toBeGreaterThan(ENEMY_SPAWN_WEIGHTS.water)
    expect(ENEMY_SPAWN_WEIGHTS.water).toBeGreaterThan(ENEMY_SPAWN_WEIGHTS.air)
    expect(ENEMY_SPAWN_WEIGHTS.air).toBeGreaterThan(ENEMY_SPAWN_WEIGHTS.underground)
  })
})

describe('GameRules 定数 (#43)', () => {
  it('SPAWN_INTERVAL_MIN_MS は 200', () => {
    expect(SPAWN_INTERVAL_MIN_MS).toBe(200)
  })
  it('MAX_ENEMIES_CAP は 70', () => {
    expect(MAX_ENEMIES_CAP).toBe(70)
  })
})

describe('createRotationConfig (#41)', () => {
  it('rand=0 で direction=1（< 0.5 のため）、最短 (120s/周)', () => {
    const cfg = createRotationConfig(() => 0)
    expect(cfg.direction).toBe(1)
    // 2π / 120000 ≈ 5.236e-5
    expect(cfg.speed).toBeCloseTo((Math.PI * 2) / 120_000, 8)
  })
  it('rand=0.9999 で direction=-1、最長 (約180s/周)', () => {
    const cfg = createRotationConfig(() => 0.9999)
    expect(cfg.direction).toBe(-1)
    expect(cfg.speed).toBeLessThan((Math.PI * 2) / 120_000)
    expect(cfg.speed).toBeGreaterThan((Math.PI * 2) / 180_000)
  })
  it('速度は常に 2π/(120k〜180k) の範囲内', () => {
    for (let i = 0; i < 50; i++) {
      const cfg = createRotationConfig()
      expect(cfg.speed).toBeLessThanOrEqual((Math.PI * 2) / 120_000)
      expect(cfg.speed).toBeGreaterThanOrEqual((Math.PI * 2) / 180_000)
      expect([1, -1]).toContain(cfg.direction)
    }
  })
})
