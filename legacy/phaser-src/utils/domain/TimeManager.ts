/**
 * 時刻管理に関する純粋関数群
 * ゲーム内時刻の計算、表示フォーマットなど
 */

export interface GameTime {
  readonly hour: number
  readonly minute: number
  readonly second: number
  readonly displayText: string
}

export interface TimeProgress {
  readonly elapsedGameMinutes: number
  readonly currentGameTime: GameTime
  readonly progressRatio: number // 0.0 〜 1.0
}

/**
 * 開始時刻文字列をパース
 */
export function parseStartTime(startTimeString: string): { hour: number; minute: number; second: number } {
  const match = startTimeString.match(/(\d+):(\d+):(\d+)/)
  if (!match) {
    throw new Error(`Invalid time format: ${startTimeString}`)
  }
  
  return {
    hour: parseInt(match[1]),
    minute: parseInt(match[2]),
    second: parseInt(match[3])
  }
}

/**
 * 経過ミリ秒からゲーム内時刻を計算
 */
export function calculateGameTime(
  startTimeString: string,
  elapsedMs: number
): TimeProgress {
  const startTime = parseStartTime(startTimeString)
  
  // ゲーム内経過時間（30分を3分で進行）
  const elapsedGameMinutes = (elapsedMs / 180000) * 30 // 180000ms = 3分
  
  // 現在の時刻計算
  const currentHour = startTime.hour
  const currentMinute = Math.floor(elapsedGameMinutes)
  
  // 秒は10倍速で進行（100msごとに1秒進む）
  const totalTenthSeconds = Math.floor(elapsedMs / 100)
  const currentSecond = totalTenthSeconds % 60
  
  const displayText = formatGameTime(currentHour, currentMinute, currentSecond)
  
  const progressRatio = elapsedGameMinutes / 30 // 30分が100%
  
  return {
    elapsedGameMinutes,
    currentGameTime: {
      hour: currentHour,
      minute: currentMinute,
      second: currentSecond,
      displayText
    },
    progressRatio: Math.min(1.0, progressRatio)
  }
}

/**
 * 時刻を表示用フォーマットに変換
 */
export function formatGameTime(hour: number, minute: number, second: number): string {
  return `${hour}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
}

/**
 * 時刻の難易度係数を計算（早朝ほど高スコア）
 */
export function calculateTimeDifficultyMultiplier(hour: number): number {
  // 4時：1.5倍、5時：1.4倍、6時：1.3倍、7時：1.2倍、8時：1.0倍
  switch (hour) {
    case 4: return 1.5
    case 5: return 1.4
    case 6: return 1.3
    case 7: return 1.2
    case 8: return 1.0
    default: return 1.0
  }
}

/**
 * 残り時間からカウントダウン表示を生成
 */
export function formatCountdown(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return "0:00"
  
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * 時刻に応じた背景色温度を計算
 */
export function calculateTimeOfDayColor(hour: number, minute: number): {
  temperature: number // 色温度（K）
  brightness: number  // 明度（0.0-1.0）
} {
  const totalMinutes = hour * 60 + minute
  
  // 朝の時間帯（4:00-8:00）の色温度と明度
  if (totalMinutes >= 240 && totalMinutes <= 480) { // 4:00-8:00
    const progress = (totalMinutes - 240) / 240 // 0.0-1.0
    
    return {
      temperature: 2800 + progress * 1500, // 2800K -> 4300K
      brightness: 0.3 + progress * 0.4     // 0.3 -> 0.7
    }
  }
  
  // デフォルト（昼間）
  return {
    temperature: 5500,
    brightness: 1.0
  }
}