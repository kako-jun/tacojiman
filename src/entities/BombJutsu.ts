import Phaser from 'phaser'
import { BombType, BombData } from '@/types'

export class BombJutsu {
  public type: BombType
  public data: BombData
  
  constructor(type: BombType, data: BombData) {
    this.type = type
    this.data = data
  }

  public activate(scene: Phaser.Scene, homeX: number, homeY: number, targetX?: number, targetY?: number): void {
    switch (this.type) {
      case 'proton':
        this.activateProtonBeam(scene, homeX, homeY, targetX || homeX + 1000, targetY || homeY)
        break
      case 'muddy':
        this.activateMuddyBomb(scene, homeX, homeY, targetX || homeX, targetY || homeY)
        break
      case 'sentry':
        this.activateSentryGun(scene, homeX, homeY, targetX || homeX + 50, targetY || homeY)
        break
      case 'muteki':
        this.activateMutekiHoudai(scene, homeX, homeY)
        break
      case 'sol':
        this.activateSOL(scene, homeX, homeY)
        break
      case 'dainsleif':
        this.activateDainsleif(scene, homeX, homeY, targetX || homeX, targetY || homeY)
        break
      case 'jakuhou':
        this.activateJakuhou(scene, homeX, homeY)
        break
      case 'bunshin':
        this.activateBunshin(scene, homeX, homeY)
        break
    }
  }

  private activateProtonBeam(scene: Phaser.Scene, startX: number, startY: number, endX: number, endY: number) {
    // チャージアップエフェクト（2秒間）
    const chargeEffect = scene.add.circle(startX, startY, 10, 0xffffff, 0.5)
    
    scene.tweens.add({
      targets: chargeEffect,
      scaleX: 3,
      scaleY: 3,
      alpha: 1,
      duration: 2000,
      ease: 'Power2'
    })

    // 2秒後にビーム発射
    scene.time.delayedCall(2000, () => {
      chargeEffect.destroy()
      this.fireProtonBeam(scene, startX, startY, endX, endY)
    })
  }

  private fireProtonBeam(scene: Phaser.Scene, startX: number, startY: number, endX: number, endY: number) {
    const beamLength = Phaser.Math.Distance.Between(startX, startY, endX, endY)
    const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY)
    
    // ビーム本体
    const beam = scene.add.rectangle(startX, startY, beamLength, 40, 0xffffff, 0.9)
    beam.setOrigin(0, 0.5)
    beam.setRotation(angle)
    
    // パーティクルエフェクト
    const particles = scene.add.particles(startX, startY, 'white', {
      speed: { min: 50, max: 100 },
      lifespan: 500,
      quantity: 3,
      tint: 0x00ffff
    })

    // ビームのダメージ判定（ライン上の全ての敵にダメージ）
    scene.events.emit('bomb-damage-line', {
      startX, startY, endX, endY,
      damage: this.data.damage,
      width: 40
    })

    // ビーム消去
    scene.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        beam.destroy()
        particles.destroy()
      }
    })
  }

  private activateMuddyBomb(scene: Phaser.Scene, homeX: number, homeY: number, targetX: number, targetY: number) {
    // 設置可能範囲チェック（家から半径3マス以内）
    const distance = Phaser.Math.Distance.Between(homeX, homeY, targetX, targetY)
    if (distance > 180) { // 3マス = 180ピクセル
      targetX = homeX + (targetX - homeX) * 180 / distance
      targetY = homeY + (targetY - homeY) * 180 / distance
    }

    // 地雷設置
    const mine = scene.add.circle(targetX, targetY, 8, 0x8B4513, 0.8)
    mine.setStrokeStyle(2, 0xffffff)
    mine.setData('isMine', true)
    mine.setData('damage', this.data.damage)

    // 地雷の監視（地下掘削型タコの出現を待つ）
    const mineChecker = scene.time.addEvent({
      delay: 100,
      callback: () => {
        // 地下敵が範囲内に出現したかチェック
        scene.events.emit('check-mine-trigger', {
          x: targetX,
          y: targetY,
          range: this.data.range,
          damage: this.data.damage,
          mine: mine,
          checker: mineChecker
        })
      },
      loop: true
    })

    // 30秒後に自動消去
    scene.time.delayedCall(30000, () => {
      if (mine.active) {
        mine.destroy()
        mineChecker.remove()
      }
    })
  }

  private activateSentryGun(scene: Phaser.Scene, homeX: number, homeY: number, targetX: number, targetY: number) {
    // 設置可能範囲チェック（家から半径5マス以内）
    const distance = Phaser.Math.Distance.Between(homeX, homeY, targetX, targetY)
    if (distance > 300) { // 5マス = 300ピクセル
      targetX = homeX + (targetX - homeX) * 300 / distance
      targetY = homeY + (targetY - homeY) * 300 / distance
    }

    // セントリーガン設置
    const sentry = scene.add.rectangle(targetX, targetY, 20, 20, 0x666666)
    sentry.setStrokeStyle(2, 0x00ffff)
    
    // 砲身
    const barrel = scene.add.rectangle(targetX, targetY - 5, 15, 3, 0x888888)
    barrel.setOrigin(0, 0.5)

    // 5秒間の自動射撃
    let shotCount = 0
    const maxShots = 25 // 5秒 / 0.2秒 = 25発

    const fireTimer = scene.time.addEvent({
      delay: 200, // 0.2秒間隔
      callback: () => {
        shotCount++
        
        // 最も近い敵を検索
        scene.events.emit('sentry-find-target', {
          x: targetX,
          y: targetY,
          range: this.data.range,
          damage: this.data.damage,
          barrel: barrel
        })

        if (shotCount >= maxShots) {
          // セントリーガン消去
          fireTimer.remove()
          scene.tweens.add({
            targets: [sentry, barrel],
            alpha: 0,
            duration: 300,
            onComplete: () => {
              sentry.destroy()
              barrel.destroy()
            }
          })
        }
      },
      loop: true
    })
  }

  private activateMutekiHoudai(scene: Phaser.Scene, homeX: number, homeY: number) {
    const { width, height } = scene.scale
    
    // 初期エフェクト（画面フラッシュなし）
    
    // 初期の光エフェクト
    const flashEffect = scene.add.circle(homeX, homeY, 20, 0xffffff, 0.9)
    scene.tweens.add({
      targets: flashEffect,
      scaleX: 5,
      scaleY: 5,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        flashEffect.destroy()
        // 光の後に連続爆撃開始
        this.startContinuousBombing(scene, homeX, homeY, width, height)
      }
    })
  }

  private startContinuousBombing(scene: Phaser.Scene, homeX: number, homeY: number, width: number, height: number) {
    const explosionCount = 5
    let currentExplosion = 0
    
    const explodeNext = () => {
      if (currentExplosion >= explosionCount) return
      
      // ランダムな位置に爆発
      const explosionX = Math.random() * width
      const explosionY = Math.random() * height
      
      // 爆発予告エフェクト（0.5秒前）
      const warningCircle = scene.add.circle(explosionX, explosionY, this.data.range, 0xff4444, 0.3)
      warningCircle.setStrokeStyle(2, 0xff0000)
      
      // 警告の点滅
      scene.tweens.add({
        targets: warningCircle,
        alpha: 0.1,
        duration: 250,
        yoyo: true,
        repeat: 1
      })
      
      // 0.5秒後に実際の爆発
      scene.time.delayedCall(500, () => {
        warningCircle.destroy()
        this.createExplosion(scene, explosionX, explosionY)
        
        currentExplosion++
        
        // 次の爆発を0.3秒後に予約
        scene.time.delayedCall(300, explodeNext)
      })
    }
    
    // 最初の爆発開始
    explodeNext()
  }

  private createExplosion(scene: Phaser.Scene, x: number, y: number) {
    // 爆発エフェクト
    const explosion = scene.add.circle(x, y, this.data.range, 0xff6600, 0.8)
    
    // 爆発アニメーション
    scene.tweens.add({
      targets: explosion,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => explosion.destroy()
    })
    
    // 爆発パーティクル
    const particles: Phaser.GameObjects.Circle[] = []
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const distance = 30 + Math.random() * 20
      const particleX = x + Math.cos(angle) * distance
      const particleY = y + Math.sin(angle) * distance
      
      const particle = scene.add.circle(x, y, 5, 0xff8800, 0.7)
      particles.push(particle)
      
      scene.tweens.add({
        targets: particle,
        x: particleX,
        y: particleY,
        alpha: 0,
        duration: 300,
        onComplete: () => particle.destroy()
      })
    }
    
    // ダメージ判定
    scene.events.emit('muteki-explosion', {
      x: x,
      y: y,
      range: this.data.range,
      damage: this.data.damage
    })
    
    // カメラシェイク
    scene.cameras.main.shake(200, 8)
  }

  private activateSOL(scene: Phaser.Scene, homeX: number, homeY: number) {
    const { width, height } = scene.scale
    
    // 宇宙からの攻撃演出開始（画面暗転なし）
    // 直接ターゲティング開始
    this.showSOLTargeting(scene, homeX, homeY, width, height)
  }

  private showSOLTargeting(scene: Phaser.Scene, homeX: number, homeY: number, width: number, height: number) {
    // 画面フェードイン削除
    
    // ランダムなターゲット位置（家の周辺）
    const targetX = homeX + (Math.random() - 0.5) * 200
    const targetY = homeY + (Math.random() - 0.5) * 200
    
    // ターゲティングサークル（AKIRA風）
    const targetCircle = scene.add.circle(targetX, targetY, this.data.range, 0xff0000, 0)
    targetCircle.setStrokeStyle(3, 0xff0000)
    
    // 十字線
    const crossH = scene.add.rectangle(targetX, targetY, this.data.range * 2, 2, 0xff0000)
    const crossV = scene.add.rectangle(targetX, targetY, 2, this.data.range * 2, 0xff0000)
    
    // ターゲティング点滅
    scene.tweens.add({
      targets: [targetCircle, crossH, crossV],
      alpha: 0.3,
      duration: 200,
      yoyo: true,
      repeat: 9 // 2秒間点滅
    })
    
    // 2秒後にSOL発射
    scene.time.delayedCall(2000, () => {
      targetCircle.destroy()
      crossH.destroy()
      crossV.destroy()
      this.fireSOLBeam(scene, targetX, targetY)
    })
  }

  private fireSOLBeam(scene: Phaser.Scene, targetX: number, targetY: number) {
    // 宇宙からのビーム降下
    const beamStartY = -100
    const beamHeight = scene.scale.height + 200
    
    // ビーム本体（縦の巨大な光柱）
    const beam = scene.add.rectangle(targetX, beamStartY + beamHeight / 2, 30, beamHeight, 0xffffff, 0.9)
    beam.setStrokeStyle(5, 0x00ffff)
    
    // ビーム登場アニメーション
    beam.setScale(0.1, 1)
    scene.tweens.add({
      targets: beam,
      scaleX: 1,
      duration: 200,
      ease: 'Power3'
    })
    
    // 爆発エフェクト
    const explosion = scene.add.circle(targetX, targetY, this.data.range, 0xffffff, 0.8)
    scene.tweens.add({
      targets: explosion,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 800,
      onComplete: () => explosion.destroy()
    })
    
    // 強烈なカメラシェイク（フラッシュなし）
    scene.cameras.main.shake(1000, 15)
    
    // ダメージ判定
    scene.events.emit('sol-strike', {
      x: targetX,
      y: targetY,
      range: this.data.range,
      damage: this.data.damage
    })
    
    // ビーム消去
    scene.time.delayedCall(800, () => {
      beam.destroy()
    })
  }

  private activateDainsleif(scene: Phaser.Scene, homeX: number, homeY: number, targetX: number, targetY: number) {
    // ダインスレイブは狙った方向に貫通攻撃
    const angle = Phaser.Math.Angle.Between(homeX, homeY, targetX, targetY)
    const distance = Math.max(scene.scale.width, scene.scale.height) * 2 // 画面を貫通する長さ
    
    // 最終的な貫通終点
    const endX = homeX + Math.cos(angle) * distance
    const endY = homeY + Math.sin(angle) * distance
    
    // チャージエフェクト
    const chargeEffect = scene.add.circle(homeX, homeY, 15, 0x8800ff, 0.7)
    scene.tweens.add({
      targets: chargeEffect,
      scaleX: 2,
      scaleY: 2,
      alpha: 0.3,
      duration: 1000
    })
    
    // 1秒後に槍発射
    scene.time.delayedCall(1000, () => {
      chargeEffect.destroy()
      this.fireDainsleif(scene, homeX, homeY, endX, endY, angle)
    })
  }

  private fireDainsleif(scene: Phaser.Scene, startX: number, startY: number, endX: number, endY: number, angle: number) {
    const spearLength = Phaser.Math.Distance.Between(startX, startY, endX, endY)
    
    // ダインスレイブの槍（細い貫通攻撃）
    const spear = scene.add.rectangle(startX, startY, 60, this.data.range, 0x8800ff, 0.9)
    spear.setOrigin(0, 0.5)
    spear.setRotation(angle)
    spear.setStrokeStyle(2, 0xffffff)
    
    // 槍の先端エフェクト
    const spearTip = scene.add.circle(startX, startY, 8, 0xffffff, 1)
    
    // 多段ヒットの管理
    const hitTargets = new Set<any>() // 既にヒットした敵を管理
    const totalDuration = 500 // 貫通時間
    const hitInterval = 50 // ヒット間隔（ms）
    
    let currentStep = 0
    const totalSteps = Math.floor(totalDuration / hitInterval)
    
    // 槍の移動と多段ヒット
    const moveTimer = scene.time.addEvent({
      delay: hitInterval,
      callback: () => {
        currentStep++
        const progress = currentStep / totalSteps
        
        // 現在の槍の位置
        const currentX = startX + (endX - startX) * progress
        const currentY = startY + (endY - startY) * progress
        
        // 槍の位置更新
        spear.setPosition(currentX, currentY)
        spearTip.setPosition(currentX + Math.cos(angle) * 30, currentY + Math.sin(angle) * 30)
        
        // この位置での多段ヒット判定
        scene.events.emit('dainsleif-multihit', {
          x: currentX,
          y: currentY,
          width: this.data.range,
          damage: this.data.damage,
          hitTargets: hitTargets,
          step: currentStep
        })
        
        // ヒットエフェクト
        this.createSpearHitEffect(scene, currentX, currentY)
        
        // 終了判定
        if (currentStep >= totalSteps) {
          moveTimer.remove()
          scene.time.delayedCall(200, () => {
            spear.destroy()
            spearTip.destroy()
          })
          
          // 最終的なMiss判定
          scene.events.emit('dainsleif-final-check', { hitTargets: hitTargets })
        }
      },
      loop: true
    })
    
    // 強力な軌跡エフェクト
    this.createSpearTrailEffect(scene, startX, startY, angle, totalDuration)
    
    // 発射音（カメラシェイク）
    scene.cameras.main.shake(500, 12)
  }

  private activateJakuhou(scene: Phaser.Scene, homeX: number, homeY: number) {
    // じゃくほうらいこうべんの術 - ソイフォンのばんかい風巨大ミサイル
    const { width, height } = scene.scale
    
    // チャージ演出
    const chargeEffect = scene.add.circle(homeX, homeY, 20, 0xffffff, 0.7)
    scene.tweens.add({
      targets: chargeEffect,
      scaleX: 4,
      scaleY: 4,
      alpha: 0.3,
      duration: 1500,
      ease: 'Power2'
    })
    
    // 1.5秒後にミサイル発射
    scene.time.delayedCall(1500, () => {
      chargeEffect.destroy()
      this.launchJakuhouMissile(scene, homeX, homeY, width, height)
    })
  }

  private launchJakuhouMissile(scene: Phaser.Scene, homeX: number, homeY: number, width: number, height: number) {
    // ミサイル本体（巨大な金色の弾頭）
    const missile = scene.add.rectangle(homeX, homeY - 200, 40, 120, 0xFFD700)
    missile.setStrokeStyle(3, 0xffffff)
    
    // ミサイルの先端
    const warhead = scene.add.circle(homeX, homeY - 260, 25, 0xff4444)
    warhead.setStrokeStyle(2, 0xffffff)
    
    // 推進エフェクト
    const thruster = scene.add.circle(homeX, homeY - 140, 15, 0x00ffff, 0.8)
    
    // ロックオン演出
    const targetX = homeX + (Math.random() - 0.5) * 300
    const targetY = homeY + (Math.random() - 0.5) * 200
    
    // ロックオンサークル
    const lockCircle = scene.add.circle(targetX, targetY, this.data.range, 0xff0000, 0)
    lockCircle.setStrokeStyle(4, 0xff0000)
    
    // ロックオン点滅
    scene.tweens.add({
      targets: lockCircle,
      alpha: 0.5,
      duration: 150,
      yoyo: true,
      repeat: 5
    })
    
    // 1秒後にミサイル突撃
    scene.time.delayedCall(1000, () => {
      lockCircle.destroy()
      
      // 高速突撃
      const distance = Phaser.Math.Distance.Between(homeX, targetX, homeY, targetY)
      const angle = Phaser.Math.Angle.Between(homeX, homeY, targetX, targetY)
      
      // ミサイル回転
      missile.setRotation(angle + Math.PI / 2)
      warhead.setRotation(angle)
      
      scene.tweens.add({
        targets: [missile, warhead, thruster],
        x: targetX,
        y: targetY,
        duration: 300,
        ease: 'Power3',
        onComplete: () => {
          this.jakuhouExplosion(scene, targetX, targetY)
          missile.destroy()
          warhead.destroy()
          thruster.destroy()
        }
      })
      
      // 軌跡エフェクト
      this.createMissileTrail(scene, homeX, homeY, targetX, targetY)
    })
  }

  private jakuhouExplosion(scene: Phaser.Scene, x: number, y: number) {
    // 巨大爆発（ソイフォンのばんかい風）
    const mainExplosion = scene.add.circle(x, y, this.data.range, 0xffffff, 0.9)
    
    // 強烈なシェイク（フラッシュなし）
    scene.cameras.main.shake(800, 20)
    
    // 爆発アニメーション
    scene.tweens.add({
      targets: mainExplosion,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => mainExplosion.destroy()
    })
    
    // 複数の衝撃波
    for (let i = 0; i < 3; i++) {
      scene.time.delayedCall(i * 150, () => {
        const shockwave = scene.add.circle(x, y, this.data.range * (0.5 + i * 0.3), 0xff4444, 0.6)
        scene.tweens.add({
          targets: shockwave,
          scaleX: 2 + i,
          scaleY: 2 + i,
          alpha: 0,
          duration: 400,
          onComplete: () => shockwave.destroy()
        })
      })
    }
    
    // ダメージ判定
    scene.events.emit('jakuhou-strike', {
      x: x,
      y: y,
      range: this.data.range,
      damage: this.data.damage
    })
  }

  private createMissileTrail(scene: Phaser.Scene, startX: number, startY: number, endX: number, endY: number) {
    // ミサイルの軌跡
    for (let i = 0; i < 15; i++) {
      scene.time.delayedCall(i * 20, () => {
        const progress = i / 15
        const trailX = startX + (endX - startX) * progress
        const trailY = startY + (endY - startY) * progress
        
        const trail = scene.add.circle(trailX, trailY, 8, 0x00ffff, 0.7)
        scene.tweens.add({
          targets: trail,
          scaleX: 0.2,
          scaleY: 0.2,
          alpha: 0,
          duration: 400,
          onComplete: () => trail.destroy()
        })
      })
    }
  }

  private activateBunshin(scene: Phaser.Scene, homeX: number, homeY: number) {
    // 分身の術 - テニスの王子様の菊丸風に2つの分身（本物含めて3個）
    const { width, height } = scene.scale
    
    // 2つの分身出現位置（家を中心に120度ずつ配置）
    const angle1 = Math.PI * 2 / 3  // 120度
    const angle2 = Math.PI * 4 / 3  // 240度
    const distance = 150
    
    const decoy1X = homeX + Math.cos(angle1) * distance
    const decoy1Y = homeY + Math.sin(angle1) * distance
    const decoy2X = homeX + Math.cos(angle2) * distance
    const decoy2Y = homeY + Math.sin(angle2) * distance
    
    // 忍術発動エフェクト（菊丸風の煙幕）
    const smokeEffect = scene.add.circle(homeX, homeY, 50, 0x888888, 0.8)
    scene.tweens.add({
      targets: smokeEffect,
      scaleX: 4,
      scaleY: 4,
      alpha: 0,
      duration: 600,
      onComplete: () => smokeEffect.destroy()
    })
    
    // 0.6秒後に2つの分身が同時出現
    scene.time.delayedCall(600, () => {
      this.createDecoyFuton(scene, decoy1X, decoy1Y, 1)
      this.createDecoyFuton(scene, decoy2X, decoy2Y, 2)
    })
  }

  private createDecoyFuton(scene: Phaser.Scene, x: number, y: number, decoyNumber: number) {
    // おとりの布団（プレイヤーの家と同じ見た目）
    const decoyFuton = scene.add.rectangle(x, y, 40, 40, 0x666666)
    decoyFuton.setStrokeStyle(2, 0xffffff)
    decoyFuton.setAlpha(0.7) // 分身感を強調
    
    // 出現エフェクト（菊丸風の高速出現）
    decoyFuton.setScale(0)
    decoyFuton.setRotation(Math.PI * 2) // 1回転しながら出現
    
    scene.tweens.add({
      targets: decoyFuton,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      duration: 200,
      ease: 'Back'
    })
    
    // 5秒間敵を誘導
    const duration = this.data.duration! * 1000 // 5秒
    
    // 各分身が個別に誘導効果を発揮
    scene.events.emit('bunshin-decoy-start', {
      x: x,
      y: y,
      range: this.data.range,
      decoyNumber: decoyNumber,
      decoyFuton: decoyFuton
    })
    
    // 脈動エフェクト（分身ごとに微妙に異なるタイミング）
    const pulseEffect = scene.tweens.add({
      targets: decoyFuton,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 700 + decoyNumber * 100, // 分身ごとに微妙に異なる速度
      yoyo: true,
      repeat: -1
    })
    
    // 残像エフェクト（菊丸風）
    const afterImageTimer = scene.time.addEvent({
      delay: 300,
      callback: () => {
        const afterImage = scene.add.rectangle(x, y, 40, 40, 0x666666)
        afterImage.setAlpha(0.3)
        afterImage.setStrokeStyle(1, 0xffffff)
        
        scene.tweens.add({
          targets: afterImage,
          alpha: 0,
          scaleX: 1.2,
          scaleY: 1.2,
          duration: 500,
          onComplete: () => afterImage.destroy()
        })
      },
      loop: true
    })
    
    // 5秒後に分身消失
    scene.time.delayedCall(duration, () => {
      // 消失エフェクト（回転しながら消失）
      const disappearEffect = scene.add.circle(x, y, 20, 0x888888, 0.6)
      scene.tweens.add({
        targets: disappearEffect,
        scaleX: 2,
        scaleY: 2,
        alpha: 0,
        rotation: Math.PI * 2,
        duration: 400,
        onComplete: () => disappearEffect.destroy()
      })
      
      // 分身消失をイベントで通知
      scene.events.emit('bunshin-decoy-end', { decoyNumber: decoyNumber })
      
      pulseEffect.remove()
      afterImageTimer.remove()
      decoyFuton.destroy()
    })
  }
  
  private createSpearHitEffect(scene: Phaser.Scene, x: number, y: number) {
    // サイコクラッシャー風のヒットエフェクト
    const hitEffect = scene.add.circle(x, y, 15, 0xffffff, 0.8)
    scene.tweens.add({
      targets: hitEffect,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 150,
      onComplete: () => hitEffect.destroy()
    })
    
    // 紫の衝撃波
    const shockwave = scene.add.circle(x, y, 10, 0x8800ff, 0.6)
    scene.tweens.add({
      targets: shockwave,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 200,
      onComplete: () => shockwave.destroy()
    })
  }
  
  private createSpearTrailEffect(scene: Phaser.Scene, startX: number, startY: number, angle: number, duration: number) {
    // 強力な軌跡パーティクル
    for (let i = 0; i < 20; i++) {
      scene.time.delayedCall(i * 25, () => {
        const trailX = startX + Math.cos(angle) * (i * 15)
        const trailY = startY + Math.sin(angle) * (i * 15)
        
        const trail = scene.add.circle(trailX, trailY, 8, 0x8800ff, 0.7)
        scene.tweens.add({
          targets: trail,
          scaleX: 0.3,
          scaleY: 0.3,
          alpha: 0,
          duration: 300,
          onComplete: () => trail.destroy()
        })
      })
    }
  }
}