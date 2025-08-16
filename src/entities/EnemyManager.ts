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

  constructor(scene: Phaser.Scene, houseX: number, houseY: number, mapWidth: number, mapHeight: number) {
    this.scene = scene
    this.playerHouseX = houseX
    this.playerHouseY = houseY
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight

    // 敵が家に到達した時のイベントリスナー
    this.scene.events.on('enemy-reached-house', this.onEnemyReachedHouse, this)
  }

  public startSpawning() {
    this.spawnTimer = this.scene.time.addEvent({
      delay: 2000, // 2秒ごと
      callback: this.spawnRandomEnemy,
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

  private spawnRandomEnemy() {
    if (this.enemies.length >= 50) return // 最大50匹制限

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
      this.playerHouseY
    )

    this.enemies.push(enemy)
  }

  private getRandomEnemyType(): EnemyType {
    const types: EnemyType[] = ['ground', 'water', 'air', 'underground']
    const weights = [0.3, 0.25, 0.25, 0.2] // 道路歩行型が最も多い
    
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
    const margin = 30
    
    switch (enemyType) {
      case 'ground':
        // 道路歩行型：画面端から
        return Math.random() < 0.5 ? 
          { x: -margin, y: Math.random() * this.mapHeight } :
          { x: this.mapWidth + margin, y: Math.random() * this.mapHeight }
      
      case 'water':
        // 海上遡上型：上端から
        return { x: Math.random() * this.mapWidth, y: -margin }
      
      case 'air':
        // 空挺降下型：空から（上端のさらに上）
        return { x: Math.random() * this.mapWidth, y: -margin * 2 }
      
      case 'underground':
        // 地下掘削型：家の近くに突然出現
        const angle = Math.random() * Math.PI * 2
        const distance = 80 + Math.random() * 100 // 家から80-180ピクセル離れた場所
        return {
          x: this.playerHouseX + Math.cos(angle) * distance,
          y: this.playerHouseY + Math.sin(angle) * distance
        }
      
      default:
        return { x: 0, y: 0 }
    }
  }

  public checkAttackHit(x: number, y: number, radius: number = 15): { hit: boolean; score: number; enemy?: Enemy } {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      if (enemy.checkCollision(x, y, radius)) {
        const result = enemy.takeDamage(1)
        
        if (result.destroyed) {
          this.enemies.splice(i, 1)
        }
        
        return { hit: true, score: result.score, enemy }
      }
    }
    
    return { hit: false, score: 0 }
  }

  public checkBombHit(x: number, y: number, radius: number, damage: number = 1): number {
    let totalScore = 0
    
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      if (enemy.checkCollision(x, y, radius)) {
        const result = enemy.takeDamage(damage)
        totalScore += result.score
        
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

  private onEnemyReachedHouse(enemy: Enemy) {
    // 敵が家に到達した時の処理
    this.scene.events.emit('player-damaged', 10) // 10ポイント減点
    
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

  public clearAllEnemies(): number {
    let totalScore = 0
    this.enemies.forEach(enemy => {
      totalScore += enemy.scoreValue
      enemy.destroy()
    })
    this.enemies = []
    return totalScore
  }

  public destroy() {
    this.stopSpawning()
    this.clearAllEnemies()
    this.scene.events.off('enemy-reached-house', this.onEnemyReachedHouse, this)
  }
}