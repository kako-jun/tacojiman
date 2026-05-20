/**
 * ポインター入力の純粋ロジック。
 * GameScene の federated event ハンドラから切り出して単体テスト可能化する。
 *
 * - 短タップ / 長押し離し の判定は up 時刻 - down 時刻 で行う
 * - 長押しのしきい値は 180ms（ズーム反応性と通常タップ誤認のバランス点）
 */

export const LONG_PRESS_THRESHOLD_MS = 180

export type PointerUpKind = 'short_tap' | 'long_release'

/**
 * pointerdown と pointerup の時刻からタップ種別を判定する。
 * 300ms 未満 → 'short_tap'、それ以上 → 'long_release'。
 */
export function classifyPointerUp(
  downAtMs: number,
  upAtMs: number
): PointerUpKind {
  return upAtMs - downAtMs < LONG_PRESS_THRESHOLD_MS
    ? 'short_tap'
    : 'long_release'
}

/**
 * 押し下げ継続時間から長押し中か判定する。
 */
export function isLongPressing(downAtMs: number, nowMs: number): boolean {
  return nowMs - downAtMs >= LONG_PRESS_THRESHOLD_MS
}
