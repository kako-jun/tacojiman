/**
 * #28 / #29: 敵が player_house に到達したときのペナルティを計算する
 * 純粋関数（PixiJS 非依存）。
 *
 * - スコア減算: enemy type ごとに固定（ground=1, water=2, air=3,
 *   underground=4, takokong=10）。score は 0 で下限固定。
 * - HP 減算: takokong=3、その他=1。playerHp は 0 で下限固定。
 * - gameOver: newPlayerHp <= 0 のとき true。
 */
import type { EnemyType } from '../../types/GameState'

export interface HomeReachPenaltyResult {
  scoreLoss: number
  hpLoss: number
  newScore: number
  newPlayerHp: number
  gameOver: boolean
}

/** 網羅性チェック用ヘルパ。新 EnemyType 追加時にコンパイルエラーで気付ける。 */
function assertNever(x: never): never {
  throw new Error(`Unhandled enemy type: ${String(x)}`)
}

/** enemy type → スコア減算量。 */
function scoreLossFor(type: EnemyType): number {
  switch (type) {
    case 'ground':
      return 1
    case 'water':
      return 2
    case 'air':
      return 3
    case 'underground':
      return 4
    case 'takokong':
      return 10
    default:
      return assertNever(type)
  }
}

/** enemy type → HP 減算量。 */
function hpLossFor(type: EnemyType): number {
  switch (type) {
    case 'ground':
    case 'water':
    case 'air':
    case 'underground':
      return 1
    case 'takokong':
      return 3
    default:
      return assertNever(type)
  }
}

export function computeHomeReachPenalty(
  enemyType: EnemyType,
  currentScore: number,
  currentPlayerHp: number
): HomeReachPenaltyResult {
  const scoreLoss = scoreLossFor(enemyType)
  const hpLoss = hpLossFor(enemyType)
  const newScore = Math.max(0, currentScore - scoreLoss)
  const newPlayerHp = Math.max(0, currentPlayerHp - hpLoss)
  return {
    scoreLoss,
    hpLoss,
    newScore,
    newPlayerHp,
    gameOver: newPlayerHp <= 0,
  }
}
