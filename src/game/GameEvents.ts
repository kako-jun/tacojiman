// ゲームイベントの型定義（Phaser 依存なし）

export interface ScoreGainEvent {
  x: number        // mapLayer ローカル座標
  y: number
  score: number    // 獲得スコア
  combo: number    // 連続ボーナス倍率
}

export interface EnemyHitEvent {
  enemyId: string
  damage: number
  newHp: number
}

export interface BombActivatedEvent {
  type: string  // BombType と同じ値
  x: number     // 発動地点 (mapLayer ローカル)
  y: number
}

export interface TakokongSpawnEvent {
  x: number
  y: number
}

// ゲームイベント名→ペイロード型のマップ
export interface GameEventMap {
  'score-gain': ScoreGainEvent
  'enemy-hit': EnemyHitEvent
  'bomb-activated': BombActivatedEvent
  'takokong-spawn': TakokongSpawnEvent
  'game-over': void
  'game-clear': { finalScore: number }
}

export type GameEventName = keyof GameEventMap

// 型安全なシンプルな EventEmitter（DOM や Node.js の EventEmitter に依存しない）
export class GameEventEmitter {
  private handlers: Map<string, Array<(payload: unknown) => void>> = new Map()

  on<K extends GameEventName>(
    event: K,
    handler: (payload: GameEventMap[K]) => void
  ): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, [])
    }
    this.handlers.get(event)!.push(handler as (payload: unknown) => void)
  }

  off<K extends GameEventName>(
    event: K,
    handler: (payload: GameEventMap[K]) => void
  ): void {
    const list = this.handlers.get(event)
    if (!list) return
    const idx = list.indexOf(handler as (payload: unknown) => void)
    if (idx >= 0) list.splice(idx, 1)
  }

  emit<K extends GameEventName>(event: K, payload: GameEventMap[K]): void {
    this.handlers.get(event)?.forEach(h => h(payload))
  }

  removeAllListeners<K extends GameEventName>(event: K): void {
    this.handlers.set(event, [])
  }

  clear(): void {
    this.handlers.clear()
  }
}
