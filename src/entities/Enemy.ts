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
  
  // 残像システム
  private trailSprites: Phaser.GameObjects.Shape[] = []
  private lastPosition: { x: number; y: number } = { x: 0, y: 0 }
  private trailTimer: number = 0
  private readonly TRAIL_INTERVAL = 50 // 50msごとに残像を作成
  private readonly MAX_TRAIL_LENGTH = 8 // 最大8個の残像
  
  // マップパネル情報
  private mapPanels?: any[][]
  
  // 空タコ用の遠近法システム
  private initialDistance: number = 0
  private baseScale: number = 1

  constructor(
    scene: Phaser.Scene, 
    x: number, 
    y: number, 
    enemyData: EnemyData,
    targetX: number,
    targetY: number,
    mapPanels?: any[][]
  ) {
    super(scene, x, y)
    
    this.enemyType = enemyData.type
    this.maxHP = enemyData.hp
    this.currentHP = enemyData.hp
    this.speed = enemyData.speed
    this.scoreValue = enemyData.score
    this.targetX = targetX
    this.targetY = targetY
    this.mapPanels = mapPanels
    

    // 敵スプライト作成
    this.createSprite(enemyData)
    
    // シーンに追加
    scene.add.existing(this)
    
    // 敵はUIより低いdepthに設定
    this.setDepth(100)
    
    // 初期位置を記録
    this.lastPosition = { x: this.x, y: this.y }
    
    // 空タコの場合は遠近法システムを初期化
    if (this.enemyType === 'air') {
      this.initializePerspectiveSystem()
    }
    
    // 残像更新タイマーを開始
    this.startTrailSystem()
    
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
        // 地上：矩形（Rectangle）- デバッグ用に大きく明るい色に
        const debugSize = 40 // 通常の2倍
        const debugColor = 0x00ff00 // 明るい緑色
        this.sprite = this.scene.add.rectangle(0, 0, debugSize, debugSize, debugColor)
        console.log(`地上タコ描画（デバッグ）: サイズ=${debugSize}, 色=${debugColor.toString(16)}, 位置=(${this.x}, ${this.y})`)
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

    // 地上タコの可視性デバッグ
    if (this.enemyType === 'ground') {
      console.log(`地上タコ最終確認: visible=${this.visible}, depth=${this.depth}, alpha=${this.alpha}, scale=${this.scale}`)
      console.log(`地上タコsprite: visible=${this.sprite.visible}, alpha=${this.sprite.alpha}`)
    }
  }

  private startMovement() {
    if (!this.scene || !this.scene.tweens) {
      return
    }

    // 敵タイプに応じた移動方式（完全排他）
    if (this.enemyType === 'air' || this.enemyType === 'underground') {
      // 空タコ：空中を直線移動
      // 地下タコ：地中を直線移動（地下から突然出現して直進）
      console.log(`${this.enemyType}タコ: 直線移動開始`)
      this.startDirectMovement()
    } else if (this.enemyType === 'ground' || this.enemyType === 'water') {
      // 地上タコ：道路・線路を辿って移動
      // 水タコ：水路を辿って移動
      console.log(`${this.enemyType}タコ: パスファインディング移動開始`)
      this.startPathfindingMovement()
    } else {
      console.error(`未定義の敵タイプ: ${this.enemyType}`)
      this.startDirectMovement() // フォールバック
    }
  }

  private startDirectMovement() {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY)
    let duration = (distance / this.speed) * 100

    // 空タコの場合は初速重視（減速なし）
    if (this.enemyType === 'air') {
      // 初速を重視し、時間調整は行わない
    }

    this.moveTween = this.scene.tweens.add({
      targets: this,
      x: this.targetX,
      y: this.targetY,
      duration: duration,
      ease: this.getMovementEase(),
      onUpdate: () => {
        // 空タコの場合は移動中にスケールを更新
        if (this.enemyType === 'air') {
          this.updatePerspectiveScale()
        }
      },
      onComplete: () => {
        this.onReachTarget()
      }
    })
  }

  private startPathfindingMovement() {
    if (!this.mapPanels) {
      console.error(`${this.enemyType}タコ: マップパネル情報なし - 移動不可`)
      // パスファインディング専用タコはマップ情報必須
      this.destroy()
      return
    }

    // 現在位置から目標位置へのパスを計算
    const path = this.findPath()
    
    if (path.length === 0) {
      console.error(`${this.enemyType}タコ: パスが見つからない - 移動不可`)
      // パスファインディング専用タコは直線移動フォールバックしない
      // 敵を削除して新しい敵を生成する
      this.destroy()
      return
    }

    console.log(`${this.enemyType}タコ: パス見つかった (${path.length}ステップ)`)
    // パスに沿って移動
    this.moveAlongPath(path)
  }

  private findPath(): { x: number; y: number }[] {
    if (!this.mapPanels) return []

    const tileSize = 30
    const centerTileX = Math.floor(this.mapPanels.length / 2)
    const centerTileY = Math.floor(this.mapPanels[0].length / 2)

    // 現在位置をタイル座標に変換（ワールド座標→タイル座標）
    const startTileX = Math.floor((this.x - this.scene.scale.width / 2) / tileSize) + centerTileX
    const startTileY = Math.floor((this.y - this.scene.scale.height / 2) / tileSize) + centerTileY
    const endTileX = Math.floor((this.targetX - this.scene.scale.width / 2) / tileSize) + centerTileX  
    const endTileY = Math.floor((this.targetY - this.scene.scale.height / 2) / tileSize) + centerTileY

    console.log(`${this.enemyType}タコ座標変換: ワールド(${this.x.toFixed(1)}, ${this.y.toFixed(1)}) → タイル(${startTileX}, ${startTileY})`)
    console.log(`目標座標変換: ワールド(${this.targetX.toFixed(1)}, ${this.targetY.toFixed(1)}) → タイル(${endTileX}, ${endTileY})`)

    // 境界チェック
    if (startTileX < 0 || startTileX >= this.mapPanels.length || 
        startTileY < 0 || startTileY >= this.mapPanels[0].length) {
      console.error(`${this.enemyType}タコ: 開始位置がマップ外 タイル(${startTileX}, ${startTileY})`)
      return []
    }
    
    if (endTileX < 0 || endTileX >= this.mapPanels.length || 
        endTileY < 0 || endTileY >= this.mapPanels[0].length) {
      console.error(`${this.enemyType}タコ: 目標位置がマップ外 タイル(${endTileX}, ${endTileY})`)
      return []
    }

    // A*風のパスファインディング
    const openSet: Array<{x: number, y: number, g: number, h: number, f: number, parent: any}> = []
    const closedSet = new Set<string>()
    const allNodes = new Map<string, any>()
    
    // 開始ノード
    const start = {
      x: startTileX,
      y: startTileY,
      g: 0,
      h: Math.abs(endTileX - startTileX) + Math.abs(endTileY - startTileY),
      f: 0,
      parent: null
    }
    start.f = start.g + start.h
    openSet.push(start)
    allNodes.set(`${startTileX},${startTileY}`, start)

    while (openSet.length > 0) {
      // f値が最小のノードを選択
      openSet.sort((a, b) => a.f - b.f)
      const current = openSet.shift()!
      
      // 目標に到達
      if (current.x === endTileX && current.y === endTileY) {
        return this.reconstructPath(current, centerTileX, centerTileY, tileSize)
      }
      
      closedSet.add(`${current.x},${current.y}`)
      
      // 隣接ノードを探索
      const neighbors = [
        {x: current.x + 1, y: current.y},
        {x: current.x - 1, y: current.y},
        {x: current.x, y: current.y + 1},
        {x: current.x, y: current.y - 1}
      ]
      
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`
        
        // 移動可能かチェック
        if (!this.canMoveToTile(neighbor.x, neighbor.y) || closedSet.has(neighborKey)) {
          continue
        }
        
        const g = current.g + 1
        const h = Math.abs(endTileX - neighbor.x) + Math.abs(endTileY - neighbor.y)
        const f = g + h
        
        // 既により良いパスがあるかチェック
        const existingNode = openSet.find(node => node.x === neighbor.x && node.y === neighbor.y)
        if (existingNode && existingNode.g <= g) {
          continue
        }
        
        // ノードを追加/更新
        if (existingNode) {
          existingNode.g = g
          existingNode.f = f
          existingNode.parent = current
        } else {
          const newNode = {
            x: neighbor.x,
            y: neighbor.y,
            g: g,
            h: h,
            f: f,
            parent: current
          }
          openSet.push(newNode)
          allNodes.set(neighborKey, newNode)
        }
      }
      
      // 探索制限（無限ループ防止）
      if (openSet.length > 200) {
        break
      }
    }

    // パスが見つからない
    return []
  }

  private reconstructPath(goalNode: any, centerTileX: number, centerTileY: number, tileSize: number): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = []
    let current = goalNode
    
    // ゴールから開始点へ逆順でたどる
    while (current && current.parent) {
      const worldX = (current.x - centerTileX) * tileSize
      const worldY = (current.y - centerTileY) * tileSize
      path.unshift({ x: worldX, y: worldY })
      current = current.parent
      
      // 無限ループ防止
      if (path.length > 100) break
    }
    
    return path
  }

  private canMoveToTile(tileX: number, tileY: number): boolean {
    if (!this.mapPanels || 
        tileX < 0 || tileX >= this.mapPanels.length ||
        tileY < 0 || tileY >= this.mapPanels[0].length) {
      return false
    }

    const panel = this.mapPanels[tileX][tileY]
    if (!panel) return false

    // 敵タイプに応じた移動制限（自宅到達を可能にする）
    let canMove = false
    switch (this.enemyType) {
      case 'ground':
        canMove = panel.type === 'path' || panel.type === 'rail' || panel.type === 'player_house'
        break
      case 'water':
        canMove = panel.type === 'water' || panel.type === 'player_house'
        break
      case 'underground':
        canMove = panel.type === 'rice_field' || panel.type === 'path' || panel.type === 'player_house'
        break
      case 'air':
        canMove = true // 制限なし
        break
      default:
        canMove = true
    }

    if (this.enemyType === 'water') {
      console.log(`水タコ: タイル(${tileX},${tileY}) = ${panel.type}, 移動可能: ${canMove}`)
    }

    return canMove
  }

  private moveAlongPath(path: { x: number; y: number }[]) {
    if (path.length === 0) {
      this.onReachTarget()
      return
    }

    let currentIndex = 0
    const moveToNext = () => {
      if (currentIndex >= path.length) {
        this.onReachTarget()
        return
      }

      const target = path[currentIndex]
      const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y)
      let duration = (distance / this.speed) * 100

      // 空タコの場合は初速重視（進行度による減速を軽減）
      if (this.enemyType === 'air') {
        const progressRatio = currentIndex / path.length // 0〜1の進行度
        const durationMultiplier = 1 + (progressRatio * 0.5) // 1倍〜1.5倍に軽減
        duration *= durationMultiplier
      }

      this.moveTween = this.scene.tweens.add({
        targets: this,
        x: target.x,
        y: target.y,
        duration: duration,
        ease: this.enemyType === 'air' ? 'Quart.easeOut' : 'Linear', // 空タコは減速カーブ
        onUpdate: () => {
          // 空タコの場合は移動中にスケールを更新
          if (this.enemyType === 'air') {
            this.updatePerspectiveScale()
          }
        },
        onComplete: () => {
          currentIndex++
          moveToNext()
        }
      })
    }

    moveToNext()
  }

  private initializePerspectiveSystem() {
    // 初期距離を計算（家からの距離）
    this.initialDistance = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY)
    
    // 遠近法による初期スケール計算（遠いほど大きく、最大3倍）
    const maxDistance = 500 // 想定最大距離
    const distanceRatio = Math.min(this.initialDistance / maxDistance, 1)
    this.baseScale = 1 + (distanceRatio * 2) // 1倍〜3倍
    
    // 初期スケールを適用
    this.setScale(this.baseScale)
    
    console.log(`空タコ初期化: 距離=${this.initialDistance.toFixed(0)}, スケール=${this.baseScale.toFixed(2)}`)
  }

  private updatePerspectiveScale() {
    if (this.enemyType !== 'air') return
    
    // 現在の家からの距離
    const currentDistance = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY)
    
    // 距離に応じたスケール計算（遠いほど大きく、近いほど小さく）
    const maxDistance = 500
    const distanceRatio = Math.min(currentDistance / maxDistance, 1)
    const targetScale = 1 + (distanceRatio * 2) // 1倍〜3倍
    
    // スケールを適用
    this.setScale(targetScale)
  }

  private getMovementEase(): string {
    switch (this.enemyType) {
      case 'ground':
        return 'Linear' // 道路歩行型：一定速度
      case 'water':
        return 'Sine.easeInOut' // 海上遡上型：波のような動き
      case 'air':
        return 'Quart.easeOut' // 空挺降下型：最初速く、着地時にゆっくり
      case 'underground':
        return 'Bounce.easeOut' // 地下掘削型：突然出現
      default:
        return 'Linear'
    }
  }

  public takeDamage(damage: number = 1, zoomMultiplier: number = 1): { destroyed: boolean; score: number } {
    this.currentHP -= damage
    
    // ダメージエフェクト
    this.showDamageEffect()
    
    if (this.currentHP <= 0) {
      // ズーム倍率を考慮したスコア計算
      const finalScore = Math.floor(this.scoreValue * zoomMultiplier)
      this.destroy()
      return { destroyed: true, score: finalScore }
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
    
    // 空タコの場合はスケールに応じて当たり判定も調整
    if (this.enemyType === 'air') {
      const adjustedRadius = radius * this.scaleX // 現在のスケールを考慮
      return distance <= adjustedRadius
    }
    
    return distance <= radius
  }

  private startTrailSystem() {
    if (!this.scene || !this.scene.time) return
    
    // 定期的に残像をチェック・作成
    this.scene.time.addEvent({
      delay: this.TRAIL_INTERVAL,
      callback: this.updateTrail,
      callbackScope: this,
      loop: true
    })
  }

  private updateTrail() {
    if (!this.scene) return
    
    // 位置が変わった場合のみ残像を作成
    const distance = Phaser.Math.Distance.Between(this.x, this.y, this.lastPosition.x, this.lastPosition.y)
    if (distance > 5) { // 5ピクセル以上移動した場合
      this.createTrailSprite(this.lastPosition.x, this.lastPosition.y)
      this.lastPosition = { x: this.x, y: this.y }
    }
  }

  private createTrailSprite(x: number, y: number) {
    if (!this.scene) return
    
    // 残像の数が上限に達した場合、古いものを削除
    if (this.trailSprites.length >= this.MAX_TRAIL_LENGTH) {
      const oldTrail = this.trailSprites.shift()
      if (oldTrail) {
        oldTrail.destroy()
      }
    }

    // 現在のスプライトと同じ形状で残像を作成
    const size = this.currentHP === 2 ? 24 : 20
    const color = this.currentHP === 2 ? 
      0xFF4444 : // HP2の色（少し薄く）
      0xFF8888   // HP1の色（少し薄く）

    let trailSprite: Phaser.GameObjects.Shape

    // 敵タイプに応じた形状で残像作成
    switch (this.enemyType) {
      case 'ground':
        trailSprite = this.scene.add.rectangle(x, y, size, size, color)
        break
      case 'water':
        trailSprite = this.scene.add.circle(x, y, size / 2, color)
        break
      case 'air':
        trailSprite = this.scene.add.triangle(x, y, 0, -size/2, -size/2, size/2, size/2, size/2, color)
        break
      case 'underground':
        const points = [
          0, -size/2,    // 上
          size/2, 0,     // 右
          0, size/2,     // 下
          -size/2, 0     // 左
        ]
        trailSprite = this.scene.add.polygon(x, y, points, color)
        break
      default:
        trailSprite = this.scene.add.rectangle(x, y, size, size, color)
        break
    }

    // 残像の設定
    trailSprite.setAlpha(0.4) // 透明度を設定
    trailSprite.setDepth(90)  // 敵より少し後ろに配置
    
    // 空タコの場合は現在のスケールを残像にも適用
    if (this.enemyType === 'air') {
      const currentDistance = Phaser.Math.Distance.Between(x, y, this.targetX, this.targetY)
      const maxDistance = 500
      const distanceRatio = Math.min(currentDistance / maxDistance, 1)
      const trailScale = 1 + (distanceRatio * 2) // 1倍〜3倍
      trailSprite.setScale(trailScale)
    }
    
    // 残像を配列に追加
    this.trailSprites.push(trailSprite)

    // 残像を徐々に消す
    this.scene.tweens.add({
      targets: trailSprite,
      alpha: 0,
      duration: 800, // 800msで消える
      onComplete: () => {
        // 配列から削除
        const index = this.trailSprites.indexOf(trailSprite)
        if (index > -1) {
          this.trailSprites.splice(index, 1)
        }
        trailSprite.destroy()
      }
    })
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
    
    // 残像をクリーンアップ
    this.trailSprites.forEach(trailSprite => {
      if (trailSprite) {
        trailSprite.destroy()
      }
    })
    this.trailSprites = []
    
    super.destroy(fromScene)
  }
}