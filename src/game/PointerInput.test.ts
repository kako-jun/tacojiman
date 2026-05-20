import { describe, expect, it } from 'vitest'
import {
  classifyPointerUp,
  isLongPressing,
  LONG_PRESS_THRESHOLD_MS,
} from './PointerInput'

describe('classifyPointerUp', () => {
  it('閾値未満は short_tap', () => {
    expect(classifyPointerUp(1000, 1000 + 100)).toBe('short_tap')
  })

  it('閾値ちょうどは long_release（境界値）', () => {
    expect(classifyPointerUp(0, LONG_PRESS_THRESHOLD_MS)).toBe('long_release')
  })

  it('閾値を超えれば long_release', () => {
    expect(classifyPointerUp(0, LONG_PRESS_THRESHOLD_MS + 1)).toBe(
      'long_release'
    )
  })

  it('1ms 未満も short_tap', () => {
    expect(classifyPointerUp(100, 100)).toBe('short_tap')
  })

  it('絶対時刻ベースで差分を見る（オフセットがあっても OK）', () => {
    expect(classifyPointerUp(1_000_000, 1_000_000 + (LONG_PRESS_THRESHOLD_MS - 1))).toBe('short_tap')
    expect(classifyPointerUp(1_000_000, 1_000_000 + (LONG_PRESS_THRESHOLD_MS + 1))).toBe('long_release')
  })
})

describe('isLongPressing', () => {
  it('押し下げ時刻からの経過が閾値未満なら false', () => {
    expect(isLongPressing(0, LONG_PRESS_THRESHOLD_MS - 1)).toBe(false)
  })

  it('閾値ちょうどで true', () => {
    expect(isLongPressing(0, LONG_PRESS_THRESHOLD_MS)).toBe(true)
  })

  it('閾値超で true', () => {
    expect(isLongPressing(1000, 1000 + 500)).toBe(true)
  })
})
