import type { CameraState } from '../types/GameState'
import { VIEW_WIDTH, VIEW_HEIGHT } from '../types/GameState'

// シェイクの状態
export interface ShakeState {
  remainingMs: number
  intensity: number
}

// ズームインアニメーション状態
export interface ZoomState {
  targetScale: number
  durationMs: number
  elapsedMs: number
}

// カメラを家中心（デフォルト）に戻す
export function resetCamera(): CameraState {
  return { x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2, scale: 1 }
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
