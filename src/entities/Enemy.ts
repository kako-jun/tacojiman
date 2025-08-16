import Phaser from 'phaser'
import { EnemyType, EnemyData } from '@/types'

export class Enemy extends Phaser.GameObjects.Container {
  public enemyType: EnemyType
  public currentHP: number
  public maxHP: number
  public speed: number
  public scoreValue: number
  
  private sprite: Phaser.GameObjects.Shape
  private healthBar: Phaser.GameObjects.Rectangle | null = null
  private targetX: number
  private targetY: number
  private moveTween: Phaser.Tweens.Tween | null = null

  constructor(
    scene: Phaser.Scene, 
    x: number, 
    y: number, 
    enemyData: EnemyData,
    targetX: number,
    targetY: number
  ) {
    super(scene, x, y)
    
    this.enemyType = enemyData.type
    this.maxHP = enemyData.hp
    this.currentHP = enemyData.hp
    this.speed = enemyData.speed
    this.scoreValue = enemyData.score
    this.targetX = targetX
    this.targetY = targetY

    // 敵スプライト作成
    this.createSprite(enemyData)
    
    // シーンに追加
    scene.add.existing(this)
    
    // 敵はUIより低いdepthに設定
    this.setDepth(100)
    
    // 移動開始
    this.startMovement()
  }

  private createSprite(enemyData: EnemyData) {
    const size = this.currentHP === 2 ? 24 : 20
    const color = this.currentHP === 2 ? 
      Phaser.Display.Color.HexStringToColor(enemyData.color.hp2).color :
      Phaser.Display.Color.HexStringToColor(enemyData.color.hp1).color

    // 敵タイプに応じた形状作成
    switch (this.enemyType) {
      case 'ground':
        // 地上：矩形（Rectangle）
        this.sprite = this.scene.add.rectangle(0, 0, size, size, color)
        break
      case 'water':
        // 海上：円形（Circle）
        this.sprite = this.scene.add.circle(0, 0, size / 2, color)
        break
      case 'air':
        // 空：三角形（Triangle）
        this.sprite = this.scene.add.triangle(0, 0, 0, -size/2, -size/2, size/2, size/2, size/2, color)
        break
      case 'underground':
        // 地下：菱形（Diamond）
        const points = [
          0, -size/2,    // 上
          size/2, 0,     // 右
          0, size/2,     // 下
          -size/2, 0     // 左
        ]
        this.sprite = this.scene.add.polygon(0, 0, points, color)
        break
      default:
        // デフォルト：矩形
        this.sprite = this.scene.add.rectangle(0, 0, size, size, color)
        break
    }

    this.sprite.setStrokeStyle(2, 0xffffff)
    this.add(this.sprite)

    // HP1の場合は線を細くする
    if (this.currentHP === 1) {
      this.sprite.setStrokeStyle(1, 0xffffff)
    }
  }

  private startMovement() {
    if (!this.scene || !this.scene.tweens) {
      return
    }

    const distance = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY)
    const duration = (distance / this.speed) * 100 // speedに応じて調整

    this.moveTween = this.scene.tweens.add({
      targets: this,
      x: this.targetX,
      y: this.targetY,
      duration: duration,
      ease: this.getMovementEase(),
      onComplete: () => {
        this.onReachTarget()
      }
    })
  }

  private getMovementEase(): string {
    switch (this.enemyType) {
      case 'ground':
        return 'Linear' // 道路歩行型：一定速度
      case 'water':
        return 'Sine.easeInOut' // 海上遡上型：波のような動き
      case 'air':
        return 'Back.easeOut' // 空挺降下型：パラシュート風
      case 'underground':
        return 'Bounce.easeOut' // 地下掘削型：突然出現
      default:
        return 'Linear'
    }
  }

  public takeDamage(damage: number = 1): { destroyed: boolean; score: number } {
    this.currentHP -= damage
    
    // ダメージエフェクト
    this.showDamageEffect()
    
    if (this.currentHP <= 0) {
      this.destroy()
      return { destroyed: true, score: this.scoreValue }
    } else {
      // HP減少による見た目変化
      this.updateAppearance()
      return { destroyed: false, score: 0 }
    }
  }

  private showDamageEffect() {
    if (!this.scene || !this.scene.tweens) {
      return
    }

    // 点滅エフェクト
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 1
    })

    // ヒットストップ風の一瞬停止
    if (this.moveTween && this.scene.time) {
      this.moveTween.pause()
      this.scene.time.delayedCall(50, () => {
        if (this.moveTween) {
          this.moveTween.resume()
        }
      })
    }
  }

  private updateAppearance() {
    if (this.currentHP === 1) {
      // HP1になったらピンク色に変更（サイズは変更しない）
      this.sprite.setFillStyle(0xFF8888)
      this.sprite.setStrokeStyle(1, 0xffffff)
    }
  }

  private onReachTarget() {
    // プレイヤーの家に到達
    if (this.scene && this.scene.events) {
      this.scene.events.emit('enemy-reached-house', this)
    }
  }

  public checkCollision(x: number, y: number, radius: number = 60): boolean {
    // 敵の当たり判定を大きくする（デフォルト60ピクセル - 指が隠れる範囲）
    const distance = Phaser.Math.Distance.Between(this.x, this.y, x, y)
    return distance <= radius
  }

  public pauseMovement() {
    if (this.moveTween) {
      this.moveTween.pause()
    }
  }

  public resumeMovement() {
    if (this.moveTween) {
      this.moveTween.resume()
    }
  }

  public setTarget(newTargetX: number, newTargetY: number) {
    // 現在の移動を停止
    if (this.moveTween) {
      this.moveTween.remove()
    }
    
    // 新しい標的を設定
    this.targetX = newTargetX
    this.targetY = newTargetY
    
    // 新しい標的に向かって移動開始
    this.startMovement()
  }

  destroy(fromScene?: boolean) {
    if (this.moveTween) {
      this.moveTween.remove()
    }
    super.destroy(fromScene)
  }
}