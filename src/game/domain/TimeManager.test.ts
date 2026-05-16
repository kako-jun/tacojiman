import { describe, expect, it } from 'vitest'
import {
  calculateGameTime,
  formatGameTime,
  getTimeDifficultyMultiplier,
  parseStartTime,
} from './TimeManager'

describe('parseStartTime (#43)', () => {
  it('7:00 (420) → hour=7 minute=0', () => {
    expect(parseStartTime(420)).toEqual({ hour: 7, minute: 0 })
  })
  it('4:30 (270) → hour=4 minute=30', () => {
    expect(parseStartTime(270)).toEqual({ hour: 4, minute: 30 })
  })
})

describe('calculateGameTime (#43)', () => {
  it('start=7:00 / elapsed=0 → 7:00', () => {
    expect(calculateGameTime(0, 180_000, 420)).toEqual({
      hour: 7,
      minute: 0,
    })
  })
  it('start=7:00 / elapsed=90000(3分の半分) → 7:15', () => {
    expect(calculateGameTime(90_000, 180_000, 420)).toEqual({
      hour: 7,
      minute: 15,
    })
  })
  it('start=7:00 / elapsed=180000(満了) → 7:30', () => {
    expect(calculateGameTime(180_000, 180_000, 420)).toEqual({
      hour: 7,
      minute: 30,
    })
  })
})

describe('formatGameTime (#43)', () => {
  it('1 桁分は 0 パディング', () => {
    expect(formatGameTime({ hour: 7, minute: 5 })).toBe('7:05 AM')
  })
  it('2 桁分はそのまま', () => {
    expect(formatGameTime({ hour: 7, minute: 23 })).toBe('7:23 AM')
  })
})

describe('getTimeDifficultyMultiplier (#43)', () => {
  it('早朝ほど高い', () => {
    expect(getTimeDifficultyMultiplier(4)).toBe(1.5)
    expect(getTimeDifficultyMultiplier(7)).toBe(1.2)
    expect(getTimeDifficultyMultiplier(8)).toBe(1.0)
  })
  it('範囲外は 1.0', () => {
    expect(getTimeDifficultyMultiplier(12)).toBe(1.0)
  })
})
