import { describe, expect, it } from 'vitest'
import {
  calculateBombDamage,
  calculateDistance,
  checkCircularCollision,
  checkRectangularCollision,
} from './DamageCalculator'

describe('calculateDistance (#43)', () => {
  it('原点と (3,4) の距離は 5', () => {
    expect(calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
  it('同じ点は 0', () => {
    expect(calculateDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0)
  })
})

describe('checkCircularCollision (#43)', () => {
  it('境界（距離=radius）は hit', () => {
    expect(
      checkCircularCollision({ x: 0, y: 0 }, { x: 10, y: 0 }, 10)
    ).toBe(true)
  })
  it('範囲外は false', () => {
    expect(
      checkCircularCollision({ x: 0, y: 0 }, { x: 11, y: 0 }, 10)
    ).toBe(false)
  })
})

describe('checkRectangularCollision (#43)', () => {
  const rect = { x: 0, y: 0, w: 10, h: 10 }
  it('内側は true', () => {
    expect(checkRectangularCollision(rect, { x: 5, y: 5 })).toBe(true)
  })
  it('境界は true', () => {
    expect(checkRectangularCollision(rect, { x: 10, y: 10 })).toBe(true)
  })
  it('外側は false', () => {
    expect(checkRectangularCollision(rect, { x: 11, y: 5 })).toBe(false)
  })
})

describe('calculateBombDamage (#43)', () => {
  it('range 外なら 0', () => {
    expect(calculateBombDamage(10, 100, 50)).toBe(0)
  })
  it('距離 0 なら baseDamage 相当', () => {
    expect(calculateBombDamage(10, 0, 100)).toBe(10)
  })
  it('range 半分の距離なら約半分', () => {
    expect(calculateBombDamage(10, 50, 100)).toBe(5)
  })
  it('範囲内は最低 1', () => {
    expect(calculateBombDamage(1, 99, 100)).toBe(1)
  })
  it('range=0 は 0', () => {
    expect(calculateBombDamage(10, 0, 0)).toBe(0)
  })
})
