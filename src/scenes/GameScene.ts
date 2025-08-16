import Phaser from 'phaser'
import { EnemyManager } from '@/entities/EnemyManager'
import { CameraController } from '@/utils/CameraController'
import { BombJutsu } from '@/entities/BombJutsu'
import { Takokong } from '@/entities/Takokong'
import { BOMB_DATA } from '@/utils/config'
import { BombType } from '@/types'
import { MapGenerator } from '@/utils/MapGenerator'
import { MapPanel, PANEL_CONFIG } from '@/types/MapTypes'

export class GameScene extends Phaser.Scene {
  private gameTimer!: Phaser.Time.TimerEvent
  private clockTimer!: Phaser.Time.TimerEvent
  private gameTimeRemaining: number = 180
  private currentScore: number = 0
  private gameStartTime: number = 0
  
  // UI要素（UISceneで管理）
  private uiScene!: Phaser.Scene
  
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
  
  // スクリーンショット管理
  private screenshots: string[] = []
  private screenshotTimer: Phaser.Time.TimerEvent | null = null
  
  // マップ関連
  private mapPanels: MapPanel[][] = []
  private otherHousePositions: { x: number; y: number }[] = []
  private stationPositions: { x: number; y: number }[] = []

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale

    this.generateMorningTime()
    this.createWireframeMap(width, height)
    
    // プレイヤーの家は自宅パネルとして表示されるため、大きな四角は不要
    // 家の位置は画面中央（width/2, height/2）として扱う
    this.playerHouse = this.add.rectangle(width / 2, height / 2, 1, 1, 0x000000, 0) // 透明な当たり判定用
    this.playerHouse.setInteractive()
    this.playerHouse.setDepth(50)
    
    // システム初期化
    this.cameraController = new CameraController(this, width / 2, height / 2)
    this.enemyManager = new EnemyManager(this, width / 2, height / 2, width, height, this.mapPanels)
    
    this.generateRandomBombType() // 最初にボムタイプを生成
    this.startUIScene() // UIシーンを開始
    this.setupInput()
    this.setupEventListeners()
    this.gameStartTime = this.time.now // ゲーム開始時刻を記録
    
    // UIシーンが完全に初期化されるまで少し待ってからUI更新
    this.time.delayedCall(100, () => {
      this.updateMorningTime() // 初期表示で時刻を更新
      this.updateBombDisplay() // 初期表示でボム名を更新
    })
    this.startGameTimer()
    this.startClockTimer() // 時刻用の高頻度タイマー開始
    this.startScreenshotTimer() // スクリーンショット撮影タイマー開始
    this.enemyManager.startSpawning()
  }

  private generateMorningTime() {
    // 7時固定
    this.gameStartMorningTime = `7:00:00 AM`
  }

  private updateMorningTime() {
    // 開始時刻から計算
    const startTimeMatch = this.gameStartMorningTime.match(/(\d+):(\d+):(\d+) AM/)
    if (!startTimeMatch) return
    
    const startHour = parseInt(startTimeMatch[1])
    
    // 現在時刻からの経過ミリ秒
    const elapsedMs = this.time.now - this.gameStartTime
    
    // ゲーム内経過時間（30分を3分で進行）
    const elapsedGameMinutes = (elapsedMs / 180000) * 30 // 180000ms = 3分
    
    // 現在の時刻計算
    const currentHour = startHour
    const currentMinute = Math.floor(elapsedGameMinutes)
    
    // 秒は10倍速で進行（100msごとに1秒進む）
    const totalTenthSeconds = Math.floor(elapsedMs / 100) // 100msごとのカウント
    const currentSecond = totalTenthSeconds % 60
    
    const clockText = `${currentHour}:${currentMinute.toString().padStart(2, '0')}:${currentSecond.toString().padStart(2, '0')} AM`
    if (this.uiScene) {
      (this.uiScene as any).updateClock(clockText)
    }
  }

  private createWireframeMap(width: number, height: number) {
    // 背景マップ用のコンテナ（回転用）
    const mapContainer = this.add.container(width / 2, height / 2)
    mapContainer.setDepth(0) // 最背面に設定
    
    // 正方形ベースのマップサイズ（回転時に余白が見えないよう少し大きめ）
    const baseSize = Math.max(width, height) // 縦横の大きい方を基準
    const mapSize = baseSize * 1.4 // 正方形を1.4倍に拡大して回転対応
    const graphics = this.add.graphics()
    
    // 背景色
    graphics.fillStyle(0x004400)
    graphics.fillRect(-mapSize / 2, -mapSize / 2, mapSize, mapSize)
    
    // マップ生成
    const tileSize = 30 // パネルサイズを半分に縮小
    const mapGenerator = new MapGenerator(mapSize, mapSize, tileSize)
    this.mapPanels = mapGenerator.generateMap()
    
    // 他人の家と駅の位置を記録
    this.otherHousePositions = []
    this.stationPositions = []
    
    // 中央タイルの位置を計算
    const centerTileX = Math.floor(this.mapPanels.length / 2)
    const centerTileY = Math.floor(this.mapPanels[0].length / 2)
    
    // タイル描画
    for (let x = 0; x < this.mapPanels.length; x++) {
      for (let y = 0; y < this.mapPanels[0].length; y++) {
        const panel = this.mapPanels[x][y]
        if (!panel) continue
        
        // 自宅パネル（中央）が画面中央に来るよう位置調整
        // パネルの中心が画面中央に来るよう、微調整
        const tileX = (x - centerTileX) * tileSize - tileSize / 2 + 1
        const tileY = (y - centerTileY) * tileSize - tileSize / 2
        
        // パネルタイプに応じた色を取得
        const config = PANEL_CONFIG[panel.type]
        const color = config.color
        const alpha = config.alpha
        
        // パネル描画
        graphics.fillStyle(color, alpha)
        graphics.fillRect(tileX, tileY, tileSize - 1, tileSize - 1)
        
        // 枠線
        if (panel.type === 'player_house') {
          // 自分の家は強調
          graphics.lineStyle(2, 0xffffff, 0.8)
        } else if (panel.type === 'other_house') {
          // 他人の家も少し強調、位置を記録
          graphics.lineStyle(2, 0xffaa00, 0.5)
          this.otherHousePositions.push({
            x: width / 2 + tileX + tileSize / 2,
            y: height / 2 + tileY + tileSize / 2
          })
        } else if (panel.type === 'station') {
          // 駅も攻撃無効エリア、位置を記録
          graphics.lineStyle(2, 0xcccccc, 0.5)
          this.stationPositions.push({
            x: width / 2 + tileX + tileSize / 2,
            y: height / 2 + tileY + tileSize / 2
          })
        } else {
          graphics.lineStyle(1, 0xffffff, 0.3)
        }
        graphics.strokeRect(tileX, tileY, tileSize - 1, tileSize - 1)
        
        // 接続の描画（あぜ道と線路のみ）
        if (panel.type === 'path' || panel.type === 'rail') {
          this.drawConnections(graphics, tileX, tileY, tileSize, panel.connections, panel.type)
        }
      }
    }
    
    mapContainer.add(graphics)
    
    // ゆっくりとした背景回転を開始
    const rotationDirection = Math.random() > 0.5 ? 1 : -1
    
    this.tweens.add({
      targets: mapContainer,
      rotation: rotationDirection * Math.PI * 2,
      duration: 120000 + Math.random() * 60000, // 2〜3分で1回転（ゆっくり）
      repeat: -1,
      ease: 'None'
    })
  }

  private drawConnections(graphics: Phaser.GameObjects.Graphics, tileX: number, tileY: number, tileSize: number, connections: any, type: string) {
    const centerX = tileX + tileSize / 2
    const centerY = tileY + tileSize / 2
    const roadWidth = type === 'rail' ? 6 : 8
    const roadColor = type === 'rail' ? 0x666666 : 0xaa8844
    
    graphics.lineStyle(roadWidth, roadColor, 0.8)
    
    // 接続線の描画
    if (connections.north) {
      graphics.lineBetween(centerX, centerY, centerX, tileY)
    }
    if (connections.south) {
      graphics.lineBetween(centerX, centerY, centerX, tileY + tileSize)
    }
    if (connections.east) {
      graphics.lineBetween(centerX, centerY, tileX + tileSize, centerY)
    }
    if (connections.west) {
      graphics.lineBetween(centerX, centerY, tileX, centerY)
    }
    
    // 中心の交差点
    if (connections.north || connections.south || connections.east || connections.west) {
      graphics.fillStyle(roadColor, 0.8)
      graphics.fillCircle(centerX, centerY, roadWidth / 2)
    }
  }

  private startUIScene() {
    // UIシーンを並行起動
    this.scene.launch('UIScene')
    this.uiScene = this.scene.get('UIScene')
  }

  private setupInput() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // ズームアウト中でもタップを許可（ズームインを再開）
      
      this.isLongPress = false
      
      // タップした位置の攻撃範囲内に敵がいるかチェック（ダメージを与えない）
      const worldPoint = this.cameraController.getWorldPoint(pointer.x, pointer.y)
      const enemyAtPosition = this.enemyManager.getEnemyAtPosition(worldPoint.x, worldPoint.y)
      const takokongHit = this.takokong && this.takokong.checkCollision(worldPoint.x, worldPoint.y, 60)
      const houseHit = this.checkHouseClick(worldPoint.x, worldPoint.y)
      
      // 攻撃が当たる範囲内に敵がいる場合、または家をクリックした場合はズームを開始しない
      if (!enemyAtPosition && !takokongHit && !houseHit) {
        // タップ開始と同時にズーム開始
        this.cameraController.startZoomIn(worldPoint.x, worldPoint.y, 3.0)
      }
      
      this.longPressTimer = this.time.delayedCall(300, () => {
        this.isLongPress = true
        // 300ms後はズームが既に開始されているので何もしない
      })
    })
    
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.longPressTimer) {
        this.longPressTimer.remove()
        this.longPressTimer = null
      }
      
      // ズームしている場合のみズームアウト開始
      if (this.cameraController.getIsZoomedIn()) {
        this.cameraController.zoomOut()
      }
      
      if (this.isLongPress) {
        this.handleLongPressEnd(pointer)
      } else {
        this.handleShortTap(pointer)
      }
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // ズーム中のドラッグは無視（最初にタップした位置のみが重要）
    })
    
  }

  private setupEventListeners() {
    this.events.on('player-damaged', (damage: number) => {
      this.currentScore = Math.max(0, this.currentScore - damage)
      this.updateScoreDisplay()
      
      // 家の位置にマイナススコアを表示
      this.showScoreLossEffect(this.playerHouse.x, this.playerHouse.y, damage)
    })

    this.events.on('takokong-defeated', () => {
      this.currentScore += 100
      this.updateScoreDisplay()
      // 1秒後にゲーム終了
      this.time.delayedCall(1000, () => this.endGame())
    })

    // タココング到達時のゲームオーバーは削除（スコア減算のみ）

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
      const zoomMultiplier = this.cameraController.getCurrentZoom()
      
      // 通常敵へのダメージ
      totalScore += this.enemyManager.checkBombHit(data.x, data.y, data.range, data.damage, zoomMultiplier)
      
      // タココングへのダメージ
      if (this.takokong && this.takokong.checkCollision(data.x, data.y, data.range)) {
        const bossResult = this.takokong.takeDamage(data.damage, zoomMultiplier)
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
      const zoomMultiplier = this.cameraController.getCurrentZoom()
      
      // 通常敵へのダメージ
      totalScore += this.enemyManager.checkBombHit(data.x, data.y, data.range, data.damage, zoomMultiplier)
      
      // タココングへのダメージ
      if (this.takokong && this.takokong.checkCollision(data.x, data.y, data.range)) {
        const bossResult = this.takokong.takeDamage(data.damage, zoomMultiplier)
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

    this.events.on('show-score-gain', (data: { x: number; y: number; baseScore: number; zoomMultiplier: number }) => {
      // ボム攻撃などで複数敵を同時撃破した時の個別スコア表示
      this.showScoreGainEffect(data.x, data.y, data.baseScore, data.zoomMultiplier)
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
    // ズームは既にpointerdownで開始されているので何もしない
  }

  private handleLongPressEnd(pointer: Phaser.Input.Pointer) {
    // ズーム中断タップ：ズームアウト + その位置で攻撃
    const worldPoint = this.cameraController.getWorldPoint(pointer.x, pointer.y)
    
    if (this.checkHouseClick(worldPoint.x, worldPoint.y)) {
      this.activateBombJutsu()
    } else {
      this.performBeeAttack(worldPoint.x, worldPoint.y)
    }
  }

  private checkHouseClick(x: number, y: number): boolean {
    const distance = Phaser.Math.Distance.Between(x, y, this.playerHouse.x, this.playerHouse.y)
    return distance < 30
  }
  
  private isInOtherHouse(x: number, y: number): boolean {
    // 他人の家パネル（30x30）の範囲内かチェック
    for (const house of this.otherHousePositions) {
      if (Math.abs(x - house.x) < 15 && Math.abs(y - house.y) < 15) {
        return true
      }
    }
    return false
  }
  
  private isInStation(x: number, y: number): boolean {
    // 駅パネル（30x30）の範囲内かチェック
    for (const station of this.stationPositions) {
      if (Math.abs(x - station.x) < 15 && Math.abs(y - station.y) < 15) {
        return true
      }
    }
    return false
  }
  
  private isInInvulnerableArea(x: number, y: number): boolean {
    // 他人の家または駅の範囲内かチェック
    return this.isInOtherHouse(x, y) || this.isInStation(x, y)
  }

  private performBeeAttack(x: number, y: number) {
    // 他人の家または駅パネル内への攻撃は無効
    if (this.isInInvulnerableArea(x, y)) {
      // エフェクトも表示しない
      return
    }
    
    let hit = false
    
    // ズーム倍率を取得（1倍〜3倍）
    const zoomMultiplier = this.cameraController.getCurrentZoom()
    
    // 通常敵への攻撃（攻撃範囲を80ピクセルに拡大 - 指が隠れる範囲）
    // ただし、無敵エリア内の敵は除外
    const attackResult = this.enemyManager.checkAttackHit(x, y, 80, (enemy) => {
      return !this.isInInvulnerableArea(enemy.x, enemy.y)
    }, zoomMultiplier)
    if (attackResult.hit) {
      this.currentScore += attackResult.score
      hit = true
      
      // スコア表示は EnemyManager の checkAttackHit 内で個別に発生済み
      // ここでは重複表示を避けるため削除
    }
    
    // タココングへの攻撃（無敵エリア内でなければ）
    if (this.takokong && this.takokong.checkCollision(x, y, 40) && !this.isInInvulnerableArea(this.takokong.x, this.takokong.y)) {
      const bossResult = this.takokong.takeDamage(1, zoomMultiplier)
      if (bossResult.score > 0) {
        this.currentScore += bossResult.score
        
        // タココング撃破時のスコア表示（基本点10 x ズーム倍率）
        this.showScoreGainEffect(this.takokong.x, this.takokong.y, 10, zoomMultiplier)
      }
      hit = true
    }
    
    this.updateScoreDisplay()
    this.showAttackEffect(x, y, hit)
  }

  private activateBombJutsu() {
    if (this.bombStock <= 0 || !this.currentBombType) return

    const bombData = BOMB_DATA.find(data => data.type === this.currentBombType)
    if (bombData) {
      const bomb = new BombJutsu(this.currentBombType, bombData)
      bomb.activate(this, this.playerHouse.x, this.playerHouse.y)
    }

    this.bombStock--
    this.updateBombDisplay()
  }

  private generateRandomBombType() {
    const bombTypes: BombType[] = ['proton', 'muddy', 'sentry', 'muteki', 'sol', 'dainsleif', 'jakuhou', 'bunshin']
    this.currentBombType = bombTypes[Math.floor(Math.random() * bombTypes.length)]
    console.log(`新しいボム生成: ${this.currentBombType}, ストック: ${this.bombStock}`)
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
    // 攻撃判定80ピクセル半径に正確に合わせる：Phaserのadd.circleは半径指定なので40
    const effect = this.add.circle(x, y, 40, color, 0.5)
    
    this.tweens.add({
      targets: effect,
      alpha: 0,
      duration: 300,
      onComplete: () => effect.destroy()
    })
  }

  private showZoomBonusEffect(x: number, y: number, zoomMultiplier: number) {
    // ズーム倍率に応じたボーナス表示
    const bonusText = `x${zoomMultiplier.toFixed(1)}`
    const color = zoomMultiplier >= 3 ? '#ff0000' : zoomMultiplier >= 2 ? '#ff8800' : '#ffff00'
    
    const bonusDisplay = this.add.text(x, y - 30, bonusText, {
      fontSize: '18px',
      color: color,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5)
    
    // ボーナステキストアニメーション
    this.tweens.add({
      targets: bonusDisplay,
      y: y - 60,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => bonusDisplay.destroy()
    })
  }

  private showScoreGainEffect(x: number, y: number, baseScore: number, zoomMultiplier: number) {
    // 基本点 x ズーム倍率の表示
    const scoreText = `${baseScore} × ${zoomMultiplier.toFixed(1)}`
    
    // ズーム倍率に応じて色を変える
    let color = '#00ff00' // 緑（等倍）
    if (zoomMultiplier >= 3) {
      color = '#ff0000' // 赤（最大ズーム）
    } else if (zoomMultiplier >= 2.5) {
      color = '#ff4400' // オレンジレッド（高ズーム）
    } else if (zoomMultiplier >= 2) {
      color = '#ffaa00' // オレンジ（中ズーム）
    } else if (zoomMultiplier > 1) {
      color = '#ffff00' // 黄色（軽ズーム）
    }
    
    const scoreDisplay = this.add.text(x, y - 40, scoreText, {
      fontSize: '24px',
      color: color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: '#000000',
        blur: 2,
        fill: true
      }
    }).setOrigin(0.5)
    
    // 枠を追加
    const padding = 8
    const bounds = scoreDisplay.getBounds()
    const frame = this.add.rectangle(
      bounds.centerX, 
      bounds.centerY, 
      bounds.width + padding * 2, 
      bounds.height + padding * 2, 
      0x000000, 
      0.7
    )
    frame.setStrokeStyle(3, parseInt(color.replace('#', '0x')))
    
    // フレームをテキストの後ろに配置
    frame.setDepth(scoreDisplay.depth - 1)
    
    // スコアテキストアニメーション
    this.tweens.add({
      targets: [scoreDisplay, frame],
      y: y - 100,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        scoreDisplay.destroy()
        frame.destroy()
      }
    })
  }

  private showScoreLossEffect(x: number, y: number, damage: number) {
    // マイナススコアをポップアップ表示
    const scoreText = `-${damage}`
    
    // ダメージ量に応じて色と大きさを変える
    let color = '#ff4444' // 赤（基本）
    let fontSize = '24px'
    if (damage >= 10) {
      color = '#ff0000' // 強い赤（大ダメージ）
      fontSize = '28px'
    } else if (damage >= 5) {
      color = '#ff2222' // 中赤（中ダメージ）
      fontSize = '26px'
    }
    
    const scoreDisplay = this.add.text(x, y - 30, scoreText, {
      fontSize: fontSize,
      color: color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: '#000000',
        blur: 2,
        fill: true
      }
    }).setOrigin(0.5)
    
    // 枠を追加
    const padding = 8
    const bounds = scoreDisplay.getBounds()
    const frame = this.add.rectangle(
      bounds.centerX, 
      bounds.centerY, 
      bounds.width + padding * 2, 
      bounds.height + padding * 2, 
      0x000000, 
      0.7
    )
    frame.setStrokeStyle(3, parseInt(color.replace('#', '0x')))
    
    // フレームをテキストの後ろに配置
    frame.setDepth(scoreDisplay.depth - 1)
    
    // マイナススコアテキストアニメーション（下に沈んで消える）
    this.tweens.add({
      targets: [scoreDisplay, frame],
      y: y + 100,
      scaleX: 1.1,
      scaleY: 1.1,
      alpha: 0,
      duration: 1800,
      ease: 'Power2',
      onComplete: () => {
        scoreDisplay.destroy()
        frame.destroy()
      }
    })
    
    // 家の軽い点滅エフェクト
    this.tweens.add({
      targets: this.playerHouse,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 2
    })
  }

  private showBombEffect(x: number, y: number, radius: number) {
    // ボム攻撃エフェクト（指定された半径のまま、拡大なし）
    const effect = this.add.circle(x, y, radius, 0xff4444, 0.6)
    
    this.tweens.add({
      targets: effect,
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
        
        // ボム自動回復（1分、2分時点）
        if ((this.gameTimeRemaining === 120 || this.gameTimeRemaining === 60)) {
          this.bombStock = 1
          this.generateRandomBombType()
          this.updateBombDisplay()
        }
        
        // タココング出現（残り110秒 = ゲーム開始から70秒経過時）
        if (this.gameTimeRemaining === 110 && !this.takokongSpawned) {
          this.spawnTakokong()
        }
        
        if (this.gameTimeRemaining <= 0) {
          this.endGame()
        }
      },
      loop: true
    })
  }

  private startClockTimer() {
    this.clockTimer = this.time.addEvent({
      delay: 100, // 1/10秒ごとに更新
      callback: () => {
        this.updateMorningTime()
      },
      loop: true
    })
  }

  private startScreenshotTimer() {
    // 60秒ごとに1枚ずつ撮影（合計3枚）
    this.screenshotTimer = this.time.addEvent({
      delay: 60000, // 60秒ごと
      callback: this.takeScreenshot,
      callbackScope: this,
      repeat: 2 // 3回実行（0, 1, 2）
    })
  }

  private takeScreenshot() {
    // Phaserのスナップショット機能を使用
    this.game.renderer.snapshot((image: HTMLImageElement) => {
      if (image) {
        // HTMLImageElementからcanvasに描画してbase64に変換
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (ctx && image.src) {
          canvas.width = image.width
          canvas.height = image.height
          ctx.drawImage(image, 0, 0)
          const dataURL = canvas.toDataURL('image/png')
          this.screenshots.push(dataURL)
          console.log(`スクリーンショット ${this.screenshots.length}/3 撮影完了`)
        }
      }
    })
  }

  private spawnTakokong() {
    this.takokongSpawned = true
    this.enemyManager.stopSpawning()
    
    // タココングを地上タコと同じルール（あぜ道の端）から出現させる
    const spawnPos = this.findPathEdgePosition()
    this.takokong = new Takokong(
      this, 
      spawnPos.x, 
      spawnPos.y,
      this.playerHouse.x, 
      this.playerHouse.y,
      this.mapPanels
    )
    
    console.log('👑 タココング戦開始!')
  }

  private findPathEdgePosition(): { x: number; y: number } {
    const tileSize = 30
    const pathPositions: { x: number; y: number }[] = []
    const { width, height } = this.scale
    
    // マップの端にあるあぜ道を探す
    for (let x = 0; x < this.mapPanels.length; x++) {
      for (let y = 0; y < this.mapPanels[0].length; y++) {
        const panel = this.mapPanels[x][y]
        if (panel && panel.type === 'path') {
          // 端にあるかチェック
          if (x === 0 || x === this.mapPanels.length - 1 || 
              y === 0 || y === this.mapPanels[0].length - 1) {
            const centerTileX = Math.floor(this.mapPanels.length / 2)
            const centerTileY = Math.floor(this.mapPanels[0].length / 2)
            const worldX = width / 2 + (x - centerTileX) * tileSize
            const worldY = height / 2 + (y - centerTileY) * tileSize
            pathPositions.push({ x: worldX, y: worldY })
          }
        }
      }
    }
    
    // ランダムなあぜ道の端を選択
    if (pathPositions.length > 0) {
      return pathPositions[Math.floor(Math.random() * pathPositions.length)]
    }
    
    // あぜ道の端が見つからない場合は画面端から
    return { x: -30, y: Math.random() * height }
  }

  private updateScoreDisplay() {
    if (this.uiScene) {
      (this.uiScene as any).updateScore(this.currentScore)
    }
  }

  private updateBombDisplay() {
    if (this.uiScene) {
      if (this.bombStock > 0 && this.currentBombType) {
        const bombData = BOMB_DATA.find(data => data.type === this.currentBombType)
        const bombName = bombData?.name || 'Unknown'
        ;(this.uiScene as any).updateBombDisplay(bombName)
      } else {
        ;(this.uiScene as any).updateBombDisplay('')
      }
    }
  }

  private endGame() {
    this.gameTimer.remove()
    this.clockTimer.remove()
    
    if (this.screenshotTimer) {
      this.screenshotTimer.remove()
      this.screenshotTimer = null
    }
    
    this.enemyManager.destroy()
    this.cameraController.destroy()
    
    if (this.takokong) {
      this.takokong.destroy()
    }
    
    this.scene.start('EndingScene', { 
      score: this.currentScore,
      timeSpent: 180 - this.gameTimeRemaining,
      screenshots: this.screenshots
    })
  }

  update() {
    // ゲームループ処理
  }
}