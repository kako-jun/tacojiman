/**
 * #42: スクリーンショット撮影管理。
 * - 60s, 120s, 180s 経過時の 3 枚（最大）を dataURL で保持する
 * - 実際のキャンバス取得は外部から注入されたコールバックに任せる
 *   （PixiJS Application 直接依存を避け、テスト容易性を確保）
 */

const DEFAULT_INTERVAL_MS = 60_000
const DEFAULT_MAX_SHOTS = 3

/**
 * 撮影タイミングか判定（ピュア関数）。
 * elapsedMs が nextScreenshotAt 以上で true。
 */
export function shouldTakeScreenshot(
  elapsedMs: number,
  nextScreenshotAt: number
): boolean {
  return elapsedMs >= nextScreenshotAt
}

/**
 * 次の撮影予定タイミングを計算（ピュア関数）。
 * 現在の予定値に間隔を加算するだけ。撮影 1 回につき 1 回呼ぶ。
 */
export function computeNextScreenshotAt(
  currentAt: number,
  intervalMs: number = DEFAULT_INTERVAL_MS
): number {
  return currentAt + intervalMs
}

/**
 * 最大撮影数チェック（ピュア関数）。
 * これ以上撮らなくてよいなら true。
 */
export function isScreenshotLimitReached(
  count: number,
  max: number = DEFAULT_MAX_SHOTS
): boolean {
  return count >= max
}

export const SCREENSHOT_INTERVAL_MS = DEFAULT_INTERVAL_MS
export const SCREENSHOT_MAX_COUNT = DEFAULT_MAX_SHOTS
