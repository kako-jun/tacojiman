import { describe, expect, it } from 'vitest'
import {
  computeNextScreenshotAt,
  isScreenshotLimitReached,
  SCREENSHOT_INTERVAL_MS,
  SCREENSHOT_MAX_COUNT,
  shouldTakeScreenshot,
} from './ScreenshotManager'

describe('shouldTakeScreenshot (#42)', () => {
  it('elapsed < next なら false', () => {
    expect(shouldTakeScreenshot(59_000, 60_000)).toBe(false)
  })
  it('elapsed == next なら true', () => {
    expect(shouldTakeScreenshot(60_000, 60_000)).toBe(true)
  })
  it('elapsed > next なら true', () => {
    expect(shouldTakeScreenshot(61_000, 60_000)).toBe(true)
  })
})

describe('computeNextScreenshotAt (#42)', () => {
  it('デフォルトで 60000 加算', () => {
    expect(computeNextScreenshotAt(60_000)).toBe(120_000)
  })
  it('intervalMs を指定可能', () => {
    expect(computeNextScreenshotAt(10_000, 5_000)).toBe(15_000)
  })
})

describe('isScreenshotLimitReached (#42)', () => {
  it('既定上限 3 枚で 2 はまだ false', () => {
    expect(isScreenshotLimitReached(2)).toBe(false)
  })
  it('3 で true', () => {
    expect(isScreenshotLimitReached(3)).toBe(true)
  })
})

describe('SCREENSHOT 定数 (#42)', () => {
  it('60s × 3 枚', () => {
    expect(SCREENSHOT_INTERVAL_MS).toBe(60_000)
    expect(SCREENSHOT_MAX_COUNT).toBe(3)
  })
})
