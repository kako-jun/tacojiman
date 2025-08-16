import Phaser from 'phaser'

export class GameScene extends Phaser.Scene {
  private gameTimer!: Phaser.Time.TimerEvent
  private gameTimeRemaining: number = 180 // 3分 = 180秒
  private gameStartTime: number = 0
  private currentScore: number = 0
  
  // UI要素
  private timeDisplay!: Phaser.GameObjects.Text
  private scoreDisplay!: Phaser.GameObjects.Text
  private clockDisplay!: Phaser.GameObjects.Text
  
  // ゲーム要素
  private playerHouse!: Phaser.GameObjects.Rectangle
  private enemies: Phaser.GameObjects.Group[] = []
  private effects!: Phaser.GameObjects.Group
  
  // カメラ制御
  private isZoomedIn: boolean = false
  private zoomTarget: { x: number; y: number } | null = null
  
  // ゲーム状態
  private gameStartMorningTime: string = ''

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale

    // 早朝時刻をランダムで決定（4:00-8:00）
    this.generateMorningTime()
    
    // 背景作成（仮のワイヤーフレーム）
    this.createWireframeMap(width, height)
    
    // プレイヤーの家（中央）
    this.playerHouse = this.add.rectangle(width / 2, height / 2, 40, 40, 0x888888)
    this.playerHouse.setStrokeStyle(2, 0xffffff)
    this.playerHouse.setInteractive()
    
    // UI作成
    this.createUI(width, height)
    
    // エフェクトグループ
    this.effects = this.add.group()
    
    // 敵グループ初期化
    for (let i = 0; i < 4; i++) {
      this.enemies[i] = this.add.group()
    }
    
    // 入力システム
    this.setupInput()
    
    // ゲームタイマー開始
    this.startGameTimer()
    
    // 敵生成ループ
    this.startEnemySpawning()
  }

  private generateMorningTime() {
    const startHour = Math.floor(Math.random() * 4) + 4 // 4-7時
    const startMinute = Math.floor(Math.random() * 60) // 0-59分
    this.gameStartMorningTime = `${startHour}:${startMinute.toString().padStart(2, '0')} AM`
  }

  private createWireframeMap(width: number, height: number) {
    const graphics = this.add.graphics()
    
    // 背景基調色
    graphics.fillStyle(0x004400) // 暗緑（田園風景）
    graphics.fillRect(0, 0, width, height)
    
    // 地形マスをランダム配置（ワイヤーフレーム）
    const tileSize = 60
    const tilesX = Math.ceil(width / tileSize)
    const tilesY = Math.ceil(height / tileSize)
    
    for (let x = 0; x < tilesX; x++) {
      for (let y = 0; y < tilesY; y++) {
        const terrainType = Math.floor(Math.random() * 4)
        let color: number
        
        switch (terrainType) {
          case 0: color = 0x000088; break // 海
          case 1: color = 0x0088ff; break // 川
          case 2: color = 0x008800; break // 田んぼ
          case 3: color = 0x666666; break // 道路
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
    // 時刻表示（左上）
    this.clockDisplay = this.add.text(20, 20, this.gameStartMorningTime, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    })
    
    // 残り時間表示（右上）
    this.timeDisplay = this.add.text(width - 20, 20, `${this.gameTimeRemaining}s`, {
      fontSize: '20px',
      color: '#ffff00',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(1, 0)
    
    // スコア表示（左下）
    this.scoreDisplay = this.add.text(20, height - 60, `Score: ${this.currentScore}`, {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    })
  }

  private setupInput() {
    // タップ/クリック入力
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer)
    })
    
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerUp(pointer)
    })
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    const { worldX, worldY } = pointer
    
    // プレイヤーの家をタップした場合（ボム発動）
    if (this.checkHouseClick(worldX, worldY)) {
      this.activateBombJutsu()
      return
    }
    
    // 通常攻撃
    this.performBeeAttack(worldX, worldY)
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer) {
    // 長押し終了時の処理（ズームアウト）
    if (this.isZoomedIn) {
      this.zoomOut()
    }
  }

  private checkHouseClick(x: number, y: number): boolean {
    const houseX = this.playerHouse.x
    const houseY = this.playerHouse.y
    const distance = Phaser.Math.Distance.Between(x, y, houseX, houseY)
    return distance < 30
  }

  private performBeeAttack(x: number, y: number) {
    // 蜂忍術エフェクト
    const attackEffect = this.add.circle(x, y, 10, 0xffff00, 0.8)
    this.effects.add(attackEffect)
    
    // エフェクトの消去
    this.tweens.add({
      targets: attackEffect,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        attackEffect.destroy()
      }
    })
    
    // 敵の当たり判定（後で実装）
    console.log(`🐝 蜂忍術発動: (${x}, ${y})`)
  }

  private activateBombJutsu() {
    // ボム忍術エフェクト
    const bombEffect = this.add.circle(this.playerHouse.x, this.playerHouse.y, 50, 0xff0000, 0.6)
    this.effects.add(bombEffect)
    
    this.tweens.add({
      targets: bombEffect,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        bombEffect.destroy()
      }
    })
    
    console.log('💣 ボム忍術発動!')
  }

  private zoomOut() {
    this.cameras.main.zoomTo(1, 500)
    this.isZoomedIn = false
    this.zoomTarget = null
  }

  private startGameTimer() {
    this.gameTimer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.gameTimeRemaining--
        this.timeDisplay.setText(`${this.gameTimeRemaining}s`)
        
        // タココング出現（残り10秒）
        if (this.gameTimeRemaining === 10) {
          this.spawnTakokong()
        }
        
        // ゲーム終了
        if (this.gameTimeRemaining <= 0) {
          this.endGame()
        }
      },
      loop: true
    })
  }

  private startEnemySpawning() {
    // 仮の敵生成（1秒ごと）
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (this.gameTimeRemaining > 10) { // タココング前のみ
          this.spawnRandomEnemy()
        }
      },
      loop: true
    })
  }

  private spawnRandomEnemy() {
    const { width, height } = this.scale
    const enemyType = Math.floor(Math.random() * 4)
    const enemySize = 20
    
    let x, y, color
    
    switch (enemyType) {
      case 0: // 道路歩行型
        x = 0
        y = Math.random() * height
        color = 0xff4444
        break
      case 1: // 海上遡上型
        x = Math.random() * width
        y = 0
        color = 0x4444ff
        break
      case 2: // 空挺降下型
        x = Math.random() * width
        y = -enemySize
        color = 0xffff44
        break
      case 3: // 地下掘削型
        x = Math.random() * width
        y = Math.random() * height
        color = 0x884444
        break
      default:
        x = 0
        y = 0
        color = 0xff4444
    }
    
    const enemy = this.add.rectangle(x, y, enemySize, enemySize, color)
    enemy.setStrokeStyle(1, 0xffffff)
    this.enemies[enemyType].add(enemy)
    
    // 敵の移動（プレイヤーの家に向かう）
    this.tweens.add({
      targets: enemy,
      x: this.playerHouse.x,
      y: this.playerHouse.y,
      duration: 5000,
      onComplete: () => {
        // 家に到達したらスコア減点
        this.currentScore = Math.max(0, this.currentScore - 10)
        this.scoreDisplay.setText(`Score: ${this.currentScore}`)
        enemy.destroy()
      }
    })
  }

  private spawnTakokong() {
    const { width, height } = this.scale
    
    // タココング（巨大ボス）
    const takokong = this.add.rectangle(width / 2, -100, 80, 80, 0x440044)
    takokong.setStrokeStyle(3, 0xffffff)
    takokong.setData('hp', 42)
    takokong.setData('isBoss', true)
    
    // 登場演出
    this.tweens.add({
      targets: takokong,
      y: height / 2,
      duration: 2000,
      onComplete: () => {
        // ボス戦開始
        console.log('⚔️ タココング戦開始!')
      }
    })
    
    console.log('👑 タココング出現!')
  }

  private endGame() {
    this.gameTimer.remove()
    
    // エンディングシーンへ
    this.scene.start('EndingScene', { 
      score: this.currentScore,
      timeSpent: 180 - this.gameTimeRemaining
    })
  }

  update() {
    // ゲームループ処理（敵の移動など）
  }
}