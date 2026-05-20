import { Container, Graphics, Text } from 'pixi.js'
import gsap from 'gsap'
import type { ScoreGainEvent } from '../game/GameEvents'

/**
 * 浮上フェードテキスト用の共通ヘルパ（#44）。
 *
 * 親 (mapLayer) は回転するので、テキストを単に `text.rotation = -parentRotation`
 * で counter-rotate しただけだとフロート方向 (y -= riseBy) が mapLayer ローカル軸
 * に縛られ、世界の上向きに揃わない（マップが 180° 回転したときに「下に潜る」）。
 *
 * 対策として「位置だけ持つ wrapper container を親に置き、毎フレーム counter-rotate
 * する」構造にする。テキストは wrapper の中で local y を上方向にトゥイーンするので
 * wrapper の世界上向きと一致し、字面も位置も正立する。
 */
function floatLabel(
  parent: Container,
  registerUpright: (c: Container) => void,
  label: string,
  x: number,
  y: number,
  options: {
    color?: number
    fontSize?: number
    riseBy?: number
    duration?: number
  } = {}
): Container {
  const wrapper = new Container()
  wrapper.x = x
  wrapper.y = y
  parent.addChild(wrapper)
  registerUpright(wrapper)

  const text = new Text({
    text: label,
    style: {
      fill: options.color ?? 0xffffff,
      fontFamily: 'monospace',
      fontSize: options.fontSize ?? 16,
      fontWeight: '700',
      stroke: { color: 0x000000, width: 3 },
      wordWrap: false,
      align: 'center',
    },
  })
  text.anchor.set(0.5, 0.5)
  wrapper.addChild(text)

  const riseBy = options.riseBy ?? 40
  const duration = options.duration ?? 1.0
  gsap.to(text, {
    y: -riseBy,
    duration,
    ease: 'power2.out',
  })
  gsap.to(text, {
    alpha: 0,
    duration,
    ease: 'power2.out',
    onComplete: () => wrapper.destroy({ children: true }),
  })
  return wrapper
}

export class EffectManager {
  private readonly container: Container
  // wrapper container の rotation を毎フレーム親の逆回転に合わせて正立を保つ
  private readonly upright: Set<Container> = new Set()

  constructor(parent: Container) {
    this.container = new Container()
    parent.addChild(this.container)
  }

  private trackUpright = (c: Container): void => {
    this.upright.add(c)
  }

  /**
   * 毎フレーム呼ぶ。親 (mapLayer) の rotation を打ち消し、フロートテキストを正立させる。
   * 破棄済み container は遅延 GC として走査時に削除する。
   */
  update(parentRotation: number): void {
    if (this.upright.size === 0) return
    const dead: Container[] = []
    for (const c of this.upright) {
      if (c.destroyed) {
        dead.push(c)
        continue
      }
      c.rotation = -parentRotation
    }
    for (const c of dead) this.upright.delete(c)
  }

  // スコア獲得フローティングテキスト
  showScoreGain(event: ScoreGainEvent): void {
    const label =
      event.combo > 1 ? `+${event.score} x${event.combo}` : `+${event.score}`

    const color =
      event.combo >= 3 ? 0xffdd00 : event.combo >= 2 ? 0xff8800 : 0xffffff

    floatLabel(this.container, this.trackUpright, label, event.x, event.y, {
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
    floatLabel(this.container, this.trackUpright, 'MISS', x, y, {
      color: 0xaaaaaa,
      fontSize: 18,
      riseBy: 30,
      duration: 0.8,
    })
  }

  /**
   * #44: MULTI HIT テキスト（一発で複数撃破）。
   * ASCII `x` を使い PixiJS Text の wordWrap=false と合わせて改行誘発を防ぐ。
   */
  showMultiHit(x: number, y: number, count: number): void {
    floatLabel(
      this.container,
      this.trackUpright,
      `x${count} MULTI HIT`,
      x,
      y,
      {
        color: 0xffaa00,
        fontSize: 20,
        riseBy: 50,
        duration: 1.0,
      }
    )
  }

  /**
   * #44: PERFECT PIERCE 表示（蜂忍術が完全に貫通したとき）。
   */
  showPerfectPierce(x: number, y: number): void {
    floatLabel(this.container, this.trackUpright, 'PERFECT', x, y, {
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
    floatLabel(this.container, this.trackUpright, `-${score}`, x, y, {
      color: 0xff4444,
      fontSize: 20,
      riseBy: 40,
      duration: 1.2,
    })
  }

  /**
   * タップ位置に攻撃範囲を半透明赤円で表示する。
   * 0.45s でフェードアウト。Graphics は円対称 + 世界座標固定（mapLayer 子）なので
   * counter-rotate 不要（マップ回転に乗って world 上のタップ点に貼り付く）。
   */
  showAttackRange(x: number, y: number, radius: number): void {
    const g = new Graphics()
    g.circle(0, 0, radius)
    g.fill({ color: 0xff3344, alpha: 0.28 })
    g.circle(0, 0, radius)
    g.stroke({ color: 0xff6677, width: 2, alpha: 0.9 })
    g.x = x
    g.y = y
    g.scale.set(0.6)
    this.container.addChild(g)
    gsap.to(g.scale, { x: 1, y: 1, duration: 0.18, ease: 'power2.out' })
    gsap.to(g, {
      alpha: 0,
      duration: 0.45,
      ease: 'power2.out',
      onComplete: () => g.destroy(),
    })
  }

  /**
   * 敵撃破時の派手な破裂エフェクト。
   * - 中央フラッシュ円が瞬時に大きくなって消える
   * - リング波紋
   * - 8 方向（takokong は 14 方向）にパーティクルを飛ばす
   * Graphics は対称なので counter-rotate 不要。world 上の撃破点に貼り付く。
   */
  showEnemyBurst(x: number, y: number, isTakokong = false): void {
    const scale = isTakokong ? 1.8 : 1.0

    const flash = new Graphics()
    flash.circle(0, 0, 6 * scale)
    flash.fill({ color: 0xffffff, alpha: 0.95 })
    flash.x = x
    flash.y = y
    this.container.addChild(flash)
    gsap.to(flash.scale, {
      x: 6,
      y: 6,
      duration: 0.35,
      ease: 'power2.out',
    })
    gsap.to(flash, {
      alpha: 0,
      duration: 0.35,
      ease: 'power2.out',
      onComplete: () => flash.destroy(),
    })

    const ring = new Graphics()
    ring.circle(0, 0, 14 * scale)
    ring.stroke({ color: isTakokong ? 0xff66cc : 0xffaa33, width: 3, alpha: 1 })
    ring.x = x
    ring.y = y
    this.container.addChild(ring)
    gsap.to(ring.scale, { x: 2.6, y: 2.6, duration: 0.5, ease: 'power2.out' })
    gsap.to(ring, {
      alpha: 0,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => ring.destroy(),
    })

    const particleCount = isTakokong ? 14 : 8
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount
      const dist = (28 + Math.random() * 18) * scale
      const p = new Graphics()
      p.circle(0, 0, (2 + Math.random() * 1.5) * scale)
      p.fill({ color: isTakokong ? 0xffccee : 0xffdd66, alpha: 1 })
      p.x = x
      p.y = y
      this.container.addChild(p)
      gsap.to(p, {
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 0.55,
        ease: 'power2.out',
        onComplete: () => p.destroy(),
      })
    }
  }

  destroy(): void {
    this.container.destroy()
  }
}
