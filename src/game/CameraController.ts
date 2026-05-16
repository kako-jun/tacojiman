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
 */
export function updateZoom(camera: CameraState, deltaMS: number): CameraState {
  const z = camera.zoom
  if (z === null) return camera
  const elapsed = z.elapsedMs + deltaMS
  const t = Math.min(1, elapsed / z.durationMs)
  const eased = easeInOut(t)
  const scale = z.fromScale + (z.toScale - z.fromScale) * eased
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
 * mapLayer の表示則:
 *   screen = (VIEW_WIDTH/2 + (world - pivot) * scale,
 *             VIEW_HEIGHT/2 + (world - pivot) * scale)
 * を world について解く。
 */
export function screenToWorld(
  camera: CameraState,
  screenX: number,
  screenY: number,
  viewW: number = VIEW_WIDTH,
  viewH: number = VIEW_HEIGHT
): { x: number; y: number } {
  const x = (screenX - viewW / 2) / camera.scale + camera.pivot.x
  const y = (screenY - viewH / 2) / camera.scale + camera.pivot.y
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
