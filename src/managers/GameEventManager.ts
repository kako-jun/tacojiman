/**
 * ゲームイベントを型安全に管理するクラス
 * Phaserのイベントシステムをラップして型安全性を提供
 */

import Phaser from 'phaser'

// ゲームイベントの型定義
export interface GameEvents {
  // プレイヤー関連
  'player-damaged': (damage: number) => void
  
  // タココング関連
  'takokong-defeated': () => void
  'takokong-reached-house': () => void
  
  // ボム忍術関連
  'bomb-damage-line': (data: BombLineData) => void
  'check-mine-trigger': (data: MineTriggerData) => void
  'sentry-find-target': (data: SentryTargetData) => void
  'muteki-explosion': (data: ExplosionData) => void
  'sol-strike': (data: ExplosionData) => void
  'jakuhou-strike': (data: ExplosionData) => void
  
  // ダインスレイブ関連
  'dainsleif-multihit': (data: DainsleifHitData) => void
  'dainsleif-final-check': (data: DainsleifFinalData) => void
  
  // 分身システム関連
  'bunshin-decoy-start': (data: DecoyStartData) => void
  'bunshin-decoy-end': (data: DecoyEndData) => void
  
  // スコア表示関連
  'show-score-gain': (data: ScoreGainData) => void
  
  // 時間関連
  'game-time-update': (timeRemaining: number) => void
  'bomb-recovery': (bombType: string) => void
  
  // システム関連
  'game-paused': () => void
  'game-resumed': () => void
}

// イベントデータの型定義
export interface BombLineData {
  x: number
  y: number
  direction: number
  range: number
  damage: number
}

export interface MineTriggerData {
  mineX: number
  mineY: number
  enemyX: number
  enemyY: number
  damage: number
}

export interface SentryTargetData {
  sentryX: number
  sentryY: number
  targetX: number
  targetY: number
  range: number
}

export interface ExplosionData {
  x: number
  y: number
  range: number
  damage: number
}

export interface DainsleifHitData {
  x: number
  y: number
  width: number
  damage: number
  hitTargets: Set<any>
  step: number
}

export interface DainsleifFinalData {
  hitTargets: Set<any>
}

export interface DecoyStartData {
  x: number
  y: number
  range: number
  decoyNumber: number
  decoyFuton: any
}

export interface DecoyEndData {
  decoyNumber: number
}

export interface ScoreGainData {
  x: number
  y: number
  baseScore: number
  zoomMultiplier: number
}

export class GameEventManager {
  private scene: Phaser.Scene
  private eventHandlers: Map<keyof GameEvents, Set<Function>> = new Map()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * イベントリスナーを登録
   */
  on<K extends keyof GameEvents>(event: K, handler: GameEvents[K]): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    
    this.eventHandlers.get(event)!.add(handler)
    this.scene.events.on(event, handler)
  }

  /**
   * 一度だけ実行されるイベントリスナーを登録
   */
  once<K extends keyof GameEvents>(event: K, handler: GameEvents[K]): void {
    const wrappedHandler = (...args: Parameters<GameEvents[K]>) => {
      this.off(event, wrappedHandler as GameEvents[K])
      // @ts-ignore - TypeScriptの制限を回避
      handler(...args)
    }
    
    this.on(event, wrappedHandler as GameEvents[K])
  }

  /**
   * イベントリスナーを削除
   */
  off<K extends keyof GameEvents>(event: K, handler?: GameEvents[K]): void {
    if (handler) {
      // 特定のハンドラーを削除
      const handlers = this.eventHandlers.get(event)
      if (handlers) {
        handlers.delete(handler)
        this.scene.events.off(event, handler)
        
        // ハンドラーがなくなった場合はSetを削除
        if (handlers.size === 0) {
          this.eventHandlers.delete(event)
        }
      }
    } else {
      // そのイベントのすべてのハンドラーを削除
      const handlers = this.eventHandlers.get(event)
      if (handlers) {
        handlers.forEach(h => this.scene.events.off(event, h))
        this.eventHandlers.delete(event)
      }
    }
  }

  /**
   * イベントを発火
   */
  emit<K extends keyof GameEvents>(
    event: K,
    ...args: Parameters<GameEvents[K]>
  ): void {
    this.scene.events.emit(event, ...args)
  }

  /**
   * すべてのイベントリスナーを削除
   */
  removeAllListeners(): void {
    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach(handler => {
        this.scene.events.off(event, handler)
      })
    })
    this.eventHandlers.clear()
  }

  /**
   * 登録されているイベントの一覧を取得
   */
  getRegisteredEvents(): string[] {
    return Array.from(this.eventHandlers.keys())
  }

  /**
   * 特定のイベントのハンドラー数を取得
   */
  getHandlerCount<K extends keyof GameEvents>(event: K): number {
    return this.eventHandlers.get(event)?.size || 0
  }

  /**
   * リソースを解放
   */
  destroy(): void {
    this.removeAllListeners()
  }

  // 便利メソッド：よく使われるイベントのエミッター

  /**
   * プレイヤーダメージイベントを発火
   */
  emitPlayerDamaged(damage: number): void {
    this.emit('player-damaged', damage)
  }

  /**
   * スコア獲得イベントを発火
   */
  emitScoreGain(x: number, y: number, baseScore: number, zoomMultiplier: number): void {
    this.emit('show-score-gain', { x, y, baseScore, zoomMultiplier })
  }

  /**
   * タココング撃破イベントを発火
   */
  emitTakokongDefeated(): void {
    this.emit('takokong-defeated')
  }

  /**
   * ボム爆発イベントを発火
   */
  emitBombExplosion(x: number, y: number, range: number, damage: number): void {
    this.emit('muteki-explosion', { x, y, range, damage })
  }

  /**
   * 分身開始イベントを発火
   */
  emitDecoyStart(x: number, y: number, range: number, decoyNumber: number, decoyFuton: any): void {
    this.emit('bunshin-decoy-start', { x, y, range, decoyNumber, decoyFuton })
  }

  /**
   * 分身終了イベントを発火
   */
  emitDecoyEnd(decoyNumber: number): void {
    this.emit('bunshin-decoy-end', { decoyNumber })
  }

  /**
   * ゲーム時間更新イベントを発火
   */
  emitGameTimeUpdate(timeRemaining: number): void {
    this.emit('game-time-update', timeRemaining)
  }

  /**
   * ボム回復イベントを発火
   */
  emitBombRecovery(bombType: string): void {
    this.emit('bomb-recovery', bombType)
  }
}