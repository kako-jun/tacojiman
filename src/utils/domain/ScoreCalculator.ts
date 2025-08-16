/**
 * スコア計算に関する純粋関数群
 * Phaserに依存しない、テスト可能な関数のみを含む
 */

export interface ScoreResult {
  readonly baseScore: number
  readonly zoomMultiplier: number
  readonly finalScore: number
}

export interface EndingLevel {
  readonly level: number
  readonly title: string
  readonly message: string
  readonly characterReaction: string
  readonly bgColor: number
}

/**
 * 基本スコアとズーム倍率から最終スコアを計算
 */
export function calculateFinalScore(baseScore: number, zoomMultiplier: number): ScoreResult {
  return {
    baseScore,
    zoomMultiplier,
    finalScore: Math.floor(baseScore * zoomMultiplier)
  }
}

/**
 * スコアに応じたエンディングレベルを判定
 */
export function calculateEndingLevel(score: number): EndingLevel {
  if (score >= 8001) {
    return {
      level: 5,
      title: '真エンディング',
      message: '幼馴染の顔全体が見え、真の笑顔が...',
      characterReaction: '「ありがとう...今度は私が守るから」',
      bgColor: 0xffd700 // 金色
    }
  }
  
  if (score >= 5001) {
    return {
      level: 4,
      title: 'スペシャルエンド',
      message: '目元が初めて見え、涙を浮かべる',
      characterReaction: '「本当は...好きだったの」',
      bgColor: 0xff69b4 // ピンク
    }
  }
  
  if (score >= 3001) {
    return {
      level: 3,
      title: 'グッドエンド',
      message: '目元が初めて見え、涙を浮かべる',
      characterReaction: '「心配してくれてたのね...」',
      bgColor: 0x87ceeb // 水色
    }
  }
  
  if (score >= 1001) {
    return {
      level: 2,
      title: 'ノーマルエンド',
      message: '幼馴染が少し寂しそうに',
      characterReaction: '「今日は大事な日だったのに...」',
      bgColor: 0xdda0dd // 薄紫
    }
  }
  
  return {
    level: 1,
    title: 'バッドエンド',
    message: '幼馴染が去っていく',
    characterReaction: '「もう来ない...」',
    bgColor: 0x696969 // グレー
  }
}

/**
 * ズーム倍率に応じた表示色を決定
 */
export function getZoomScoreColor(zoomMultiplier: number): string {
  if (zoomMultiplier >= 3) return '#ff0000'     // 赤（最大ズーム）
  if (zoomMultiplier >= 2.5) return '#ff4400'  // オレンジレッド（高ズーム）
  if (zoomMultiplier >= 2) return '#ffaa00'    // オレンジ（中ズーム）
  if (zoomMultiplier > 1) return '#ffff00'     // 黄色（軽ズーム）
  return '#00ff00'                             // 緑（等倍）
}

/**
 * ダメージ量に応じた表示色とサイズを決定
 */
export function getDamageDisplayStyle(damage: number): { color: string; fontSize: string } {
  if (damage >= 10) {
    return { color: '#ff0000', fontSize: '28px' } // 強い赤（大ダメージ）
  }
  if (damage >= 5) {
    return { color: '#ff2222', fontSize: '26px' } // 中赤（中ダメージ）
  }
  return { color: '#ff4444', fontSize: '24px' } // 赤（基本）
}

/**
 * スコアをゼロ以下にしない安全な減算
 */
export function subtractScoreSafely(currentScore: number, damage: number): number {
  return Math.max(0, currentScore - damage)
}