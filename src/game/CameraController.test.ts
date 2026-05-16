import { describe, it, expect } from 'vitest'
import { resetCamera, calcShakeOffset, applyZoom } from './CameraController'
import { VIEW_WIDTH, VIEW_HEIGHT } from '../types/GameState'

describe('resetCamera', () => {
  it('VIEW_WIDTH/2, VIEW_HEIGHT/2, scale=1 を返す', () => {
    const cam = resetCamera()
    expect(cam.x).toBe(VIEW_WIDTH / 2)
    expect(cam.y).toBe(VIEW_HEIGHT / 2)
    expect(cam.scale).toBe(1)
  })
})

describe('calcShakeOffset', () => {
  it('remainingMs=0 のとき dx=0, dy=0', () => {
    const { dx, dy } = calcShakeOffset({ remainingMs: 0, intensity: 10 }, 16)
    expect(dx).toBe(0)
    expect(dy).toBe(0)
  })

  it('remainingMs=0 のとき nextShake.remainingMs=0', () => {
    const { nextShake } = calcShakeOffset({ remainingMs: 0, intensity: 10 }, 16)
    expect(nextShake.remainingMs).toBe(0)
  })

  it('remainingMs>0 のとき nextShake.remainingMs が減る', () => {
    const { nextShake } = calcShakeOffset(
      { remainingMs: 500, intensity: 8 },
      16
    )
    expect(nextShake.remainingMs).toBe(484)
  })

  it('remainingMs>0 のとき dx が [-intensity, +intensity] の範囲内', () => {
    const intensity = 8
    for (let i = 0; i < 50; i++) {
      const { dx } = calcShakeOffset({ remainingMs: 500, intensity }, 16)
      expect(dx).toBeGreaterThanOrEqual(-intensity)
      expect(dx).toBeLessThanOrEqual(intensity)
    }
  })

  it('remainingMs>0 のとき dy が [-intensity, +intensity] の範囲内', () => {
    const intensity = 8
    for (let i = 0; i < 50; i++) {
      const { dy } = calcShakeOffset({ remainingMs: 500, intensity }, 16)
      expect(dy).toBeGreaterThanOrEqual(-intensity)
      expect(dy).toBeLessThanOrEqual(intensity)
    }
  })
})

describe('applyZoom', () => {
  const cam = { x: 200, y: 300, scale: 1 }

  it('t=0 でスケールが変化しない', () => {
    const result = applyZoom(cam, 2, 0)
    expect(result.scale).toBeCloseTo(1)
  })

  it('t=1 で targetScale になる', () => {
    const result = applyZoom(cam, 2, 1)
    expect(result.scale).toBeCloseTo(2)
  })

  it('t=0.5 でイージングが適用されている（単純線形でない）', () => {
    const linear = cam.scale + (2 - cam.scale) * 0.5 // 1.5
    const result = applyZoom(cam, 2, 0.5)
    // easeInOut(0.5) = 0.5 なので linear と同じ値になるが、
    // easeInOut(0.25) = 0.125、easeInOut(0.75) = 0.875 で非線形を確認
    const at25 = applyZoom(cam, 2, 0.25).scale
    const at75 = applyZoom(cam, 2, 0.75).scale
    // 線形なら 1.25, 1.75 になるはず
    expect(at25).not.toBeCloseTo(1.25)
    expect(at75).not.toBeCloseTo(1.75)
    // t=0.5 での値は 1.5（easeInOut(0.5)=0.5）
    expect(result.scale).toBeCloseTo(linear)
  })
})
