/**
 * ゲームルールに関する純粋関数群
 * 時間管理、敵出現ルール、ボム回復など
 */

export interface GameTimeState {
  readonly gameTimeRemaining: number
  readonly elapsedRealTime: number
  readonly shouldSpawnTakokong: boolean
  readonly shouldRecoverBomb: boolean
}

export interface EnemySpawnRule {
  readonly maxEnemies: number
  readonly spawnDelay: number
  readonly spawnWeights: Record<string, number>
}

export interface BombRecoveryRule {
  readonly shouldRecover: boolean
  readonly remainingTime: number
}

/**
 * ゲーム時間の進行状態を計算
 */
export function calculateGameTimeState(
  gameStartTime: number,
  currentTime: number,
  initialTimeRemaining: number = 180
): GameTimeState {
  const elapsedRealTime = currentTime - gameStartTime
  const elapsedSeconds = Math.floor(elapsedRealTime / 1000)
  const gameTimeRemaining = Math.max(0, initialTimeRemaining - elapsedSeconds)
  
  return {
    gameTimeRemaining,
    elapsedRealTime,
    shouldSpawnTakokong: gameTimeRemaining === 110 && gameTimeRemaining > 0,
    shouldRecoverBomb: gameTimeRemaining === 120 || gameTimeRemaining === 60
  }
}

/**
 * 時間経過に応じた敵出現ルールを計算
 */
export function calculateEnemySpawnRule(elapsedSeconds: number): EnemySpawnRule {
  // 15秒ごとに難易度上昇
  const difficultyLevel = Math.floor(elapsedSeconds / 15)
  
  // 最大敵数の増加（初期40匹→最大70匹）
  const maxEnemies = Math.min(70, 40 + difficultyLevel * 5)
  
  // 出現頻度の向上（初期500ms→最小200ms）
  const spawnDelay = Math.max(200, 500 * Math.pow(0.8, difficultyLevel))
  
  // 敵タイプの出現重み
  const spawnWeights = {
    ground: 0.5,      // 地上タコ50%
    water: 0.25,      // 水タコ25%
    air: 0.15,        // 空タコ15%
    underground: 0.1  // 地下タコ10%
  }
  
  return {
    maxEnemies,
    spawnDelay,
    spawnWeights
  }
}

/**
 * ボム回復タイミングの判定
 */
export function calculateBombRecoveryRule(gameTimeRemaining: number): BombRecoveryRule {
  const shouldRecover = gameTimeRemaining === 120 || gameTimeRemaining === 60
  
  return {
    shouldRecover,
    remainingTime: gameTimeRemaining
  }
}

/**
 * スクリーンショット撮影タイミングの判定
 */
export function shouldTakeScreenshot(elapsedSeconds: number): boolean {
  // 60秒、120秒、180秒でスクリーンショット撮影
  return elapsedSeconds === 60 || elapsedSeconds === 120 || elapsedSeconds === 180
}

/**
 * ランダムな敵タイプを重みに基づいて選択
 */
export function selectRandomEnemyType(weights: Record<string, number>): string {
  const random = Math.random()
  let cumulativeWeight = 0
  
  for (const [type, weight] of Object.entries(weights)) {
    cumulativeWeight += weight
    if (random <= cumulativeWeight) {
      return type
    }
  }
  
  // フォールバック
  return 'ground'
}

/**
 * マップ回転設定をランダム生成
 */
export function generateMapRotationSettings(): {
  direction: number
  duration: number
} {
  const direction = Math.random() > 0.5 ? 1 : -1 // 時計回り/反時計回り
  const duration = 120000 + Math.random() * 60000 // 2〜3分で1回転
  
  return { direction, duration }
}

/**
 * ゲーム開始時刻をランダム生成（現在は7時固定だが拡張可能）
 */
export function generateMorningTime(): string {
  // 将来的には4:00〜8:00のランダム時刻に拡張可能
  return '7:00:00 AM'
}