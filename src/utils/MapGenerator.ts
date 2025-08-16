import { MapPanel, PanelType, PanelConnections, PANEL_CONFIG } from '@/types/MapTypes'

export class MapGenerator {
  private mapWidth: number
  private mapHeight: number
  private tileSize: number
  private mapData: (MapPanel | null)[][]
  
  constructor(mapWidth: number, mapHeight: number, tileSize: number = 60) {
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
    this.tileSize = tileSize
    
    const tilesX = Math.ceil(mapWidth / tileSize)
    const tilesY = Math.ceil(mapHeight / tileSize)
    
    // マップデータの初期化
    this.mapData = Array(tilesX).fill(null).map(() => Array(tilesY).fill(null))
  }
  
  public generateMap(): MapPanel[][] {
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    
    // 1. 自分の家を中央に配置
    this.placePlayerHouse()
    
    // 2. 駅を配置
    this.placeStation()
    
    // 3. 駅から線路を伸ばす
    this.generateRailFromStation()
    
    // 4. あぜ道を端から端へ生成
    this.generatePath()
    
    // 5. 水パネルをクラスター生成
    this.generateWaterClusters()
    
    // 6. 他人の家を2つ配置
    this.placeOtherHouses()
    
    // 7. 残りを田んぼで埋める
    this.fillWithRiceFields()
    
    return this.mapData as MapPanel[][]
  }
  
  private placePlayerHouse() {
    const centerX = Math.floor(this.mapData.length / 2)
    const centerY = Math.floor(this.mapData[0].length / 2)
    
    this.mapData[centerX][centerY] = {
      x: centerX,
      y: centerY,
      type: 'player_house',
      connections: { north: false, south: false, east: false, west: false }
    }
  }
  
  private placeStation() {
    // ランダムな位置に駅を配置（中央から離れた場所）
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    const centerX = Math.floor(tilesX / 2)
    const centerY = Math.floor(tilesY / 2)
    
    let stationX, stationY
    do {
      stationX = Math.floor(Math.random() * tilesX)
      stationY = Math.floor(Math.random() * tilesY)
    } while (
      Math.abs(stationX - centerX) < 3 || 
      Math.abs(stationY - centerY) < 3 ||
      this.mapData[stationX][stationY] !== null
    )
    
    this.mapData[stationX][stationY] = {
      x: stationX,
      y: stationY,
      type: 'station',
      connections: { north: false, south: false, east: false, west: false }
    }
  }
  
  private generateRailFromStation() {
    // 駅の位置を見つける
    let stationX = -1, stationY = -1
    for (let x = 0; x < this.mapData.length; x++) {
      for (let y = 0; y < this.mapData[0].length; y++) {
        if (this.mapData[x][y]?.type === 'station') {
          stationX = x
          stationY = y
          break
        }
      }
      if (stationX >= 0) break
    }
    
    if (stationX < 0) return
    
    // ランダムな方向に線路を伸ばす
    const direction = Math.floor(Math.random() * 4) // 0:北, 1:東, 2:南, 3:西
    const length = Math.floor(Math.random() * 4) + 3 // 3-6マス
    
    const dx = [0, 1, 0, -1][direction]
    const dy = [-1, 0, 1, 0][direction]
    
    for (let i = 1; i <= length; i++) {
      const railX = stationX + dx * i
      const railY = stationY + dy * i
      
      if (railX >= 0 && railX < this.mapData.length &&
          railY >= 0 && railY < this.mapData[0].length &&
          this.mapData[railX][railY] === null) {
        
        this.mapData[railX][railY] = {
          x: railX,
          y: railY,
          type: 'rail',
          connections: this.calculateRailConnections(railX, railY, dx, dy)
        }
        
        // 前のパネルとの接続を更新
        if (i === 1) {
          // 駅との接続
          const station = this.mapData[stationX][stationY]!
          if (dx === 1) station.connections.east = true
          if (dx === -1) station.connections.west = true
          if (dy === 1) station.connections.south = true
          if (dy === -1) station.connections.north = true
        }
      } else {
        break
      }
    }
  }
  
  private calculateRailConnections(x: number, y: number, dx: number, dy: number): PanelConnections {
    const connections: PanelConnections = {
      north: false,
      south: false,
      east: false,
      west: false
    }
    
    // 進行方向の逆側に接続
    if (dx === 1) connections.west = true
    if (dx === -1) connections.east = true
    if (dy === 1) connections.north = true
    if (dy === -1) connections.south = true
    
    // 進行方向に接続（次のパネルがある場合）
    if (dx === 1) connections.east = true
    if (dx === -1) connections.west = true
    if (dy === 1) connections.south = true
    if (dy === -1) connections.north = true
    
    return connections
  }
  
  private generatePath() {
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    
    // ランダムな端から開始
    const startEdge = Math.floor(Math.random() * 4) // 0:上, 1:右, 2:下, 3:左
    const endEdge = (startEdge + 2) % 4 // 反対側の端
    
    let startX, startY, endX, endY
    
    // 開始位置
    switch (startEdge) {
      case 0: // 上端
        startX = Math.floor(Math.random() * tilesX)
        startY = 0
        break
      case 1: // 右端
        startX = tilesX - 1
        startY = Math.floor(Math.random() * tilesY)
        break
      case 2: // 下端
        startX = Math.floor(Math.random() * tilesX)
        startY = tilesY - 1
        break
      case 3: // 左端
        startX = 0
        startY = Math.floor(Math.random() * tilesY)
        break
    }
    
    // 終了位置
    switch (endEdge) {
      case 0: // 上端
        endX = Math.floor(Math.random() * tilesX)
        endY = 0
        break
      case 1: // 右端
        endX = tilesX - 1
        endY = Math.floor(Math.random() * tilesY)
        break
      case 2: // 下端
        endX = Math.floor(Math.random() * tilesX)
        endY = tilesY - 1
        break
      case 3: // 左端
        endX = 0
        endY = Math.floor(Math.random() * tilesY)
        break
    }
    
    // 簡単な経路探索（A*の簡略版）
    this.createPathBetween(startX!, startY!, endX!, endY!)
  }
  
  private createPathBetween(startX: number, startY: number, endX: number, endY: number) {
    let currentX = startX
    let currentY = startY
    const visited = new Set<string>()
    
    while (currentX !== endX || currentY !== endY) {
      // 現在位置をあぜ道に設定
      if (this.mapData[currentX][currentY] === null) {
        this.mapData[currentX][currentY] = {
          x: currentX,
          y: currentY,
          type: 'path',
          connections: { north: false, south: false, east: false, west: false }
        }
      }
      
      visited.add(`${currentX},${currentY}`)
      
      // 次の移動方向を決定（目的地に向かって）
      const dx = endX - currentX
      const dy = endY - currentY
      
      // ランダム性を加えつつ目的地へ向かう
      if (Math.random() < 0.7) {
        if (Math.abs(dx) > Math.abs(dy)) {
          currentX += Math.sign(dx)
        } else {
          currentY += Math.sign(dy)
        }
      } else {
        // 30%の確率でランダムな方向へ
        if (Math.random() < 0.5 && dx !== 0) {
          currentX += Math.sign(dx)
        } else if (dy !== 0) {
          currentY += Math.sign(dy)
        }
      }
      
      // 境界チェック
      currentX = Math.max(0, Math.min(this.mapData.length - 1, currentX))
      currentY = Math.max(0, Math.min(this.mapData[0].length - 1, currentY))
      
      // 無限ループ防止
      if (visited.has(`${currentX},${currentY}`)) {
        break
      }
    }
    
    // 最終地点もあぜ道に
    if (this.mapData[endX][endY] === null) {
      this.mapData[endX][endY] = {
        x: endX,
        y: endY,
        type: 'path',
        connections: { north: false, south: false, east: false, west: false }
      }
    }
    
    // 接続情報を更新
    this.updatePathConnections()
  }
  
  private updatePathConnections() {
    for (let x = 0; x < this.mapData.length; x++) {
      for (let y = 0; y < this.mapData[0].length; y++) {
        const panel = this.mapData[x][y]
        if (panel && panel.type === 'path') {
          // 隣接するあぜ道をチェック
          if (x > 0 && this.mapData[x - 1][y]?.type === 'path') {
            panel.connections.west = true
          }
          if (x < this.mapData.length - 1 && this.mapData[x + 1][y]?.type === 'path') {
            panel.connections.east = true
          }
          if (y > 0 && this.mapData[x][y - 1]?.type === 'path') {
            panel.connections.north = true
          }
          if (y < this.mapData[0].length && this.mapData[x][y + 1]?.type === 'path') {
            panel.connections.south = true
          }
        }
      }
    }
  }
  
  private generateWaterClusters() {
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    const waterCount = Math.floor(tilesX * tilesY * PANEL_CONFIG.water.frequency)
    
    let placed = 0
    const maxAttempts = 100
    let attempts = 0
    
    while (placed < waterCount && attempts < maxAttempts) {
      attempts++
      
      // ランダムな開始位置
      const startX = Math.floor(Math.random() * tilesX)
      const startY = Math.floor(Math.random() * tilesY)
      
      if (this.mapData[startX][startY] !== null) continue
      
      // クラスターサイズ
      const clusterSize = Math.floor(Math.random() * 
        (PANEL_CONFIG.water.clusterMax - PANEL_CONFIG.water.clusterMin + 1)) + 
        PANEL_CONFIG.water.clusterMin
      
      // クラスター生成
      const cluster: [number, number][] = [[startX, startY]]
      this.mapData[startX][startY] = {
        x: startX,
        y: startY,
        type: 'water',
        connections: { north: false, south: false, east: false, west: false }
      }
      placed++
      
      // 隣接セルに広げる
      for (let i = 1; i < clusterSize && placed < waterCount; i++) {
        const [prevX, prevY] = cluster[cluster.length - 1]
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]]
        
        // ランダムな方向を試す
        for (let j = 0; j < directions.length; j++) {
          const dir = directions[Math.floor(Math.random() * directions.length)]
          const newX = prevX + dir[0]
          const newY = prevY + dir[1]
          
          if (newX >= 0 && newX < tilesX && newY >= 0 && newY < tilesY &&
              this.mapData[newX][newY] === null) {
            this.mapData[newX][newY] = {
              x: newX,
              y: newY,
              type: 'water',
              connections: { north: false, south: false, east: false, west: false }
            }
            cluster.push([newX, newY])
            placed++
            break
          }
        }
      }
    }
    
    // 水パネルの接続を更新
    this.updateWaterConnections()
  }
  
  private updateWaterConnections() {
    for (let x = 0; x < this.mapData.length; x++) {
      for (let y = 0; y < this.mapData[0].length; y++) {
        const panel = this.mapData[x][y]
        if (panel && panel.type === 'water') {
          // 隣接する水パネルをチェック
          if (x > 0 && this.mapData[x - 1][y]?.type === 'water') {
            panel.connections.west = true
          }
          if (x < this.mapData.length - 1 && this.mapData[x + 1][y]?.type === 'water') {
            panel.connections.east = true
          }
          if (y > 0 && this.mapData[x][y - 1]?.type === 'water') {
            panel.connections.north = true
          }
          if (y < this.mapData[0].length && this.mapData[x][y + 1]?.type === 'water') {
            panel.connections.south = true
          }
        }
      }
    }
  }
  
  private placeOtherHouses() {
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    const centerX = Math.floor(tilesX / 2)
    const centerY = Math.floor(tilesY / 2)
    
    let housesPlaced = 0
    const maxAttempts = 100
    let attempts = 0
    
    while (housesPlaced < 2 && attempts < maxAttempts) {
      attempts++
      
      const houseX = Math.floor(Math.random() * tilesX)
      const houseY = Math.floor(Math.random() * tilesY)
      
      // 中央から離れた場所に配置
      if (Math.abs(houseX - centerX) < 2 || Math.abs(houseY - centerY) < 2) continue
      if (this.mapData[houseX][houseY] !== null) continue
      
      this.mapData[houseX][houseY] = {
        x: houseX,
        y: houseY,
        type: 'other_house',
        connections: { north: false, south: false, east: false, west: false },
        isInvulnerable: true
      }
      housesPlaced++
    }
  }
  
  private fillWithRiceFields() {
    for (let x = 0; x < this.mapData.length; x++) {
      for (let y = 0; y < this.mapData[0].length; y++) {
        if (this.mapData[x][y] === null) {
          this.mapData[x][y] = {
            x: x,
            y: y,
            type: 'rice_field',
            connections: { north: false, south: false, east: false, west: false }
          }
        }
      }
    }
  }
}