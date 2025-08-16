import Phaser from 'phaser'
import { EnemyType, EnemyData } from '@/types'

export class Enemy extends Phaser.GameObjects.Container {
  public enemyType: EnemyType
  public currentHP: number
  public maxHP: number
  public speed: number
  public scoreValue: number
  
  private sprite: Phaser.GameObjects.Rectangle
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
    
    // 移動開始
    this.startMovement()
  }

  private createSprite(enemyData: EnemyData) {
    const size = this.currentHP === 2 ? 24 : 20
    const color = this.currentHP === 2 ? 
      Phaser.Display.Color.HexStringToColor(enemyData.color.hp2).color :
      Phaser.Display.Color.HexStringToColor(enemyData.color.hp1).color

    this.sprite = this.scene.add.rectangle(0, 0, size, size, color)
    this.sprite.setStrokeStyle(2, 0xffffff)
    this.add(this.sprite)

    // HP2の場合は少し大きく、角張った形状
    if (this.currentHP === 2) {
      this.sprite.setDisplaySize(24, 24)
    } else {
      this.sprite.setDisplaySize(20, 20)
      // HP1の場合は少し丸みを帯びた感じに
      this.sprite.setStrokeStyle(1, 0xffffff)
    }

    // 敵タイプに応じた形状調整
    switch (this.enemyType) {
      case 'air':
        // 空挺降下型：少し細長い
        this.sprite.setDisplaySize(size, size * 0.8)
        break
      case 'underground':
        // 地下掘削型：正方形
        this.sprite.setDisplaySize(size * 0.9, size * 0.9)
        break
      case 'water':
        // 海上遡上型：少し横長
        this.sprite.setDisplaySize(size * 1.1, size * 0.9)
        break
    }
  }

  private startMovement() {
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
    // 点滅エフェクト
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 1
    })

    // ヒットストップ風の一瞬停止
    if (this.moveTween) {
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
      // HP1になったらピンク色に変更
      this.sprite.setFillStyle(0xFF8888)
      this.sprite.setDisplaySize(20, 20)
      this.sprite.setStrokeStyle(1, 0xffffff)
    }
  }

  private onReachTarget() {
    // プレイヤーの家に到達
    this.scene.events.emit('enemy-reached-house', this)
  }

  public checkCollision(x: number, y: number, radius: number = 15): boolean {
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