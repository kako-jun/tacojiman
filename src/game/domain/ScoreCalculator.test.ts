import { describe, expect, it } from 'vitest'
import {
  calculateEndingLevel,
  calculateFinalScore,
  ENDING_THRESHOLDS,
} from './ScoreCalculator'

describe('calculateFinalScore (#43)', () => {
  it('zoom=1 はそのまま', () => {
    expect(calculateFinalScore(100, 1)).toBe(100)
  })
  it('zoom=2.5 は floor で量子化', () => {
    expect(calculateFinalScore(7, 2.5)).toBe(17)
  })
})

describe('calculateEndingLevel (#43)', () => {
  it('閾値ちょうどでレベル境界', () => {
    expect(calculateEndingLevel(ENDING_THRESHOLDS.trueEnd)).toBe('true')
    expect(calculateEndingLevel(ENDING_THRESHOLDS.trueEnd - 1)).toBe('special')
    expect(calculateEndingLevel(ENDING_THRESHOLDS.special)).toBe('special')
    expect(calculateEndingLevel(ENDING_THRESHOLDS.special - 1)).toBe('good')
    expect(calculateEndingLevel(ENDING_THRESHOLDS.good)).toBe('good')
    expect(calculateEndingLevel(ENDING_THRESHOLDS.good - 1)).toBe('normal')
    expect(calculateEndingLevel(ENDING_THRESHOLDS.normal)).toBe('normal')
    expect(calculateEndingLevel(ENDING_THRESHOLDS.normal - 1)).toBe('bad')
  })
  it('0 は bad', () => {
    expect(calculateEndingLevel(0)).toBe('bad')
  })
})
