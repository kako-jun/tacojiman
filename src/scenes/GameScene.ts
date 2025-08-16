import Phaser from 'phaser'
import { EnemyManager } from '@/entities/EnemyManager'
import { CameraController } from '@/utils/CameraController'
import { BombJutsu } from '@/entities/BombJutsu'
import { Takokong } from '@/entities/Takokong'
import { BOMB_DATA } from '@/utils/config'
import { BombType } from '@/types'

export class GameScene extends Phaser.Scene {
  private gameTimer!: Phaser.Time.TimerEvent
  private gameTimeRemaining: number = 180
  private currentScore: number = 0
  
  // UI要素
  private timeDisplay!: Phaser.GameObjects.Text
  private scoreDisplay!: Phaser.GameObjects.Text
  private clockDisplay!: Phaser.GameObjects.Text
  private bombStockDisplay!: Phaser.GameObjects.Text
  
  // ゲーム要素
  private playerHouse!: Phaser.GameObjects.Rectangle
  private enemyManager!: EnemyManager
  private cameraController!: CameraController
  private takokong: Takokong | null = null
  
  // ボム忍術システム
  private bombStock: number = 1
  private currentBombType: BombType | null = null
  private lastBombRecharge: number = 0
  
  // 入力制御
  private isLongPress: boolean = false
  private longPressTimer: Phaser.Time.TimerEvent | null = null
  
  // ゲーム状態
  private gameStartMorningTime: string = ''
  private takokongSpawned: boolean = false

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale

    this.generateMorningTime()
    this.createWireframeMap(width, height)
    
    // プレイヤーの家（中央）
    this.playerHouse = this.add.rectangle(width / 2, height / 2, 40, 40, 0x888888)
    this.playerHouse.setStrokeStyle(2, 0xffffff)
    this.playerHouse.setInteractive()
    
    // システム初期化
    this.cameraController = new CameraController(this, width / 2, height / 2)
    this.enemyManager = new EnemyManager(this, width / 2, height / 2, width, height)
    
    this.createUI(width, height)
    this.setupInput()
    this.setupEventListeners()
    this.startGameTimer()
    this.enemyManager.startSpawning()
    this.generateRandomBombType()
  }

  private generateMorningTime() {
    const startHour = Math.floor(Math.random() * 4) + 4
    const startMinute = Math.floor(Math.random() * 60)
    this.gameStartMorningTime = `${startHour}:${startMinute.toString().padStart(2, '0')} AM`
  }

  private createWireframeMap(width: number, height: number) {
    const graphics = this.add.graphics()
    
    graphics.fillStyle(0x004400)
    graphics.fillRect(0, 0, width, height)
    
    const tileSize = 60
    const tilesX = Math.ceil(width / tileSize)
    const tilesY = Math.ceil(height / tileSize)
    
    for (let x = 0; x < tilesX; x++) {
      for (let y = 0; y < tilesY; y++) {
        const terrainType = Math.floor(Math.random() * 4)
        let color: number
        
        switch (terrainType) {
          case 0: color = 0x000088; break
          case 1: color = 0x0088ff; break
          case 2: color = 0x008800; break
          case 3: color = 0x666666; break
          default: color = 0x004400; break
        }
        
        graphics.fillStyle(color, 0.7)
        graphics.fillRect(x * tileSize, y * tileSize, tileSize - 2, tileSize - 2)
        graphics.lineStyle(1, 0xffffff, 0.3)
        graphics.strokeRect(x * tileSize, y * tileSize, tileSize - 2, tileSize - 2)
      }
    }
  }

  private createUI(width: number, height: number) {
    this.clockDisplay = this.add.text(20, 20, this.gameStartMorningTime, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    })
    
    this.timeDisplay = this.add.text(width - 20, 20, `${this.gameTimeRemaining}s`, {
      fontSize: '20px',
      color: '#ffff00',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(1, 0)
    
    this.scoreDisplay = this.add.text(20, height - 80, `Score: ${this.currentScore}`, {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    })

    this.bombStockDisplay = this.add.text(20, height - 50, `Bomb: ${this.bombStock}`, {
      fontSize: '16px',
      color: '#ff8800',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    })
  }

  private setupInput() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isLongPress = false
      
      this.longPressTimer = this.time.delayedCall(300, () => {
        this.isLongPress = true
        this.handleLongPressStart(pointer)
      })
    })
    
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.longPressTimer) {
        this.longPressTimer.remove()
        this.longPressTimer = null
      }
      
      if (this.isLongPress) {
        this.handleLongPressEnd(pointer)
      } else {
        this.handleShortTap(pointer)
      }
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isLongPress && this.cameraController.getIsZoomedIn()) {
        const worldPoint = this.cameraController.getWorldPoint(pointer.x, pointer.y)
        this.cameraController.updateZoomTarget(worldPoint.x, worldPoint.y)
      }
    })
  }

  private setupEventListeners() {
    this.events.on('player-damaged', (damage: number) => {
      this.currentScore = Math.max(0, this.currentScore - damage)
      this.updateScoreDisplay()
    })

    this.events.on('takokong-defeated', () => {
      this.currentScore += 100
      this.updateScoreDisplay()
      // 1秒後にゲーム終了
      this.time.delayedCall(1000, () => this.endGame())
    })

    this.events.on('game-over-takokong-reached', () => {
      // タココングが家に到達 = 強制ゲーム終了
      this.endGame()
    })

    this.events.on('bomb-damage-line', (data: any) => {
      // プロトンビームのライン攻撃
      // 実装予定
    })

    this.events.on('check-mine-trigger', (data: any) => {
      // 地雷の発動チェック
      // 実装予定
    })

    this.events.on('sentry-find-target', (data: any) => {
      // セントリーガンのターゲット検索
      // 実装予定
    })

    this.events.on('muteki-explosion', (data: { x: number; y: number; range: number; damage: number }) => {
      // 無敵ホーダイの術の爆発ダメージ処理
      let totalScore = 0
      
      // 通常敵へのダメージ
      totalScore += this.enemyManager.checkBombHit(data.x, data.y, data.range, data.damage)
      
      // タココングへのダメージ
      if (this.takokong && this.takokong.checkCollision(data.x, data.y, data.range)) {
        const bossResult = this.takokong.takeDamage(data.damage)
        if (bossResult.score > 0) {
          totalScore += bossResult.score
        }
      }
      
      this.currentScore += totalScore
      this.updateScoreDisplay()
    })

    this.events.on('sol-strike', (data: { x: number; y: number; range: number; damage: number }) => {
      // SOLの術の超広範囲攻撃
      let totalScore = 0
      
      // 通常敵へのダメージ
      totalScore += this.enemyManager.checkBombHit(data.x, data.y, data.range, data.damage)
      
      // タココングへのダメージ
      if (this.takokong && this.takokong.checkCollision(data.x, data.y, data.range)) {
        const bossResult = this.takokong.takeDamage(data.damage)
        if (bossResult.score > 0) {
          totalScore += bossResult.score
        }
      }
      
      this.currentScore += totalScore
      this.updateScoreDisplay()
    })

    this.events.on('dainsleif-multihit', (data: { x: number; y: number; width: number; damage: number; hitTargets: Set<any>; step: number }) => {
      // ダインスレイブの術の多段ヒット攻撃（サイコクラッシャー風）
      let stepScore = 0
      
      // 通常敵への多段ヒット
      const enemiesInRange = this.enemyManager.getEnemiesInArea(data.x, data.y, data.width)
      enemiesInRange.forEach(enemy => {
        if (!data.hitTargets.has(enemy)) {
          // 初回ヒット
          data.hitTargets.add(enemy)
          const result = enemy.takeDamage(data.damage)
          stepScore += result.score
          
          // 多段ヒットエフェクト
          this.showMultiHitEffect(enemy.x, enemy.y, data.step)
        } else {
          // 2回目以降のヒット（追加ダメージ）
          const result = enemy.takeDamage(1) // 小ダメージで多段ヒット
          stepScore += result.score
          
          // 連続ヒットエフェクト
          this.showContinuousHitEffect(enemy.x, enemy.y, data.step)
        }
      })
      
      // タココングへの多段ヒット
      if (this.takokong && this.takokong.checkCollision(data.x, data.y, data.width)) {
        if (!data.hitTargets.has(this.takokong)) {
          // 初回ヒット
          data.hitTargets.add(this.takokong)
          const bossResult = this.takokong.takeDamage(data.damage)
          stepScore += bossResult.score
          
          this.showMultiHitEffect(this.takokong.x, this.takokong.y, data.step)
        } else {
          // 2回目以降のヒット
          const bossResult = this.takokong.takeDamage(2) // ボスには多めのダメージ
          stepScore += bossResult.score
          
          this.showContinuousHitEffect(this.takokong.x, this.takokong.y, data.step)
        }
      }
      
      this.currentScore += stepScore
      this.updateScoreDisplay()
    })

    this.events.on('dainsleif-final-check', (data: { hitTargets: Set<any> }) => {
      // 最終的にどの敵にもヒットしなかった場合
      if (data.hitTargets.size === 0) {
        this.showMissedEffect()
      } else {
        // ヒット数に応じたボーナス表示
        this.showMultiHitBonus(data.hitTargets.size)
      }
    })

    this.events.on('jakuhou-strike', (data: { x: number; y: number; range: number; damage: number }) => {
      // じゃくほうらいこうべんの術の巨大ミサイル攻撃
      let totalScore = 0
      
      // 通常敵へのダメージ
      totalScore += this.enemyManager.checkBombHit(data.x, data.y, data.range, data.damage)
      
      // タココングへのダメージ
      if (this.takokong && this.takokong.checkCollision(data.x, data.y, data.range)) {
        const bossResult = this.takokong.takeDamage(data.damage)
        if (bossResult.score > 0) {
          totalScore += bossResult.score
        }
      }
      
      this.currentScore += totalScore
      this.updateScoreDisplay()
    })

    // 菊丸風分身システムの管理
    let activeDecoys = new Set<number>()
    
    this.events.on('bunshin-decoy-start', (data: { x: number; y: number; range: number; decoyNumber: number; decoyFuton: any }) => {
      // 各分身が個別に敵を誘導
      activeDecoys.add(data.decoyNumber)
      this.enemyManager.addDecoyTarget(data.x, data.y, data.range, data.decoyNumber)
      
      if (this.takokong) {
        console.log(`タココングが分身${data.decoyNumber}に誘導されました`)
      }
      
      console.log(`分身${data.decoyNumber}が出現（アクティブ: ${Array.from(activeDecoys).join(', ')}）`)
    })

    this.events.on('bunshin-decoy-end', (data: { decoyNumber: number }) => {
      // 個別分身の消失
      activeDecoys.delete(data.decoyNumber)
      this.enemyManager.removeDecoyTarget(data.decoyNumber)
      
      console.log(`分身${data.decoyNumber}が消失（残り: ${Array.from(activeDecoys).join(', ')}）`)
      
      // すべての分身が消失したら元の標的に戻す
      if (activeDecoys.size === 0) {
        this.enemyManager.clearAllDecoyTargets()
        console.log('すべての分身が消失、敵が元の標的に戻りました')
      }
    })
  }

  private handleShortTap(pointer: Phaser.Input.Pointer) {
    const worldPoint = this.cameraController.getWorldPoint(pointer.x, pointer.y)
    
    if (this.checkHouseClick(worldPoint.x, worldPoint.y)) {
      this.activateBombJutsu()
    } else {
      this.performBeeAttack(worldPoint.x, worldPoint.y)
    }
  }

  private handleLongPressStart(pointer: Phaser.Input.Pointer) {
    const worldPoint = this.cameraController.getWorldPoint(pointer.x, pointer.y)
    this.cameraController.startZoomIn(worldPoint.x, worldPoint.y, 2.5)
  }

  private handleLongPressEnd(pointer: Phaser.Input.Pointer) {
    if (this.cameraController.getIsZoomedIn()) {
      // ズーム中の連続攻撃
      const worldPoint = this.cameraController.getWorldPoint(pointer.x, pointer.y)
      this.performContinuousAttack(worldPoint.x, worldPoint.y)
    }
    this.cameraController.zoomOut()
  }

  private checkHouseClick(x: number, y: number): boolean {
    const distance = Phaser.Math.Distance.Between(x, y, this.playerHouse.x, this.playerHouse.y)
    return distance < 30
  }

  private performBeeAttack(x: number, y: number) {
    let hit = false
    
    // 通常敵への攻撃
    const attackResult = this.enemyManager.checkAttackHit(x, y, 15)
    if (attackResult.hit) {
      this.currentScore += attackResult.score
      hit = true
    }
    
    // タココングへの攻撃
    if (this.takokong && this.takokong.checkCollision(x, y, 40)) {
      const bossResult = this.takokong.takeDamage(1)
      if (bossResult.score > 0) {
        this.currentScore += bossResult.score
      }
      hit = true
    }
    
    this.updateScoreDisplay()
    this.showAttackEffect(x, y, hit)
  }

  private performContinuousAttack(x: number, y: number) {
    // 連続攻撃（範囲内の全ての敵に攻撃）
    const totalScore = this.enemyManager.checkBombHit(x, y, 30, 1)
    this.currentScore += totalScore
    this.updateScoreDisplay()
    this.showBombEffect(x, y, 30)
  }

  private activateBombJutsu() {
    if (this.bombStock <= 0 || !this.currentBombType) return

    this.bombStock--
    this.updateBombDisplay()

    const bombData = BOMB_DATA.find(data => data.type === this.currentBombType)
    if (bombData) {
      const bomb = new BombJutsu(this.currentBombType, bombData)
      bomb.activate(this, this.playerHouse.x, this.playerHouse.y)
    }
  }

  private generateRandomBombType() {
    const bombTypes: BombType[] = ['proton', 'muddy', 'sentry', 'muteki', 'sol', 'dainsleif', 'jakuhou', 'bunshin']
    this.currentBombType = bombTypes[Math.floor(Math.random() * bombTypes.length)]
  }

  private showMissedEffect() {
    // ダインスレイブが外した時の「完全に無駄」演出
    const { width, height } = this.scale
    
    const missText = this.add.text(width / 2, height / 2, 'MISS!', {
      fontSize: '48px',
      color: '#ff0000',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5)
    
    const wasteText = this.add.text(width / 2, height / 2 + 60, '完全に無駄!', {
      fontSize: '24px',
      color: '#ff4444',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5)
    
    // テキストアニメーション
    this.tweens.add({
      targets: [missText, wasteText],
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => {
        missText.destroy()
        wasteText.destroy()
      }
    })
  }

  private showMultiHitEffect(x: number, y: number, step: number) {
    // サイコクラッシャー風の多段ヒットエフェクト
    const hitEffect = this.add.circle(x, y, 12, 0xffffff, 0.9)
    
    // ヒット回数に応じたエフェクトの変化
    const color = step <= 3 ? 0xffffff : (step <= 6 ? 0xffff00 : 0xff0000)
    hitEffect.setFillStyle(color)
    
    this.tweens.add({
      targets: hitEffect,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 200,
      onComplete: () => hitEffect.destroy()
    })
    
    // ヒット数表示
    const hitText = this.add.text(x, y - 20, `${step}HIT!`, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(0.5)
    
    this.tweens.add({
      targets: hitText,
      y: y - 40,
      alpha: 0,
      duration: 400,
      onComplete: () => hitText.destroy()
    })
  }

  private showContinuousHitEffect(x: number, y: number, step: number) {
    // 連続ヒット時の軽いエフェクト
    const continuousEffect = this.add.circle(x, y, 8, 0x8800ff, 0.7)
    
    this.tweens.add({
      targets: continuousEffect,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 0,
      duration: 150,
      onComplete: () => continuousEffect.destroy()
    })
  }

  private showMultiHitBonus(hitCount: number) {
    // 多段ヒット数に応じたボーナス表示
    const { width, height } = this.scale
    
    let bonusText = ''
    let bonusColor = '#ffffff'
    
    if (hitCount >= 10) {
      bonusText = 'PERFECT PIERCE!'
      bonusColor = '#ff0000'
    } else if (hitCount >= 5) {
      bonusText = 'MULTI HIT!'
      bonusColor = '#ffff00'
    } else {
      bonusText = `${hitCount} HIT`
      bonusColor = '#ffffff'
    }
    
    const bonusDisplay = this.add.text(width / 2, height / 2 - 50, bonusText, {
      fontSize: '32px',
      color: bonusColor,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5)
    
    this.tweens.add({
      targets: bonusDisplay,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => bonusDisplay.destroy()
    })
  }

  private showAttackEffect(x: number, y: number, hit: boolean) {
    const color = hit ? 0xffff00 : 0x888888
    const effect = this.add.circle(x, y, 10, color, 0.8)
    
    this.tweens.add({
      targets: effect,
      scaleX: hit ? 2 : 1.5,
      scaleY: hit ? 2 : 1.5,
      alpha: 0,
      duration: 300,
      onComplete: () => effect.destroy()
    })
  }

  private showBombEffect(x: number, y: number, radius: number) {
    const effect = this.add.circle(x, y, radius, 0xff4444, 0.6)
    
    this.tweens.add({
      targets: effect,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 500,
      onComplete: () => effect.destroy()
    })
  }

  private startGameTimer() {
    this.gameTimer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.gameTimeRemaining--
        this.timeDisplay.setText(`${this.gameTimeRemaining}s`)
        
        // ボム自動回復（1分、2分時点）
        if ((this.gameTimeRemaining === 120 || this.gameTimeRemaining === 60) && this.bombStock === 0) {
          this.bombStock = 1
          this.generateRandomBombType()
          this.updateBombDisplay()
        }
        
        // タココング出現
        if (this.gameTimeRemaining === 10 && !this.takokongSpawned) {
          this.spawnTakokong()
        }
        
        if (this.gameTimeRemaining <= 0) {
          this.endGame()
        }
      },
      loop: true
    })
  }

  private spawnTakokong() {
    this.takokongSpawned = true
    this.enemyManager.stopSpawning()
    
    // タココング生成
    const { width, height } = this.scale
    this.takokong = new Takokong(
      this, 
      width / 2, 
      -100, // 画面上から登場
      this.playerHouse.x, 
      this.playerHouse.y
    )
    
    console.log('👑 タココング戦開始!')
  }

  private updateScoreDisplay() {
    this.scoreDisplay.setText(`Score: ${this.currentScore}`)
  }

  private updateBombDisplay() {
    const bombName = this.currentBombType ? 
      BOMB_DATA.find(data => data.type === this.currentBombType)?.name || 'Unknown' : 
      'None'
    this.bombStockDisplay.setText(`Bomb: ${this.bombStock} (${bombName})`)
  }

  private endGame() {
    this.gameTimer.remove()
    this.enemyManager.destroy()
    this.cameraController.destroy()
    
    if (this.takokong) {
      this.takokong.destroy()
    }
    
    this.scene.start('EndingScene', { 
      score: this.currentScore,
      timeSpent: 180 - this.gameTimeRemaining
    })
  }

  update() {
    // ゲームループ処理
  }
}