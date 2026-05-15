import { Container, Text } from 'pixi.js'
import gsap from 'gsap'
import type { ScoreGainEvent } from '../game/GameEvents'

export class EffectManager {
  private readonly container: Container

  constructor(parent: Container) {
    this.container = new Container()
    parent.addChild(this.container)
  }

  // スコア獲得フローティングテキスト
  showScoreGain(event: ScoreGainEvent): void {
    const label = event.combo > 1
      ? `+${event.score} × ${event.combo}`
      : `+${event.score}`

    const color = event.combo >= 3 ? 0xffdd00 : event.combo >= 2 ? 0xff8800 : 0xffffff

    const text = new Text({
      text: label,
      style: {
        fill: color,
        fontFamily: 'monospace',
        fontSize: event.combo >= 2 ? 18 : 14,
        fontWeight: '700',
        stroke: { color: 0x000000, width: 3 },
      },
    })
    text.anchor.set(0.5, 0.5)
    text.x = event.x
    text.y = event.y
    this.container.addChild(text)

    // 上方向に浮かんでフェードアウト
    gsap.to(text, {
      y: event.y - 40,
      alpha: 0,
      duration: 1.2,
      ease: 'power2.out',
      onComplete: () => {
        text.destroy()
      },
    })
  }

  destroy(): void {
    this.container.destroy()
  }
}
