import { Container, Text } from 'pixi.js'
import gsap from 'gsap'
import type { ScoreGainEvent } from '../game/GameEvents'

/**
 * 浮上フェードテキスト用の共通ヘルパ（#44）。
 * 指定位置に label を表示し、上方向にフロート + フェードアウトしてから destroy する。
 */
function floatLabel(
  parent: Container,
  label: string,
  x: number,
  y: number,
  options: {
    color?: number
    fontSize?: number
    riseBy?: number
    duration?: number
  } = {}
): void {
  const text = new Text({
    text: label,
    style: {
      fill: options.color ?? 0xffffff,
      fontFamily: 'monospace',
      fontSize: options.fontSize ?? 16,
      fontWeight: '700',
      stroke: { color: 0x000000, width: 3 },
    },
  })
  text.anchor.set(0.5, 0.5)
  text.x = x
  text.y = y
  parent.addChild(text)
  gsap.to(text, {
    y: y - (options.riseBy ?? 40),
    alpha: 0,
    duration: options.duration ?? 1.0,
    ease: 'power2.out',
    onComplete: () => text.destroy(),
  })
}

export class EffectManager {
  private readonly container: Container

  constructor(parent: Container) {
    this.container = new Container()
    parent.addChild(this.container)
  }

  // スコア獲得フローティングテキスト
  showScoreGain(event: ScoreGainEvent): void {
    const label =
      event.combo > 1 ? `+${event.score} × ${event.combo}` : `+${event.score}`

    const color =
      event.combo >= 3 ? 0xffdd00 : event.combo >= 2 ? 0xff8800 : 0xffffff

    floatLabel(this.container, label, event.x, event.y, {
      color,
      fontSize: event.combo >= 2 ? 18 : 14,
      riseBy: 40,
      duration: 1.2,
    })
  }

  /**
   * #44: MISS テキスト表示（敵に当たらなかった蜂忍術タップ用）。
   */
  showMiss(x: number, y: number): void {
    floatLabel(this.container, 'MISS', x, y, {
      color: 0xaaaaaa,
      fontSize: 18,
      riseBy: 30,
      duration: 0.8,
    })
  }

  /**
   * #44: MULTI HIT テキスト（一発で複数撃破）。
   */
  showMultiHit(x: number, y: number, count: number): void {
    floatLabel(this.container, `× ${count} MULTI HIT`, x, y, {
      color: 0xffaa00,
      fontSize: 20,
      riseBy: 50,
      duration: 1.0,
    })
  }

  /**
   * #44: PERFECT PIERCE 表示（蜂忍術が完全に貫通したとき）。
   */
  showPerfectPierce(x: number, y: number): void {
    floatLabel(this.container, 'PERFECT', x, y, {
      color: 0x66ffff,
      fontSize: 22,
      riseBy: 50,
      duration: 1.0,
    })
  }

  /**
   * #44: スコアロス（敵が家到達などでマイナス点）。
   */
  showScoreLoss(x: number, y: number, score: number): void {
    floatLabel(this.container, `-${score}`, x, y, {
      color: 0xff4444,
      fontSize: 20,
      riseBy: 40,
      duration: 1.2,
    })
  }

  destroy(): void {
    this.container.destroy()
  }
}
