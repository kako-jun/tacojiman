import Phaser from 'phaser'
import { Enemy } from './Enemy'
import { ENEMY_DATA } from '@/utils/config'
import { EnemyType } from '@/types'

export class EnemyManager {
  private scene: Phaser.Scene
  private enemies: Enemy[] = []
  private playerHouseX: number
  private playerHouseY: number
  private spawnTimer: Phaser.Time.TimerEvent | null = null
  private mapWidth: number
  private mapHeight: number
  private decoyTargets: Map<number, { x: number; y: number; range: number }> = new Map()
  private mapPanels: any[][] = []

  constructor(scene: Phaser.Scene, houseX: number, houseY: number, mapWidth: number, mapHeight: number, mapPanels: any[][]) {
    this.scene = scene
    this.playerHouseX = houseX
    this.playerHouseY = houseY
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
    this.mapPanels = mapPanels

    // 敵が家に到達した時のイベントリスナー
    this.scene.events.on('enemy-reached-house', this.onEnemyReachedHouse, this)
  }

  public startSpawning() {
    // 開始直後に地上タコを3匹出現させる
    this.spawnInitialGroundEnemies()
    
    // 初期出現頻度は0.5秒ごと（非常に高頻度で開始）
    this.spawnTimer = this.scene.time.addEvent({
      delay: 500, // 0.5秒ごと
      callback: this.spawnRandomEnemy,
      callbackScope: this,
      loop: true
    })
    
    // 15秒ごとに出現頻度を上げる（ゲーム内2.5分相当）
    this.scene.time.addEvent({
      delay: 15000, // 15秒ごと
      callback: this.increaseSpawnRate,
      callbackScope: this,
      loop: true
    })
    
    // 敵の位置を定期的にチェック
    this.scene.time.addEvent({
      delay: 100, // 100msごと
      callback: this.checkEnemyPositions,
      callbackScope: this,
      loop: true
    })
  }

  public stopSpawning() {
    if (this.spawnTimer) {
      this.spawnTimer.remove()
      this.spawnTimer = null
    }
  }

  private spawnInitialGroundEnemies() {
    // 開始直後に地上タコを3匹、通常の出現位置から配置
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 200, () => {
        this.spawnSpecificEnemy('ground', false) // 通常の出現位置を使用
      })
    }
  }

  private spawnSpecificEnemy(enemyType: EnemyType, nearHouse: boolean = false) {
    const enemyData = ENEMY_DATA.find(data => data.type === enemyType)
    if (!enemyData) return

    let spawnPos: { x: number; y: number }
    
    if (nearHouse) {
      // 家に近い位置から出現（画面に見える範囲）
      spawnPos = this.getNearHouseSpawnPosition(enemyType)
    } else {
      // 通常の出現位置
      spawnPos = this.getSpawnPosition(enemyType)
    }
    
    const enemy = new Enemy(
      this.scene,
      spawnPos.x,
      spawnPos.y,
      enemyData,
      this.playerHouseX,
      this.playerHouseY,
      this.mapPanels
    )

    this.enemies.push(enemy)
    
    // 分身が存在する場合は新しい敵も誘導
    if (this.decoyTargets.size > 0) {
      this.updateSingleEnemyTarget(enemy)
    }
  }

  // getNearHouseSpawnPosition() 関数を削除 - 不要な特別扱いを排除

  private increaseSpawnRate() {
    if (!this.spawnTimer) return

    // 現在の間隔を取得
    const currentDelay = this.spawnTimer.delay
    
    // 出現頻度を20%上げる（間隔を短くする）
    const newDelay = Math.max(200, currentDelay * 0.8) // 最低200msまで短縮
    
    console.log(`敵出現頻度アップ: ${currentDelay}ms → ${newDelay}ms`)
    
    // 古いタイマーを削除
    this.spawnTimer.remove()
    
    // 新しい間隔でタイマーを再作成
    this.spawnTimer = this.scene.time.addEvent({
      delay: newDelay,
      callback: this.spawnRandomEnemy,
      callbackScope: this,
      loop: true
    })
  }

  private spawnRandomEnemy() {
    // 時間経過とともに最大敵数も増加（初期40匹→最大70匹）
    const gameTime = this.scene.time.now / 1000 // 秒単位
    const maxEnemies = Math.min(70, 40 + Math.floor(gameTime / 15) * 5) // 15秒ごとに5匹増加
    
    if (this.enemies.length >= maxEnemies) return

    const enemyType = this.getRandomEnemyType()
    const enemyData = ENEMY_DATA.find(data => data.type === enemyType)
    if (!enemyData) return

    const spawnPos = this.getSpawnPosition(enemyType)
    
    const enemy = new Enemy(
      this.scene,
      spawnPos.x,
      spawnPos.y,
      enemyData,
      this.playerHouseX,
      this.playerHouseY,
      this.mapPanels
    )

    this.enemies.push(enemy)
    
    // 分身が存在する場合は新しい敵も誘導
    if (this.decoyTargets.size > 0) {
      this.updateSingleEnemyTarget(enemy)
    }
  }

  private getRandomEnemyType(): EnemyType {
    const types: EnemyType[] = ['ground', 'water', 'air', 'underground']
    const weights = [0.5, 0.25, 0.15, 0.1] // 地上タコ50%、水タコ25%、空タコ15%、地下タコ10%
    
    const random = Math.random()
    let cumulativeWeight = 0
    
    for (let i = 0; i < types.length; i++) {
      cumulativeWeight += weights[i]
      if (random <= cumulativeWeight) {
        return types[i]
      }
    }
    
    return 'ground'
  }

  private getSpawnPosition(enemyType: EnemyType): { x: number; y: number } {
    const tileSize = 30 // マップタイル1マスのサイズ
    const centerTileX = Math.floor(this.mapPanels.length / 2)
    const centerTileY = Math.floor(this.mapPanels[0].length / 2)
    
    switch (enemyType) {
      case 'ground':
        // 地上タコ：あぜ道の端から出現
        return this.findPathEdgePosition()
      
      case 'water':
        // 水タコ：水パネルの端から出現
        return this.findWaterEdgePosition()
      
      case 'air':
        // 空タコ：空から（画面端から）
        return this.findAirSpawnPosition()
      
      case 'underground':
        // 地下タコ：田んぼやあぜ道に突然出現
        return this.findUndergroundSpawnPosition()
      
      default:
        return { x: 0, y: 0 }
    }
  }
  
  private findPathEdgePosition(): { x: number; y: number } {
    const tileSize = 30
    const centerTileX = Math.floor(this.mapPanels.length / 2)
    const centerTileY = Math.floor(this.mapPanels[0].length / 2)
    
    // 自宅にたどり着けるあぜ道パネルをすべて収集
    const reachablePaths: { x: number; y: number; tileX: number; tileY: number; distanceFromEdge: number }[] = []
    
    for (let x = 0; x < this.mapPanels.length; x++) {
      for (let y = 0; y < this.mapPanels[0].length; y++) {
        const panel = this.mapPanels[x][y]
        if (panel && (panel.type === 'path' || panel.type === 'rail')) {
          // 自宅まで到達可能かチェック
          if (this.hasValidPath(x, y, centerTileX, centerTileY, 'ground')) {
            // ステージ端からの距離を計算（4辺からの最小距離）
            const distanceFromEdge = Math.min(
              x,                                    // 左端からの距離
              this.mapPanels.length - 1 - x,       // 右端からの距離
              y,                                    // 上端からの距離
              this.mapPanels[0].length - 1 - y      // 下端からの距離
            )
            
            const worldX = this.mapWidth / 2 + (x - centerTileX) * tileSize
            const worldY = this.mapHeight / 2 + (y - centerTileY) * tileSize
            
            reachablePaths.push({ x: worldX, y: worldY, tileX: x, tileY: y, distanceFromEdge })
          }
        }
      }
    }
    
    if (reachablePaths.length === 0) {
      console.error('自宅に到達可能なあぜ道が見つからない')
      throw new Error('地上タコの出現位置が確保できません')
    }
    
    // 最もステージ端に近い位置を選択（distanceFromEdgeが最小）
    reachablePaths.sort((a, b) => a.distanceFromEdge - b.distanceFromEdge)
    const edgePosition = reachablePaths[0]
    
    console.log(`地上タコ出現位置: タイル(${edgePosition.tileX}, ${edgePosition.tileY})、端からの距離: ${edgePosition.distanceFromEdge}`)
    return { x: edgePosition.x, y: edgePosition.y }
  }
  
  private findWaterEdgePosition(): { x: number; y: number } {
    const tileSize = 30
    const centerTileX = Math.floor(this.mapPanels.length / 2)
    const centerTileY = Math.floor(this.mapPanels[0].length / 2)
    
    // 自宅にたどり着ける水路パネルをすべて収集
    const reachableWater: { x: number; y: number; tileX: number; tileY: number }[] = []
    
    for (let x = 0; x < this.mapPanels.length; x++) {
      for (let y = 0; y < this.mapPanels[0].length; y++) {
        const panel = this.mapPanels[x][y]
        if (panel && panel.type === 'water') {
          // 自宅から1マス以上離れているかチェック（難易度調整）
          const distanceFromHome = Math.max(Math.abs(x - centerTileX), Math.abs(y - centerTileY))
          if (distanceFromHome >= 1) {
            // 自宅まで到達可能かチェック
            if (this.hasValidPath(x, y, centerTileX, centerTileY, 'water')) {
              const worldX = this.mapWidth / 2 + (x - centerTileX) * tileSize
              const worldY = this.mapHeight / 2 + (y - centerTileY) * tileSize
              
              reachableWater.push({ x: worldX, y: worldY, tileX: x, tileY: y })
            }
          }
        }
      }
    }
    
    if (reachableWater.length === 0) {
      console.error('自宅に到達可能な水路が見つからない')
      throw new Error('水タコの出現位置が確保できません')
    }
    
    // ランダムに選択（どこでも出現可能）
    const randomIndex = Math.floor(Math.random() * reachableWater.length)
    const spawnPosition = reachableWater[randomIndex]
    
    console.log(`水タコ出現位置: タイル(${spawnPosition.tileX}, ${spawnPosition.tileY})、候補数: ${reachableWater.length}`)
    return { x: spawnPosition.x, y: spawnPosition.y }
  }
  
  private findUndergroundSpawnPosition(): { x: number; y: number } {
    const tileSize = 30
    const undergroundPositions: { x: number; y: number }[] = []
    const maxDistance = 90 // 家から3マス以内（90ピクセル）
    
    // 家の近くの田んぼとあぜ道パネルを探す
    for (let x = 0; x < this.mapPanels.length; x++) {
      for (let y = 0; y < this.mapPanels[0].length; y++) {
        const panel = this.mapPanels[x][y]
        if (panel && (panel.type === 'rice_field' || panel.type === 'path')) {
          const worldX = this.mapWidth / 2 + (x - Math.floor(this.mapPanels.length / 2)) * tileSize
          const worldY = this.mapHeight / 2 + (y - Math.floor(this.mapPanels[0].length / 2)) * tileSize
          
          // 家からの距離をチェック
          const distance = Math.sqrt((worldX - this.playerHouseX) ** 2 + (worldY - this.playerHouseY) ** 2)
          if (distance <= maxDistance) {
            undergroundPositions.push({ x: worldX, y: worldY })
          }
        }
      }
    }
    
    // 家の近くの田んぼ/あぜ道からランダム選択
    if (undergroundPositions.length > 0) {
      return undergroundPositions[Math.floor(Math.random() * undergroundPositions.length)]
    }
    
    // 近くに田んぼ/あぜ道が見つからない場合は家の近くから（従来通り）
    const angle = Math.random() * Math.PI * 2
    const distance = 80 + Math.random() * 100
    return {
      x: this.playerHouseX + Math.cos(angle) * distance,
      y: this.playerHouseY + Math.sin(angle) * distance
    }
  }
  
  private findAirSpawnPosition(): { x: number; y: number } {
    // 空タコは画面の4方向どこからでも出現可能
    const edge = Math.floor(Math.random() * 4) // 0:上, 1:右, 2:下, 3:左
    const margin = 30
    
    switch (edge) {
      case 0: // 上から
        return { 
          x: Math.random() * this.mapWidth, 
          y: -margin 
        }
      case 1: // 右から
        return { 
          x: this.mapWidth + margin, 
          y: Math.random() * this.mapHeight 
        }
      case 2: // 下から
        return { 
          x: Math.random() * this.mapWidth, 
          y: this.mapHeight + margin 
        }
      case 3: // 左から
        return { 
          x: -margin, 
          y: Math.random() * this.mapHeight 
        }
      default:
        return { x: Math.random() * this.mapWidth, y: -margin }
    }
  }

  public checkAttackHit(x: number, y: number, radius: number = 15, filter?: (enemy: Enemy) => boolean, zoomMultiplier: number = 1): { hit: boolean; score: number; baseScore: number; enemy?: Enemy } {
    let totalScore = 0
    let totalBaseScore = 0
    let hit = false
    let firstEnemy: Enemy | undefined = undefined
    
    // 範囲内のすべての敵にダメージを与える
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      if (enemy.checkCollision(x, y, radius)) {
        // フィルター関数が指定されている場合は、それを適用
        if (filter && !filter(enemy)) {
          continue
        }
        
        const result = enemy.takeDamage(1, zoomMultiplier)
        totalScore += result.score
        totalBaseScore += enemy.scoreValue // 基本点を累積
        hit = true
        
        // 個別にスコア表示を発生させる
        if (result.score > 0) {
          this.scene.events.emit('show-score-gain', {
            x: enemy.x,
            y: enemy.y,
            baseScore: enemy.scoreValue,
            zoomMultiplier: zoomMultiplier
          })
        }
        
        if (!firstEnemy) {
          firstEnemy = enemy
        }
        
        if (result.destroyed) {
          this.enemies.splice(i, 1)
        }
      }
    }
    
    return { hit, score: totalScore, baseScore: totalBaseScore, enemy: firstEnemy }
  }

  public checkBombHit(x: number, y: number, radius: number, damage: number = 1, zoomMultiplier: number = 1): number {
    let totalScore = 0
    
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      if (enemy.checkCollision(x, y, radius)) {
        const result = enemy.takeDamage(damage, zoomMultiplier)
        totalScore += result.score
        
        // 個別にスコア表示を発生させる
        if (result.score > 0) {
          this.scene.events.emit('show-score-gain', {
            x: enemy.x,
            y: enemy.y,
            baseScore: enemy.scoreValue,
            zoomMultiplier: zoomMultiplier
          })
        }
        
        if (result.destroyed) {
          this.enemies.splice(i, 1)
        }
      }
    }
    
    return totalScore
  }

  public getEnemiesInArea(x: number, y: number, radius: number): Enemy[] {
    return this.enemies.filter(enemy => enemy.checkCollision(x, y, radius))
  }

  public pauseAllEnemies() {
    this.enemies.forEach(enemy => enemy.pauseMovement())
  }

  public resumeAllEnemies() {
    this.enemies.forEach(enemy => enemy.resumeMovement())
  }

  private checkEnemyPositions() {
    // 家に近すぎる敵をチェックして削除
    const houseRadius = 25 // 家の周囲25ピクセル以内
    
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      const distance = Phaser.Math.Distance.Between(
        enemy.x, enemy.y, 
        this.playerHouseX, this.playerHouseY
      )
      
      if (distance <= houseRadius) {
        // 敵が家に到達したとみなす - タコの基本点分を減算
        this.scene.events.emit('player-damaged', enemy.scoreValue)
        
        // 敵を削除
        this.enemies.splice(i, 1)
        enemy.destroy()
      }
    }
  }

  private onEnemyReachedHouse(enemy: Enemy) {
    // 敵が家に到達した時の処理 - タコの基本点分を減算
    this.scene.events.emit('player-damaged', enemy.scoreValue)
    
    // 敵を削除
    const index = this.enemies.indexOf(enemy)
    if (index > -1) {
      this.enemies.splice(index, 1)
    }
    enemy.destroy()
  }

  public getEnemyCount(): number {
    return this.enemies.length
  }

  public getEnemyAtPosition(x: number, y: number, radius: number = 25): Enemy | null {
    // 指定した座標にある敵を探す（ズーム判定用なので敵の実際のサイズに近づける）
    for (const enemy of this.enemies) {
      if (enemy.checkCollision(x, y, radius)) {
        return enemy
      }
    }
    return null
  }

  public clearAllEnemies(): number {
    let totalScore = 0
    this.enemies.forEach(enemy => {
      totalScore += enemy.scoreValue
      enemy.destroy()
    })
    this.enemies = []
    return totalScore
  }

  public addDecoyTarget(x: number, y: number, range: number, decoyNumber: number) {
    this.decoyTargets.set(decoyNumber, { x, y, range })
    
    // 既存の敵の標的を更新
    this.updateEnemyTargets()
  }

  public removeDecoyTarget(decoyNumber: number) {
    this.decoyTargets.delete(decoyNumber)
    
    // 敵の標的を更新
    this.updateEnemyTargets()
  }

  public clearAllDecoyTargets() {
    this.decoyTargets.clear()
    
    // すべての敵を元の標的（家）に戻す
    this.enemies.forEach(enemy => {
      enemy.setTarget(this.playerHouseX, this.playerHouseY)
    })
  }

  private updateEnemyTargets() {
    this.enemies.forEach(enemy => {
      this.updateSingleEnemyTarget(enemy)
    })
  }

  private updateSingleEnemyTarget(enemy: Enemy) {
    // 最も近い分身を探す
    let closestDecoy: { x: number; y: number; range: number } | null = null
    let minDistance = Infinity
    
    this.decoyTargets.forEach(decoy => {
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, decoy.x, decoy.y)
      if (distance <= decoy.range && distance < minDistance) {
        minDistance = distance
        closestDecoy = decoy
      }
    })
    
    if (closestDecoy) {
      enemy.setTarget(closestDecoy.x, closestDecoy.y)
    } else {
      enemy.setTarget(this.playerHouseX, this.playerHouseY)
    }
  }

  private hasValidPath(startX: number, startY: number, endX: number, endY: number, enemyType: string): boolean {
    // 簡易パス検証（A*の簡略版）
    const openSet: Array<{x: number, y: number, g: number, h: number, f: number}> = []
    const closedSet = new Set<string>()
    
    const start = {
      x: startX,
      y: startY,
      g: 0,
      h: Math.abs(endX - startX) + Math.abs(endY - startY),
      f: 0
    }
    start.f = start.g + start.h
    openSet.push(start)

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f)
      const current = openSet.shift()!
      
      if (current.x === endX && current.y === endY) {
        return true // パスが見つかった
      }
      
      closedSet.add(`${current.x},${current.y}`)
      
      const neighbors = [
        {x: current.x + 1, y: current.y},
        {x: current.x - 1, y: current.y},
        {x: current.x, y: current.y + 1},
        {x: current.x, y: current.y - 1}
      ]
      
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`
        
        if (!this.canMoveToTile(neighbor.x, neighbor.y, enemyType) || closedSet.has(neighborKey)) {
          continue
        }
        
        const g = current.g + 1
        const h = Math.abs(endX - neighbor.x) + Math.abs(endY - neighbor.y)
        const f = g + h
        
        const existingNode = openSet.find(node => node.x === neighbor.x && node.y === neighbor.y)
        if (existingNode && existingNode.g <= g) {
          continue
        }
        
        if (existingNode) {
          existingNode.g = g
          existingNode.f = f
        } else {
          openSet.push({ x: neighbor.x, y: neighbor.y, g: g, h: h, f: f })
        }
      }
      
      // 探索制限（無限ループ防止）
      if (openSet.length > 100) {
        break
      }
    }

    return false // パスが見つからない
  }

  private canMoveToTile(tileX: number, tileY: number, enemyType: string): boolean {
    if (!this.mapPanels || 
        tileX < 0 || tileX >= this.mapPanels.length ||
        tileY < 0 || tileY >= this.mapPanels[0].length) {
      return false
    }

    const panel = this.mapPanels[tileX][tileY]
    if (!panel) return false

    // 敵タイプに応じた移動制限
    switch (enemyType) {
      case 'ground':
        return panel.type === 'path' || panel.type === 'rail' || panel.type === 'player_house'
      case 'water':
        return panel.type === 'water' || panel.type === 'player_house'
      case 'underground':
        return panel.type === 'rice_field' || panel.type === 'path' || panel.type === 'player_house'
      case 'air':
        return true // 制限なし
      default:
        return false
    }
  }

  public destroy() {
    this.stopSpawning()
    this.clearAllEnemies()
    this.scene.events.off('enemy-reached-house', this.onEnemyReachedHouse, this)
  }
}