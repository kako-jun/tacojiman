/**
 * スクリーンショット機能を管理するクラス
 * Phaserのレンダラーに依存するが、撮影ロジックは分離
 */

import Phaser from 'phaser'
import { GAME_CONFIG } from '@/utils/GameConfig'

export interface ScreenshotData {
  readonly dataURL: string
  readonly timestamp: number
  readonly index: number
}

export interface ScreenshotManagerEvents {
  'screenshot-taken': (screenshot: ScreenshotData) => void
  'screenshot-failed': (error: Error, index: number) => void
  'all-screenshots-complete': (screenshots: ScreenshotData[]) => void
}

export class ScreenshotManager {
  private game: Phaser.Game
  private screenshots: ScreenshotData[] = []
  private timer: Phaser.Time.TimerEvent | null = null
  private eventCallbacks: Partial<ScreenshotManagerEvents> = {}

  constructor(game: Phaser.Game) {
    this.game = game
  }

  /**
   * スクリーンショット撮影を開始
   */
  startCapture(scene: Phaser.Scene): void {
    if (this.timer) {
      this.stopCapture()
    }

    const config = GAME_CONFIG.SCREENSHOT
    
    this.timer = scene.time.addEvent({
      delay: config.INTERVAL_SECONDS * 1000,
      callback: () => this.takeScreenshot(),
      repeat: config.REPEAT_COUNT // 3回実行（0, 1, 2）
    })
  }

  /**
   * スクリーンショット撮影を停止
   */
  stopCapture(): void {
    if (this.timer) {
      this.timer.remove()
      this.timer = null
    }
  }

  /**
   * 単発スクリーンショット撮影
   */
  takeScreenshot(): void {
    const index = this.screenshots.length
    const timestamp = Date.now()

    try {
      this.game.renderer.snapshot((image: HTMLImageElement) => {
        this.handleSnapshotResult(image, index, timestamp)
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown screenshot error')
      this.handleSnapshotError(err, index)
    }
  }

  /**
   * スナップショット結果を処理
   */
  private handleSnapshotResult(
    image: HTMLImageElement | null,
    index: number,
    timestamp: number
  ): void {
    if (!image || !image.src) {
      this.handleSnapshotError(new Error('Invalid image data'), index)
      return
    }

    try {
      const dataURL = this.convertImageToDataURL(image)
      
      const screenshot: ScreenshotData = {
        dataURL,
        timestamp,
        index
      }

      this.screenshots.push(screenshot)
      
      console.log(`スクリーンショット ${this.screenshots.length}/3 撮影完了`)
      
      // イベント発火
      this.emit('screenshot-taken', screenshot)
      
      // 全て完了した場合
      if (this.screenshots.length >= GAME_CONFIG.SCREENSHOT.MAX_COUNT) {
        this.emit('all-screenshots-complete', [...this.screenshots])
      }
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Image conversion failed')
      this.handleSnapshotError(err, index)
    }
  }

  /**
   * HTMLImageElementをDataURLに変換
   */
  private convertImageToDataURL(image: HTMLImageElement): string {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      throw new Error('Canvas context creation failed')
    }

    canvas.width = image.width
    canvas.height = image.height
    ctx.drawImage(image, 0, 0)
    
    return canvas.toDataURL('image/png')
  }

  /**
   * スナップショットエラーを処理
   */
  private handleSnapshotError(error: Error, index: number): void {
    console.warn(`スクリーンショット ${index} の撮影に失敗:`, error)
    this.emit('screenshot-failed', error, index)
  }

  /**
   * イベントリスナーを登録
   */
  on<K extends keyof ScreenshotManagerEvents>(
    event: K,
    callback: ScreenshotManagerEvents[K]
  ): void {
    this.eventCallbacks[event] = callback
  }

  /**
   * イベントリスナーを削除
   */
  off<K extends keyof ScreenshotManagerEvents>(event: K): void {
    delete this.eventCallbacks[event]
  }

  /**
   * イベントを発火
   */
  private emit<K extends keyof ScreenshotManagerEvents>(
    event: K,
    ...args: Parameters<ScreenshotManagerEvents[K]>
  ): void {
    const callback = this.eventCallbacks[event]
    if (callback) {
      // @ts-ignore - TypeScriptの制限を回避
      callback(...args)
    }
  }

  /**
   * 撮影済みスクリーンショットを取得
   */
  getScreenshots(): readonly ScreenshotData[] {
    return [...this.screenshots]
  }

  /**
   * 撮影済みスクリーンショットの数を取得
   */
  getScreenshotCount(): number {
    return this.screenshots.length
  }

  /**
   * 特定のインデックスのスクリーンショットを取得
   */
  getScreenshot(index: number): ScreenshotData | null {
    return this.screenshots[index] || null
  }

  /**
   * DataURL配列を取得（EndingSceneで使用）
   */
  getDataURLs(): string[] {
    return this.screenshots.map(shot => shot.dataURL)
  }

  /**
   * スクリーンショットデータをクリア
   */
  clear(): void {
    this.screenshots = []
  }

  /**
   * リソースを解放
   */
  destroy(): void {
    this.stopCapture()
    this.clear()
    this.eventCallbacks = {}
  }

  /**
   * 手動でスクリーンショットを追加（テスト用）
   */
  addScreenshot(dataURL: string): void {
    const screenshot: ScreenshotData = {
      dataURL,
      timestamp: Date.now(),
      index: this.screenshots.length
    }
    
    this.screenshots.push(screenshot)
    this.emit('screenshot-taken', screenshot)
  }

  /**
   * スクリーンショットの設定情報を取得
   */
  getConfig(): typeof GAME_CONFIG.SCREENSHOT {
    return GAME_CONFIG.SCREENSHOT
  }
}