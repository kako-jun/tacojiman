import { describe, it, expect } from 'vitest'
import {
  resetCamera,
  calcShakeOffset,
  applyZoom,
  startZoomIn,
  followZoom,
  zoomOut,
  updateZoom,
  getCurrentZoom,
  screenToWorld,
} from './CameraController'
import { VIEW_WIDTH, VIEW_HEIGHT } from '../types/GameState'
import type { CameraState } from '../types/GameState'

function makeCam(overrides: Partial<CameraState> = {}): CameraState {
  return {
    x: VIEW_WIDTH / 2,
    y: VIEW_HEIGHT / 2,
    scale: 1,
    pivot: { x: 0, y: 0 },
    zoom: null,
    ...overrides,
  }
}

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
  const cam = {
    x: 200,
    y: 300,
    scale: 1,
    pivot: { x: 0, y: 0 },
    zoom: null,
  }

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

describe('startZoomIn', () => {
  it('zoom anim を設定し fromScale=現在 scale、toScale=target', () => {
    const cam = startZoomIn(makeCam(), 100, 50, 3.0, 300)
    expect(cam.zoom).not.toBeNull()
    expect(cam.zoom!.fromScale).toBe(1)
    expect(cam.zoom!.toScale).toBe(3.0)
    expect(cam.zoom!.toPivot).toEqual({ x: 100, y: 50 })
    expect(cam.zoom!.durationMs).toBe(300)
    expect(cam.zoom!.elapsedMs).toBe(0)
  })

  it('既にズーム中でも再ターゲット可能（追従）', () => {
    let cam = startZoomIn(
      makeCam({ scale: 2, pivot: { x: 50, y: 50 } }),
      100,
      100
    )
    cam = startZoomIn(cam, 200, 80)
    expect(cam.zoom!.toPivot).toEqual({ x: 200, y: 80 })
    expect(cam.zoom!.fromScale).toBe(2)
    expect(cam.zoom!.fromPivot).toEqual({ x: 50, y: 50 })
  })

  it('デフォルト引数（scale=3.0, duration=300）が適用される', () => {
    const cam = startZoomIn(makeCam(), 0, 0)
    expect(cam.zoom!.toScale).toBe(3.0)
    expect(cam.zoom!.durationMs).toBe(300)
  })
})

describe('zoomOut', () => {
  it('toScale=1, toPivot=(0,0) を設定する', () => {
    const cam = zoomOut(makeCam({ scale: 3, pivot: { x: 100, y: 50 } }))
    expect(cam.zoom!.toScale).toBe(1)
    expect(cam.zoom!.toPivot).toEqual({ x: 0, y: 0 })
    expect(cam.zoom!.fromScale).toBe(3)
    expect(cam.zoom!.fromPivot).toEqual({ x: 100, y: 50 })
  })
})

describe('updateZoom', () => {
  it('zoom=null のとき何も起こらない', () => {
    const cam = makeCam()
    const next = updateZoom(cam, 100)
    expect(next.scale).toBe(1)
    expect(next.zoom).toBeNull()
  })

  it('途中時点で scale が補間される', () => {
    const cam = startZoomIn(makeCam(), 100, 0, 3.0, 300)
    const next = updateZoom(cam, 150) // t=0.5
    expect(next.scale).toBeGreaterThan(1)
    expect(next.scale).toBeLessThan(3)
    expect(next.zoom).not.toBeNull()
  })

  it('ズームイン (1→3) は対数補間で t=0.5 のとき幾何平均 √3 に近い', () => {
    // 線形なら 1 + (3-1)*0.5 = 2.0 になる。log-space なら √(1*3) = √3 ≈ 1.732
    const cam = startZoomIn(makeCam(), 0, 0, 3.0, 300)
    const next = updateZoom(cam, 150) // t=0.5, easeInOut(0.5)=0.5
    expect(next.scale).toBeCloseTo(Math.sqrt(3), 3)
    expect(next.scale).toBeLessThan(2.0)
  })

  it('ズームアウト (3→1) は線形補間で t=0.5 のとき 2.0 になる (log を適用しない)', () => {
    // ズームアウトでは log-space を使わず線形 + easeInOut のまま
    const cam = zoomOut(makeCam({ scale: 3, pivot: { x: 0, y: 0 } }), 300)
    const next = updateZoom(cam, 150) // t=0.5
    expect(next.scale).toBeCloseTo(2.0, 3)
  })

  it('完了時に zoom=null かつ scale=toScale, pivot=toPivot', () => {
    const cam = startZoomIn(makeCam(), 100, 50, 3.0, 200)
    const next = updateZoom(cam, 200)
    expect(next.scale).toBe(3.0)
    expect(next.pivot).toEqual({ x: 100, y: 50 })
    expect(next.zoom).toBeNull()
  })

  it('時間オーバー（deltaMS > durationMs）でも完了状態に正しく落ちる', () => {
    const cam = startZoomIn(makeCam(), 100, 50, 3.0, 200)
    const next = updateZoom(cam, 99999)
    expect(next.scale).toBe(3.0)
    expect(next.zoom).toBeNull()
  })
})

describe('followZoom', () => {
  it('zoom=null かつ scale=1 のとき startZoomIn 相当の新規ズームを開始する', () => {
    const cam = followZoom(makeCam(), 100, 50)
    expect(cam.zoom).not.toBeNull()
    expect(cam.zoom!.fromScale).toBe(1)
    expect(cam.zoom!.toScale).toBe(3.0)
    expect(cam.zoom!.toPivot).toEqual({ x: 100, y: 50 })
    expect(cam.zoom!.durationMs).toBe(300)
    expect(cam.zoom!.elapsedMs).toBe(0)
  })

  it('zoom=null かつ既に target scale に到達済なら短い duration でピボット追従する', () => {
    const cam = followZoom(makeCam({ scale: 3.0 }), 200, 80)
    expect(cam.zoom).not.toBeNull()
    expect(cam.zoom!.fromScale).toBe(3.0)
    expect(cam.zoom!.toScale).toBe(3.0)
    expect(cam.zoom!.toPivot).toEqual({ x: 200, y: 80 })
    // 通常 300ms より短い (= 指を動かすたびに 300ms ramp を繰り返さない)
    expect(cam.zoom!.durationMs).toBeLessThan(300)
  })

  it('既にズーム中なら toPivot だけ更新し elapsedMs / fromScale / fromPivot を維持する', () => {
    let cam = startZoomIn(makeCam(), 100, 100, 3.0, 300)
    cam = updateZoom(cam, 100) // elapsedMs = 100
    const elapsedBefore = cam.zoom!.elapsedMs
    const fromScaleBefore = cam.zoom!.fromScale
    const fromPivotBefore = { ...cam.zoom!.fromPivot }
    cam = followZoom(cam, 200, 80)
    expect(cam.zoom!.toPivot).toEqual({ x: 200, y: 80 })
    expect(cam.zoom!.elapsedMs).toBe(elapsedBefore) // ← 維持される
    expect(cam.zoom!.fromScale).toBe(fromScaleBefore)
    expect(cam.zoom!.fromPivot).toEqual(fromPivotBefore)
  })
})

describe('getCurrentZoom', () => {
  it('camera.scale を返す', () => {
    expect(getCurrentZoom(makeCam({ scale: 2.5 }))).toBe(2.5)
  })
})

describe('screenToWorld', () => {
  it('scale=1, pivot=(0,0) のとき画面中央が world (0,0)', () => {
    const cam = makeCam()
    const w = screenToWorld(cam, VIEW_WIDTH / 2, VIEW_HEIGHT / 2)
    expect(w).toEqual({ x: 0, y: 0 })
  })

  it('scale=1, pivot=(0,0) で画面右上は (+offset, -offset)', () => {
    const cam = makeCam()
    const w = screenToWorld(cam, VIEW_WIDTH / 2 + 100, VIEW_HEIGHT / 2 - 50)
    expect(w.x).toBe(100)
    expect(w.y).toBe(-50)
  })

  it('scale=2 のときオフセットが半分になる', () => {
    const cam = makeCam({ scale: 2 })
    const w = screenToWorld(cam, VIEW_WIDTH / 2 + 100, VIEW_HEIGHT / 2)
    expect(w.x).toBe(50)
  })

  it('pivot がずれていれば world にも反映される', () => {
    const cam = makeCam({ pivot: { x: 30, y: 40 } })
    const w = screenToWorld(cam, VIEW_WIDTH / 2, VIEW_HEIGHT / 2)
    expect(w).toEqual({ x: 30, y: 40 })
  })

  it('rotation が π/2（90°）のとき、画面右方向のタップは world で下方向にマップされる', () => {
    // mapLayer が 90° 回転している状態 = タップ点が world 座標系では 90° 逆回転される
    // 画面右 (+100, 0) は world では (0, -100) になる（mapLayer が CCW 90° 回転していれば）
    const cam = makeCam()
    const w = screenToWorld(
      cam,
      VIEW_WIDTH / 2 + 100,
      VIEW_HEIGHT / 2,
      VIEW_WIDTH,
      VIEW_HEIGHT,
      Math.PI / 2
    )
    expect(w.x).toBeCloseTo(0, 5)
    expect(w.y).toBeCloseTo(-100, 5)
  })

  it('rotation=π（180°）で画面右は world 左にマップされる', () => {
    const cam = makeCam()
    const w = screenToWorld(
      cam,
      VIEW_WIDTH / 2 + 100,
      VIEW_HEIGHT / 2,
      VIEW_WIDTH,
      VIEW_HEIGHT,
      Math.PI
    )
    expect(w.x).toBeCloseTo(-100, 5)
    expect(w.y).toBeCloseTo(0, 5)
  })
})
