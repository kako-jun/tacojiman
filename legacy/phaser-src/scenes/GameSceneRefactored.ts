/**
 * リファクタリング後のGameScene
 * ビジネスロジックを他クラスに移譲し、Phaser固有の処理に集中
 */

import Phaser from 'phaser'
import { EnemyManager } from '@/entities/EnemyManager'
import { CameraController } from '@/utils/CameraController'
import { BombJutsu } from '@/entities/BombJutsu'
import { Takokong } from '@/entities/Takokong'
import { BOMB_DATA } from '@/utils/config'
import { BombType } from '@/types'
import { MapGenerator } from '@/utils/MapGenerator'
import { MapPanel, PANEL_CONFIG } from '@/types/MapTypes'

// 新しく作成したクラスをインポート
import { EffectManager } from '@/managers/EffectManager'
import { ScreenshotManager } from '@/managers/ScreenshotManager'
import { GameEventManager } from '@/managers/GameEventManager'
import { GAME_CONFIG } from '@/utils/GameConfig'
import { 
  calculateGameTimeState, 
  calculateEnemySpawnRule, 
  generateMapRotationSettings,
  generateMorningTime 
} from '@/utils/domain/GameRules'
import { calculateGameTime } from '@/utils/domain/TimeManager'
import { 
  calculateFinalScore, 
  subtractScoreSafely 
} from '@/utils/domain/ScoreCalculator'

export class GameSceneRefactored extends Phaser.Scene {
  // 基本ゲーム状態
  private gameTimer!: Phaser.Time.TimerEvent
  private clockTimer!: Phaser.Time.TimerEvent
  private gameTimeRemaining: number = GAME_CONFIG.GAME.TOTAL_DURATION_SECONDS
  private currentScore: number = 0
  private gameStartTime: number = 0
  private gameStartMorningTime: string = ''
  private takokongSpawned: boolean = false
  
  // UI要素
  private uiScene!: Phaser.Scene
  
  // ゲーム要素
  private playerHouse!: Phaser.GameObjects.Rectangle
  private enemyManager!: EnemyManager
  private cameraController!: CameraController
  private takokong: Takokong | null = null
  
  // ボム忍術システム
  private bombStock: number = GAME_CONFIG.GAME.INITIAL_BOMB_STOCK
  private currentBombType: BombType | null = null
  
  // 入力制御
  private isLongPress: boolean = false
  private longPressTimer: Phaser.Time.TimerEvent | null = null
  
  // マップ関連
  private mapPanels: MapPanel[][] = []
  private otherHousePositions: { x: number; y: number }[] = []
  private stationPositions: { x: number; y: number }[] = []

  // 新しいマネージャークラス
  private effectManager!: EffectManager
  private screenshotManager!: ScreenshotManager
  private eventManager!: GameEventManager

  constructor() {
    super({ key: 'GameSceneRefactored' })
  }

  create() {
    const { width, height } = this.scale

    // 基本初期化
    this.initializeGameState()
    this.initializeManagers()
    this.createWireframeMap(width, height)
    this.createPlayerHouse(width, height)
    this.initializeGameSystems(width, height)
    this.setupEventListeners()
    this.setupInput()
    this.startGameSystems()
  }

  /**
   * ゲーム状態の初期化
   */
  private initializeGameState(): void {
    this.gameStartMorningTime = generateMorningTime()
    this.gameStartTime = this.time.now
    this.takokongSpawned = false
    this.currentScore = 0
    this.gameTimeRemaining = GAME_CONFIG.GAME.TOTAL_DURATION_SECONDS
    this.bombStock = GAME_CONFIG.GAME.INITIAL_BOMB_STOCK
  }

  /**
   * マネージャークラスの初期化
   */
  private initializeManagers(): void {
    this.effectManager = new EffectManager(this)
    this.screenshotManager = new ScreenshotManager(this.game)
    this.eventManager = new GameEventManager(this)
  }

  /**
   * プレイヤーの家を作成
   */
  private createPlayerHouse(width: number, height: number): void {
    this.playerHouse = this.add.rectangle(width / 2, height / 2, 1, 1, 0x000000, 0)
    this.playerHouse.setInteractive()
    this.playerHouse.setDepth(50)
  }

  /**
   * ゲームシステムの初期化
   */
  private initializeGameSystems(width: number, height: number): void {
    this.cameraController = new CameraController(this, width / 2, height / 2)
    this.enemyManager = new EnemyManager(
      this, 
      width / 2, 
      height / 2, 
      width, 
      height, 
      this.mapPanels
    )
    
    this.generateRandomBombType()
    this.startUIScene()
    
    // UI初期化遅延
    this.time.delayedCall(100, () => {
      this.updateMorningTime()
      this.updateBombDisplay()
    })
  }

  /**
   * ゲームシステムの開始
   */
  private startGameSystems(): void {
    this.startGameTimer()
    this.startClockTimer()
    this.screenshotManager.startCapture(this)
    this.enemyManager.startSpawning()
  }

  /**
   * マップ生成（既存のロジックを使用）
   */
  private createWireframeMap(width: number, height: number): void {
    const mapContainer = this.add.container(width / 2, height / 2)
    mapContainer.setDepth(0)
    
    const baseSize = Math.max(width, height)
    const mapSize = baseSize * GAME_CONFIG.MAP.SIZE_MULTIPLIER
    const graphics = this.add.graphics()
    
    // 背景色
    graphics.fillStyle(GAME_CONFIG.MAP.BASE_COLOR)
    graphics.fillRect(-mapSize / 2, -mapSize / 2, mapSize, mapSize)
    
    // マップ生成
    const mapGenerator = new MapGenerator(mapSize, mapSize, GAME_CONFIG.MAP.TILE_SIZE)
    this.mapPanels = mapGenerator.generateMap()
    
    // 他人の家と駅の位置記録
    this.recordSpecialPositions(width, height)
    
    // タイル描画
    this.drawMapTiles(graphics, width, height)
    
    mapContainer.add(graphics)
    
    // 回転設定
    this.setupMapRotation(mapContainer)
  }

  /**
   * 特殊位置（他人の家、駅）を記録
   */
  private recordSpecialPositions(width: number, height: number): void {
    this.otherHousePositions = []
    this.stationPositions = []
    
    const tileSize = GAME_CONFIG.MAP.TILE_SIZE
    const centerTileX = Math.floor(this.mapPanels.length / 2)
    const centerTileY = Math.floor(this.mapPanels[0].length / 2)
    
    for (let x = 0; x < this.mapPanels.length; x++) {
      for (let y = 0; y < this.mapPanels[0].length; y++) {
        const panel = this.mapPanels[x][y]
        if (!panel) continue
        
        const tileX = (x - centerTileX) * tileSize - tileSize / 2 + 1
        const tileY = (y - centerTileY) * tileSize - tileSize / 2
        
        if (panel.type === 'other_house') {
          this.otherHousePositions.push({
            x: width / 2 + tileX + tileSize / 2,
            y: height / 2 + tileY + tileSize / 2
          })
        } else if (panel.type === 'station') {
          this.stationPositions.push({
            x: width / 2 + tileX + tileSize / 2,
            y: height / 2 + tileY + tileSize / 2
          })
        }
      }
    }
  }

  /**
   * マップタイルの描画
   */
  private drawMapTiles(graphics: Phaser.GameObjects.Graphics, width: number, height: number): void {
    const tileSize = GAME_CONFIG.MAP.TILE_SIZE
    const centerTileX = Math.floor(this.mapPanels.length / 2)
    const centerTileY = Math.floor(this.mapPanels[0].length / 2)
    
    for (let x = 0; x < this.mapPanels.length; x++) {
      for (let y = 0; y < this.mapPanels[0].length; y++) {
        const panel = this.mapPanels[x][y]
        if (!panel) continue
        
        const tileX = (x - centerTileX) * tileSize - tileSize / 2 + 1
        const tileY = (y - centerTileY) * tileSize - tileSize / 2
        
        // パネル描画
        const config = PANEL_CONFIG[panel.type]
        graphics.fillStyle(config.color, config.alpha)
        graphics.fillRect(tileX, tileY, tileSize - 1, tileSize - 1)
        
        // 枠線描画
        this.drawPanelBorder(graphics, panel, tileX, tileY, tileSize)
        
        // 接続描画
        if (panel.type === 'path' || panel.type === 'rail') {
          this.drawConnections(graphics, tileX, tileY, tileSize, panel.connections, panel.type)
        }
      }
    }
  }

  /**
   * パネルの枠線描画
   */
  private drawPanelBorder(
    graphics: Phaser.GameObjects.Graphics,
    panel: MapPanel,
    tileX: number,
    tileY: number,
    tileSize: number
  ): void {
    if (panel.type === 'player_house') {
      graphics.lineStyle(2, 0xffffff, 0.8)
    } else if (panel.type === 'other_house') {
      graphics.lineStyle(2, 0xffaa00, 0.5)
    } else if (panel.type === 'station') {
      graphics.lineStyle(2, 0xcccccc, 0.5)
    } else {
      graphics.lineStyle(1, 0xffffff, 0.3)
    }
    
    graphics.strokeRect(tileX, tileY, tileSize - 1, tileSize - 1)
  }

  /**
   * 接続線の描画（既存ロジック）
   */
  private drawConnections(
    graphics: Phaser.GameObjects.Graphics,
    tileX: number,
    tileY: number,
    tileSize: number,
    connections: any,
    type: string
  ): void {
    // 既存のロジックをそのまま使用
    const centerX = tileX + tileSize / 2
    const centerY = tileY + tileSize / 2
    const roadWidth = type === 'rail' ? 6 : 8
    const roadColor = type === 'rail' ? 0x666666 : 0xaa8844
    
    graphics.lineStyle(roadWidth, roadColor, 0.8)
    
    if (connections.north) graphics.lineBetween(centerX, centerY, centerX, tileY)
    if (connections.south) graphics.lineBetween(centerX, centerY, centerX, tileY + tileSize)
    if (connections.east) graphics.lineBetween(centerX, centerY, tileX + tileSize, centerY)
    if (connections.west) graphics.lineBetween(centerX, centerY, tileX, centerY)
    
    if (connections.north || connections.south || connections.east || connections.west) {
      graphics.fillStyle(roadColor, 0.8)
      graphics.fillCircle(centerX, centerY, roadWidth / 2)
    }
  }

  /**
   * マップ回転の設定
   */
  private setupMapRotation(mapContainer: Phaser.GameObjects.Container): void {
    const { direction, duration } = generateMapRotationSettings()
    
    this.tweens.add({
      targets: mapContainer,
      rotation: direction * Math.PI * 2,
      duration,
      repeat: -1,
      ease: 'None'
    })
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners(): void {
    // プレイヤーダメージ
    this.eventManager.on('player-damaged', (damage: number) => {
      this.currentScore = subtractScoreSafely(this.currentScore, damage)
      this.updateScoreDisplay()
      this.effectManager.showScoreLoss(this.playerHouse.x, this.playerHouse.y, damage)
      this.effectManager.showHouseDamageEffect(this.playerHouse)
    })

    // スコア獲得表示
    this.eventManager.on('show-score-gain', (data) => {
      this.effectManager.showScoreGain(data.x, data.y, data.baseScore, data.zoomMultiplier)
    })

    // タココング撃破
    this.eventManager.on('takokong-defeated', () => {
      this.currentScore += GAME_CONFIG.TAKOKONG.DEFEAT_BONUS_SCORE
      this.updateScoreDisplay()
      this.time.delayedCall(GAME_CONFIG.TAKOKONG.FINAL_BATTLE_DELAY, () => this.endGame())
    })

    // その他のボム忍術イベント
    this.setupBombEvents()
    this.setupDecoyEvents()
  }

  /**
   * ボム忍術関連イベントの設定
   */
  private setupBombEvents(): void {
    this.eventManager.on('muteki-explosion', (data) => {
      this.handleExplosionDamage(data)
    })

    this.eventManager.on('sol-strike', (data) => {
      this.handleExplosionDamage(data)
    })

    this.eventManager.on('jakuhou-strike', (data) => {
      this.handleExplosionDamage(data)
    })

    this.eventManager.on('dainsleif-multihit', (data) => {
      this.handleMultiHitDamage(data)
    })

    this.eventManager.on('dainsleif-final-check', (data) => {
      if (data.hitTargets.size === 0) {
        this.effectManager.showMissedEffect()
      } else {
        this.effectManager.showMultiHitBonus(data.hitTargets.size)
      }
    })
  }

  /**
   * 分身システム関連イベントの設定
   */
  private setupDecoyEvents(): void {
    const activeDecoys = new Set<number>()
    
    this.eventManager.on('bunshin-decoy-start', (data) => {
      activeDecoys.add(data.decoyNumber)
      this.enemyManager.addDecoyTarget(data.x, data.y, data.range, data.decoyNumber)
    })

    this.eventManager.on('bunshin-decoy-end', (data) => {
      activeDecoys.delete(data.decoyNumber)
      this.enemyManager.removeDecoyTarget(data.decoyNumber)
      
      if (activeDecoys.size === 0) {
        this.enemyManager.clearAllDecoyTargets()
      }
    })
  }

  /**
   * 爆発ダメージの処理
   */
  private handleExplosionDamage(data: { x: number; y: number; range: number; damage: number }): void {
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
  }

  /**
   * 多段ヒットダメージの処理
   */
  private handleMultiHitDamage(data: any): void {
    let stepScore = 0
    
    const enemiesInRange = this.enemyManager.getEnemiesInArea(data.x, data.y, data.width)
    enemiesInRange.forEach(enemy => {
      if (!data.hitTargets.has(enemy)) {
        data.hitTargets.add(enemy)
        const result = enemy.takeDamage(data.damage)
        stepScore += result.score
        this.effectManager.showMultiHitEffect(enemy.x, enemy.y, data.step)
      } else {
        const result = enemy.takeDamage(1)
        stepScore += result.score
        this.effectManager.showContinuousHitEffect(enemy.x, enemy.y)
      }
    })
    
    // タココングへの多段ヒット
    if (this.takokong && this.takokong.checkCollision(data.x, data.y, data.width)) {
      if (!data.hitTargets.has(this.takokong)) {
        data.hitTargets.add(this.takokong)
        const bossResult = this.takokong.takeDamage(data.damage)
        stepScore += bossResult.score
        this.effectManager.showMultiHitEffect(this.takokong.x, this.takokong.y, data.step)
      } else {
        const bossResult = this.takokong.takeDamage(2)
        stepScore += bossResult.score
        this.effectManager.showContinuousHitEffect(this.takokong.x, this.takokong.y)
      }
    }
    
    this.currentScore += stepScore
    this.updateScoreDisplay()
  }

  /**
   * 入力処理の設定
   */
  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer)
    })
    
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerUp(pointer)
    })
  }

  /**
   * ポインターダウン処理
   */
  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.isLongPress = false
    
    const worldPoint = this.cameraController.getWorldPoint(pointer.x, pointer.y)
    const enemyAtPosition = this.enemyManager.getEnemyAtPosition(worldPoint.x, worldPoint.y)
    const takokongHit = this.takokong && this.takokong.checkCollision(worldPoint.x, worldPoint.y, GAME_CONFIG.ATTACK.TAKOKONG_ATTACK_RADIUS)
    const houseHit = this.checkHouseClick(worldPoint.x, worldPoint.y)
    
    if (!enemyAtPosition && !takokongHit && !houseHit) {
      this.cameraController.startZoomIn(worldPoint.x, worldPoint.y, GAME_CONFIG.SCORE.ZOOM_MULTIPLIER.ZOOM_IN_TARGET)
    }
    
    this.longPressTimer = this.time.delayedCall(300, () => {
      this.isLongPress = true
    })
  }

  /**
   * ポインターアップ処理
   */
  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.longPressTimer) {
      this.longPressTimer.remove()
      this.longPressTimer = null
    }
    
    if (this.cameraController.getIsZoomedIn()) {
      this.cameraController.zoomOut()
    }
    
    const worldPoint = this.cameraController.getWorldPoint(pointer.x, pointer.y)
    
    if (this.checkHouseClick(worldPoint.x, worldPoint.y)) {
      this.activateBombJutsu()
    } else {
      this.performBeeAttack(worldPoint.x, worldPoint.y)
    }
  }

  /**
   * 家のクリック判定
   */
  private checkHouseClick(x: number, y: number): boolean {
    const distance = Phaser.Math.Distance.Between(x, y, this.playerHouse.x, this.playerHouse.y)
    return distance < GAME_CONFIG.ATTACK.HOUSE_CLICK_RADIUS
  }

  /**
   * 無敵エリア判定
   */
  private isInInvulnerableArea(x: number, y: number): boolean {
    // 他人の家または駅の範囲内かチェック
    const checkArea = (positions: { x: number; y: number }[]) => {
      return positions.some(pos => 
        Math.abs(x - pos.x) < 15 && Math.abs(y - pos.y) < 15
      )
    }
    
    return checkArea(this.otherHousePositions) || checkArea(this.stationPositions)
  }

  /**
   * 蜂攻撃の実行
   */
  private performBeeAttack(x: number, y: number): void {
    if (this.isInInvulnerableArea(x, y)) return
    
    let hit = false
    const zoomMultiplier = this.cameraController.getCurrentZoom()
    
    // 通常敵への攻撃
    const attackResult = this.enemyManager.checkAttackHit(
      x, y, 
      GAME_CONFIG.ATTACK.NORMAL_ATTACK_RADIUS, 
      (enemy) => !this.isInInvulnerableArea(enemy.x, enemy.y), 
      zoomMultiplier
    )
    
    if (attackResult.hit) {
      this.currentScore += attackResult.score
      hit = true
    }
    
    // タココングへの攻撃
    if (this.takokong && 
        this.takokong.checkCollision(x, y, GAME_CONFIG.ATTACK.TAKOKONG_ATTACK_RADIUS) && 
        !this.isInInvulnerableArea(this.takokong.x, this.takokong.y)) {
      
      const bossResult = this.takokong.takeDamage(1, zoomMultiplier)
      if (bossResult.score > 0) {
        this.currentScore += bossResult.score
        this.effectManager.showScoreGain(this.takokong.x, this.takokong.y, GAME_CONFIG.TAKOKONG.BASE_SCORE, zoomMultiplier)
      }
      hit = true
    }
    
    this.updateScoreDisplay()
    this.effectManager.showAttackEffect(x, y, hit, GAME_CONFIG.ATTACK.NORMAL_ATTACK_RADIUS)
  }

  /**
   * ボム忍術の発動
   */
  private activateBombJutsu(): void {
    if (this.bombStock <= 0 || !this.currentBombType) return

    const bombData = BOMB_DATA.find(data => data.type === this.currentBombType)
    if (bombData) {
      const bomb = new BombJutsu(this.currentBombType, bombData)
      bomb.activate(this, this.playerHouse.x, this.playerHouse.y)
    }

    this.bombStock--
    this.updateBombDisplay()
  }

  /**
   * ランダムボムタイプ生成
   */
  private generateRandomBombType(): void {
    const bombTypes: BombType[] = ['proton', 'muddy', 'sentry', 'muteki', 'sol', 'dainsleif', 'jakuhou', 'bunshin']
    this.currentBombType = bombTypes[Math.floor(Math.random() * bombTypes.length)]
  }

  /**
   * UIシーンの開始
   */
  private startUIScene(): void {
    this.scene.launch('UIScene')
    this.uiScene = this.scene.get('UIScene')
  }

  /**
   * ゲームタイマーの開始
   */
  private startGameTimer(): void {
    this.gameTimer = this.time.addEvent({
      delay: GAME_CONFIG.UI.GAME_TIMER_INTERVAL,
      callback: () => {
        this.gameTimeRemaining--
        
        // ボム自動回復
        if (GAME_CONFIG.GAME.BOMB_RECOVERY_TIMES.includes(this.gameTimeRemaining)) {
          this.bombStock = GAME_CONFIG.GAME.MAX_BOMB_STOCK
          this.generateRandomBombType()
          this.updateBombDisplay()
        }
        
        // タココング出現
        if (this.gameTimeRemaining === GAME_CONFIG.GAME.TAKOKONG_SPAWN_TIME_REMAINING && !this.takokongSpawned) {
          this.spawnTakokong()
        }
        
        if (this.gameTimeRemaining <= 0) {
          this.endGame()
        }
      },
      loop: true
    })
  }

  /**
   * 時刻タイマーの開始
   */
  private startClockTimer(): void {
    this.clockTimer = this.time.addEvent({
      delay: GAME_CONFIG.UI.CLOCK_UPDATE_INTERVAL,
      callback: () => this.updateMorningTime(),
      loop: true
    })
  }

  /**
   * 朝の時刻を更新
   */
  private updateMorningTime(): void {
    const elapsedMs = this.time.now - this.gameStartTime
    const timeProgress = calculateGameTime(this.gameStartMorningTime, elapsedMs)
    
    if (this.uiScene) {
      (this.uiScene as any).updateClock(timeProgress.currentGameTime.displayText)
    }
  }

  /**
   * タココング出現
   */
  private spawnTakokong(): void {
    this.takokongSpawned = true
    this.enemyManager.stopSpawning()
    
    const spawnPos = this.findPathEdgePosition()
    this.takokong = new Takokong(
      this, 
      spawnPos.x, 
      spawnPos.y,
      this.playerHouse.x, 
      this.playerHouse.y,
      this.mapPanels
    )
  }

  /**
   * あぜ道端の位置を検索
   */
  private findPathEdgePosition(): { x: number; y: number } {
    const tileSize = GAME_CONFIG.MAP.TILE_SIZE
    const pathPositions: { x: number; y: number }[] = []
    const { width, height } = this.scale
    
    for (let x = 0; x < this.mapPanels.length; x++) {
      for (let y = 0; y < this.mapPanels[0].length; y++) {
        const panel = this.mapPanels[x][y]
        if (panel && panel.type === 'path') {
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
    
    return pathPositions.length > 0 
      ? pathPositions[Math.floor(Math.random() * pathPositions.length)]
      : { x: -30, y: Math.random() * height }
  }

  /**
   * スコア表示の更新
   */
  private updateScoreDisplay(): void {
    if (this.uiScene) {
      (this.uiScene as any).updateScore(this.currentScore)
    }
  }

  /**
   * ボム表示の更新
   */
  private updateBombDisplay(): void {
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

  /**
   * ゲーム終了
   */
  private endGame(): void {
    this.gameTimer.remove()
    this.clockTimer.remove()
    this.screenshotManager.stopCapture()
    
    this.enemyManager.destroy()
    this.cameraController.destroy()
    this.eventManager.destroy()
    
    if (this.takokong) {
      this.takokong.destroy()
    }
    
    this.scene.start('EndingScene', { 
      score: this.currentScore,
      timeSpent: GAME_CONFIG.GAME.TOTAL_DURATION_SECONDS - this.gameTimeRemaining,
      screenshots: this.screenshotManager.getDataURLs()
    })
  }

  update(): void {
    // ゲームループ処理（必要に応じて）
  }
}