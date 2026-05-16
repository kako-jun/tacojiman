/**
 * #43: スコア計算・エンディング判定の純粋関数群（PixiJS 非依存）。
 */

export type EndingLevel = 'true' | 'special' | 'good' | 'normal' | 'bad'

/**
 * エンディング判定スコア閾値（legacy 仕様準拠）。
 */
export const ENDING_THRESHOLDS = {
  trueEnd: 8001,
  special: 5001,
  good: 3001,
  normal: 1001,
} as const

/** 基本スコアにズーム倍率を掛けて Math.floor で量子化する。 */
export function calculateFinalScore(
  baseScore: number,
  zoomMultiplier: number
): number {
  return Math.floor(baseScore * zoomMultiplier)
}

/** スコアからエンディングレベルを判定。 */
export function calculateEndingLevel(score: number): EndingLevel {
  if (score >= ENDING_THRESHOLDS.trueEnd) return 'true'
  if (score >= ENDING_THRESHOLDS.special) return 'special'
  if (score >= ENDING_THRESHOLDS.good) return 'good'
  if (score >= ENDING_THRESHOLDS.normal) return 'normal'
  return 'bad'
}
