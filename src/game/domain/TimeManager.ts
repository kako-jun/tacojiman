/**
 * #43: ゲーム内時刻計算の純粋関数群（PixiJS 非依存）。
 *
 * 仕様:
 * - ゲームは 3 分間（durationMs）で 30 分相当（朝の時間帯）進む
 * - 開始時刻は morningStartMinutes（7:00 = 420）で表現する
 */

export interface GameTime {
  readonly hour: number
  readonly minute: number
}

/**
 * 開始時刻（分単位）から hour/minute を切り出す。
 */
export function parseStartTime(minutes: number): GameTime {
  const safe = Math.max(0, Math.floor(minutes))
  return {
    hour: Math.floor(safe / 60),
    minute: safe % 60,
  }
}

/**
 * 経過 ms から現在のゲーム内時刻を計算。
 * - elapsedMs / durationMs を 30 分に写像し、startMinutes に加算する
 */
export function calculateGameTime(
  elapsedMs: number,
  durationMs: number,
  startMinutes: number
): GameTime {
  const ratio = durationMs > 0 ? Math.min(1, Math.max(0, elapsedMs / durationMs)) : 0
  const gameMinutes = Math.floor(ratio * 30)
  const total = Math.max(0, Math.floor(startMinutes) + gameMinutes)
  return {
    hour: Math.floor(total / 60),
    minute: total % 60,
  }
}

/**
 * GameTime を "H:MM AM" にフォーマットする（朝の時間帯固定）。
 */
export function formatGameTime(time: GameTime): string {
  const m = time.minute.toString().padStart(2, '0')
  return `${time.hour}:${m} AM`
}

/**
 * 時刻（時）に対する難易度・スコア倍率。早朝ほど高い。
 * 4:1.5 / 5:1.4 / 6:1.3 / 7:1.2 / 8:1.0 / その他:1.0
 */
export function getTimeDifficultyMultiplier(hour: number): number {
  switch (hour) {
    case 4:
      return 1.5
    case 5:
      return 1.4
    case 6:
      return 1.3
    case 7:
      return 1.2
    case 8:
      return 1.0
    default:
      return 1.0
  }
}
