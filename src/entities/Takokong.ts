import Phaser from 'phaser'

export class Takokong extends Phaser.GameObjects.Container {
  // 見た目HP2だが実質42回攻撃が必要
  public visualHP: number = 2 // 見た目のHP（1 or 2）
  public maxVisualHP: number = 2
  public totalHitsRequired: number = 42 // 実際に必要な攻撃回数
  public currentHits: number = 0 // 現在の被攻撃回数
  
  // バリアシステム
  public currentBarrierHits: number = 0 // 現在のバリア攻撃回数
  public barrierThreshold: number = 10 // バリア破壊に必要な攻撃回数
  public hasBarrier: boolean = true // バリア状態
  
  private sprite: Phaser.GameObjects.Rectangle
  private barrierEffect: Phaser.GameObjects.Circle
  private healthBar: Phaser.GameObjects.Rectangle
  private healthBarBg: Phaser.GameObjects.Rectangle
  private moveTween: Phaser.Tweens.Tween | null = null
  private attackTimer: Phaser.Time.TimerEvent | null = null
  
  private targetX: number
  private targetY: number

  constructor(scene: Phaser.Scene, x: number, y: number, targetX: number, targetY: number) {
    super(scene, x, y)
    
    this.targetX = targetX
    this.targetY = targetY
    
    this.createSprite()
    this.createHealthBar()
    this.scene.add.existing(this)
    
    // 登場演出
    this.playEntranceAnimation()
  }

  private createSprite() {
    // タココング本体（巨大サイズ）- 初期は赤色（HP2状態）
    this.sprite = this.scene.add.rectangle(0, 0, 80, 80, 0xFF4444)
    this.sprite.setStrokeStyle(3, 0xffffff)
    this.add(this.sprite)
    
    // バリアエフェクト
    this.barrierEffect = this.scene.add.circle(0, 0, 50, 0x00ffff, 0.3)
    this.barrierEffect.setStrokeStyle(2, 0x00ffff)
    this.add(this.barrierEffect)
    
    // バリアの脈動アニメーション
    this.scene.tweens.add({
      targets: this.barrierEffect,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0.1,
      duration: 800,
      yoyo: true,
      repeat: -1
    })
    
    // 威圧的なオーラエフェクト
    const aura = this.scene.add.circle(0, 0, 60, 0x8800ff, 0.2)
    this.add(aura)
    
    // オーラの脈動アニメーション
    this.scene.tweens.add({
      targets: aura,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0.05,
      duration: 1200,
      yoyo: true,
      repeat: -1
    })
  }

  private createHealthBar() {
    // HPバー背景
    this.healthBarBg = this.scene.add.rectangle(0, -50, 80, 8, 0x333333)
    this.healthBarBg.setStrokeStyle(1, 0xffffff)
    this.add(this.healthBarBg)
    
    // HPバー本体（見た目のHP2を表示）
    this.healthBar = this.scene.add.rectangle(0, -50, 80, 6, 0xff0000)
    this.add(this.healthBar)
    
    // ボス名表示
    const nameText = this.scene.add.text(0, -70, 'TAKOKONG', {
      fontSize: '16px',
      color: '#ff4444',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5)
    this.add(nameText)
    
    // バリア攻撃回数表示（デバッグ用）
    const barrierText = this.scene.add.text(0, -90, 'Barrier: 10/10', {
      fontSize: '12px',
      color: '#00ffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(0.5)
    this.add(barrierText)
    barrierText.setData('isBarrierText', true)
  }

  private playEntranceAnimation() {
    // 画面暗転
    this.scene.cameras.main.fadeOut(200, 0, 0, 0)
    
    this.scene.time.delayedCall(200, () => {
      // 画面フラッシュ
      this.scene.cameras.main.flash(300, 255, 0, 255)
      this.scene.cameras.main.fadeIn(300)
      
      // 登場移動
      this.moveTween = this.scene.tweens.add({
        targets: this,
        y: this.targetY - 50, // 家より少し上に位置
        duration: 2000,
        ease: 'Power2',
        onComplete: () => {
          this.startBossBehavior()
        }
      })
      
      // 登場時のカメラシェイク
      this.scene.cameras.main.shake(1000, 10)
    })
  }

  private startBossBehavior() {
    // 10秒間での高速移動攻撃パターン
    this.attackTimer = this.scene.time.addEvent({
      delay: 500, // 0.5秒ごとに攻撃
      callback: () => {
        this.performAttack()
      },
      loop: true
    })
    
    // 家に向かってゆっくり移動
    this.moveTween = this.scene.tweens.add({
      targets: this,
      x: this.targetX,
      y: this.targetY,
      duration: 8000, // 8秒で到達
      ease: 'Linear',
      onComplete: () => {
        this.onReachTarget()
      }
    })
  }

  private performAttack() {
    // プレイヤーにダメージイベント発火
    this.scene.events.emit('player-damaged', 5)
    
    // 攻撃エフェクト
    const attackEffect = this.scene.add.circle(this.x, this.y, 40, 0xff0044, 0.7)
    this.scene.tweens.add({
      targets: attackEffect,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 400,
      onComplete: () => attackEffect.destroy()
    })
  }

  public takeDamage(damage: number = 1): { destroyed: boolean; score: number } {
    this.currentHits++
    
    if (this.hasBarrier) {
      // バリア状態では攻撃回数をカウント
      this.currentBarrierHits++
      
      if (this.currentBarrierHits >= this.barrierThreshold) {
        // バリア破壊
        this.destroyBarrier()
        this.dealActualDamage()
      } else {
        // バリア攻撃エフェクトのみ
        this.showBarrierHitEffect()
      }
    } else {
      // バリアなし状態では10回で1ダメージ
      if (this.currentHits % 10 === 0) {
        this.dealActualDamage()
      } else {
        this.showBarrierHitEffect()
      }
    }
    
    this.updateDisplay()
    
    if (this.visualHP <= 0) {
      this.onDefeated()
      return { destroyed: true, score: 100 }
    }
    
    return { destroyed: false, score: 0 }
  }
  
  private destroyBarrier() {
    this.hasBarrier = false
    this.currentBarrierHits = 0
    
    // バリア破壊エフェクト
    this.scene.tweens.add({
      targets: this.barrierEffect,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.barrierEffect.setVisible(false)
      }
    })
    
    // バリア破壊音（光エフェクト）
    this.scene.cameras.main.flash(200, 0, 255, 255)
  }
  
  private dealActualDamage() {
    this.visualHP--
    this.showDamageEffect()
    
    // 21回目の攻撃（HP2→HP1）で色変化
    if (this.currentHits === 21) {
      this.sprite.setFillStyle(0xFF8888) // ピンク色に変更
    }
  }

  private showDamageEffect() {
    // 強烈な点滅エフェクト
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.2,
      duration: 100,
      yoyo: true,
      repeat: 2
    })
    
    // ヒットストップ
    if (this.moveTween) {
      this.moveTween.pause()
      this.scene.time.delayedCall(100, () => {
        if (this.moveTween) {
          this.moveTween.resume()
        }
      })
    }
    
    // カメラシェイク
    this.scene.cameras.main.shake(200, 5)
  }
  
  private showBarrierHitEffect() {
    // バリアへの攻撃エフェクト（軽い点滅）
    this.scene.tweens.add({
      targets: this.barrierEffect,
      alpha: 0.8,
      duration: 50,
      yoyo: true,
      repeat: 1
    })
    
    // 軽いカメラシェイク
    this.scene.cameras.main.shake(100, 2)
  }

  private updateDisplay() {
    this.updateHealthBar()
    this.updateBarrierText()
  }

  private updateHealthBar() {
    const healthPercent = this.visualHP / this.maxVisualHP
    this.healthBar.setDisplaySize(80 * healthPercent, 6)
    
    // 見た目HPに応じて色変化
    if (this.visualHP === 2) {
      this.healthBar.setFillStyle(0xff0000) // 赤
    } else if (this.visualHP === 1) {
      this.healthBar.setFillStyle(0xff8888) // ピンク
    } else {
      this.healthBar.setFillStyle(0x444444) // グレー（撃破時）
    }
  }
  
  private updateBarrierText() {
    const barrierText = this.list.find(child => child.getData('isBarrierText')) as Phaser.GameObjects.Text
    if (barrierText) {
      if (this.hasBarrier) {
        const remaining = this.barrierThreshold - this.currentBarrierHits
        barrierText.setText(`Barrier: ${remaining}/${this.barrierThreshold}`)
        barrierText.setVisible(true)
      } else {
        const nextDamage = 10 - (this.currentHits % 10)
        barrierText.setText(`Next: ${nextDamage}/10`)
      }
    }
  }

  private onDefeated() {
    // 攻撃停止
    if (this.attackTimer) {
      this.attackTimer.remove()
    }
    
    if (this.moveTween) {
      this.moveTween.remove()
    }
    
    // 撃破演出
    this.scene.cameras.main.flash(500, 255, 255, 255)
    this.scene.cameras.main.shake(1000, 15)
    
    // 爆発エフェクト
    for (let i = 0; i < 8; i++) {
      this.scene.time.delayedCall(i * 100, () => {
        const explosion = this.scene.add.circle(
          this.x + (Math.random() - 0.5) * 100,
          this.y + (Math.random() - 0.5) * 100,
          20 + Math.random() * 20,
          0xff4400,
          0.8
        )
        
        this.scene.tweens.add({
          targets: explosion,
          scaleX: 3,
          scaleY: 3,
          alpha: 0,
          duration: 500,
          onComplete: () => explosion.destroy()
        })
      })
    }
    
    // 1秒後に消去
    this.scene.time.delayedCall(1000, () => {
      this.scene.events.emit('takokong-defeated')
      this.destroy()
    })
  }

  private onReachTarget() {
    // 家に到達 = ゲームオーバー
    this.scene.events.emit('game-over-takokong-reached')
  }

  public checkCollision(x: number, y: number, radius: number = 40): boolean {
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

  destroy(fromScene?: boolean) {
    if (this.moveTween) {
      this.moveTween.remove()
    }
    if (this.attackTimer) {
      this.attackTimer.remove()
    }
    super.destroy(fromScene)
  }
}