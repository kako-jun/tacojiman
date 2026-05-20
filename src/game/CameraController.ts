import type { CameraState } from '../types/GameState'
import { VIEW_WIDTH, VIEW_HEIGHT } from '../types/GameState'

// シェイクの状態
export interface ShakeState {
  remainingMs: number
  intensity: number
}

// ズームインアニメーション状態（旧形式・互換のため残す）
export interface ZoomState {
  targetScale: number
  durationMs: number
  elapsedMs: number
}

// 新ズームアニメーション（CameraState.zoom に格納する）
export interface CameraZoomAnim {
  fromScale: number
  toScale: number
  fromPivot: { x: number; y: number }
  toPivot: { x: number; y: number }
  elapsedMs: number
  durationMs: number
}

// カメラを家中心（デフォルト）に戻す
export function resetCamera(): CameraState {
  return {
    x: VIEW_WIDTH / 2,
    y: VIEW_HEIGHT / 2,
    scale: 1,
    pivot: { x: 0, y: 0 },
    zoom: null,
  }
}

/**
 * ズームインアニメーションを開始する（ピュア関数: 新 state を返す）。
 * targetX/Y は mapLayer ローカル座標。pivot を targetX/Y にずらすことで
 * スケール拡大時にその点が画面中央に来る。
 *
 * 既にズーム中の場合は from を現在値に更新して再ターゲットする（追従可）。
 */
export function startZoomIn(
  camera: CameraState,
  targetX: number,
  targetY: number,
  scale: number = 3.0,
  duration: number = 300
): CameraState {
  return {
    ...camera,
    zoom: {
      fromScale: camera.scale,
      toScale: scale,
      fromPivot: { x: camera.pivot.x, y: camera.pivot.y },
      toPivot: { x: targetX, y: targetY },
      elapsedMs: 0,
      durationMs: duration,
    },
  }
}

/**
 * 長押し追従中のリターゲット。target scale は固定で LONG_PRESS_TARGET_SCALE。
 *
 * 既にズーム中 (camera.zoom !== null) ならアニメの進捗 (elapsedMs / fromScale / fromPivot)
 * を維持し、toPivot だけ書き換える。pointermove ごとに毎回 startZoomIn を呼ぶと
 * elapsedMs=0 で動き出しが何度もリセットされ、特に高ズーム域でカクつくため。
 *
 * ズーム未開始 (zoom=null) の場合は startZoomIn で新規に開始するが、既に target scale に
 * 到達済 (camera.scale ≈ LONG_PRESS_TARGET_SCALE) ならピボットだけ追従させたいので
 * duration を短くする (LONG_PRESS_FOLLOW_PIVOT_DURATION_MS)。指を止めて再度動かす経路で
 * 毎回 300ms ramp を繰り返さないため。
 */
const LONG_PRESS_TARGET_SCALE = 3.0
const LONG_PRESS_FOLLOW_PIVOT_DURATION_MS = 80

export function followZoom(
  camera: CameraState,
  targetX: number,
  targetY: number
): CameraState {
  if (camera.zoom === null) {
    const atTargetScale =
      Math.abs(camera.scale - LONG_PRESS_TARGET_SCALE) < 1e-6
    const duration = atTargetScale ? LONG_PRESS_FOLLOW_PIVOT_DURATION_MS : 300
    return startZoomIn(
      camera,
      targetX,
      targetY,
      LONG_PRESS_TARGET_SCALE,
      duration
    )
  }
  return {
    ...camera,
    zoom: {
      ...camera.zoom,
      toPivot: { x: targetX, y: targetY },
      toScale: LONG_PRESS_TARGET_SCALE,
    },
  }
}

/**
 * 家中心 (0,0) へのズームアウト開始。scale=1, pivot=(0,0) に戻す。
 */
export function zoomOut(
  camera: CameraState,
  duration: number = 300
): CameraState {
  return {
    ...camera,
    zoom: {
      fromScale: camera.scale,
      toScale: 1,
      fromPivot: { x: camera.pivot.x, y: camera.pivot.y },
      toPivot: { x: 0, y: 0 },
      elapsedMs: 0,
      durationMs: duration,
    },
  }
}

/**
 * ズーム中なら deltaMS だけ進める。完了したら zoom=null にする。
 *
 * ズームイン (toScale > fromScale) のときだけスケールを対数（幾何）補間する。
 * 線形補間 (1→3) だと t=0.9 付近で残り 10% のスケール変化が
 * 既に拡大率の大きい画面上では大きな視覚移動になり、引っかかって見えるため。
 * ズームアウト (3→1) は逆に「最初は速く、終わりはゆっくり止まる」のが自然なので
 * 既存の線形補間 + easeInOut を維持する。
 *
 * 不変条件: CameraState.scale は常に > 0（resetCamera で 1 起点、updateZoom で 0 を作らない）。
 */
export function updateZoom(camera: CameraState, deltaMS: number): CameraState {
  const z = camera.zoom
  if (z === null) return camera
  const elapsed = z.elapsedMs + deltaMS
  const t = Math.min(1, elapsed / z.durationMs)
  const eased = easeInOut(t)
  const scale =
    z.toScale > z.fromScale
      ? z.fromScale * Math.pow(z.toScale / z.fromScale, eased)
      : z.fromScale + (z.toScale - z.fromScale) * eased
  const pivotX = z.fromPivot.x + (z.toPivot.x - z.fromPivot.x) * eased
  const pivotY = z.fromPivot.y + (z.toPivot.y - z.fromPivot.y) * eased
  if (t >= 1) {
    return {
      ...camera,
      scale: z.toScale,
      pivot: { x: z.toPivot.x, y: z.toPivot.y },
      zoom: null,
    }
  }
  return {
    ...camera,
    scale,
    pivot: { x: pivotX, y: pivotY },
    zoom: { ...z, elapsedMs: elapsed },
  }
}

/**
 * 現在のスコアズーム倍率。ズーム中なら補間途中の scale を返す。
 */
export function getCurrentZoom(camera: CameraState): number {
  return camera.scale
}

/**
 * スクリーン座標 (screenX, screenY) を mapLayer ローカル座標に変換する。
 *
 * mapLayer の表示則（PixiJS 上での変換順）:
 *   screen = mapLayer.position + R(rotation) · (scale · (world - pivot))
 *   ただし mapLayer.position = (viewW/2, viewH/2)
 * を world について解く:
 *   world = pivot + (1 / scale) · R(-rotation) · (screen - mapLayer.position)
 *
 * `rotation` 引数を省略すると 0 として扱う（既存テストとの後方互換）。
 * `GameScene.mapLayer.rotation` を毎タップ時に渡さないと、回転中のタップ位置が
 * 世界座標で 90°ぶんずれる（#41 マップ回転 + #46 タップフィードバックの合せ技でのみ顕在化）。
 */
export function screenToWorld(
  camera: CameraState,
  screenX: number,
  screenY: number,
  viewW: number = VIEW_WIDTH,
  viewH: number = VIEW_HEIGHT,
  rotation: number = 0
): { x: number; y: number } {
  const dx = (screenX - viewW / 2) / camera.scale
  const dy = (screenY - viewH / 2) / camera.scale
  const cos = Math.cos(-rotation)
  const sin = Math.sin(-rotation)
  const x = camera.pivot.x + dx * cos - dy * sin
  const y = camera.pivot.y + dx * sin + dy * cos
  return { x, y }
}

// ズームを適用する（t=0→1 のイージング）
export function applyZoom(
  camera: CameraState,
  targetScale: number,
  t: number // 0→1
): CameraState {
  const eased = easeInOut(t)
  const scale = camera.scale + (targetScale - camera.scale) * eased
  return { ...camera, scale }
}

// シェイクオフセットを計算する（毎フレーム呼ぶ）
export function calcShakeOffset(
  shake: ShakeState,
  deltaMS: number
): { dx: number; dy: number; nextShake: ShakeState } {
  if (shake.remainingMs <= 0) {
    return { dx: 0, dy: 0, nextShake: { remainingMs: 0, intensity: 0 } }
  }
  const dx = (Math.random() - 0.5) * shake.intensity * 2
  const dy = (Math.random() - 0.5) * shake.intensity * 2
  return {
    dx,
    dy,
    nextShake: {
      remainingMs: shake.remainingMs - deltaMS,
      intensity: shake.intensity,
    },
  }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}
