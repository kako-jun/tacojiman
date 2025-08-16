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
    
    // 2. 他人の家を2つバラけて配置
    this.placeOtherHouses()
    
    // 3. 駅を配置
    this.placeStation()
    
    // 4. 駅から線路を伸ばす
    this.generateRailFromStation()
    
    // 5. 残った場所に水辺を配置
    this.generateWaterClusters()
    
    // 6. 残った場所に自宅につながるあぜ道を画面端から2つ配置
    this.generatePathsToHouse()
    
    // 7. 最後に残りを田んぼで埋める
    this.fillWithRiceFields()
    
    // 8. 接続情報を更新
    this.updateAllConnections()
    
    return this.mapData as MapPanel[][]
  }
  
  private placePlayerHouse() {
    const centerX = Math.floor(this.mapData.length / 2)
    const centerY = Math.floor(this.mapData[0].length / 2)
    
    // 自宅を十字路に面した位置に配置（交差点の右上）
    const houseX = centerX + 1
    const houseY = centerY - 1
    
    this.mapData[houseX][houseY] = {
      x: houseX,
      y: houseY,
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
    let attempts = 0
    const maxAttempts = 100
    
    do {
      stationX = Math.floor(Math.random() * tilesX)
      stationY = Math.floor(Math.random() * tilesY)
      attempts++
    } while (
      attempts < maxAttempts && (
        Math.abs(stationX - centerX) < 3 || 
        Math.abs(stationY - centerY) < 3 ||
        this.mapData[stationX][stationY] !== null ||
        !this.canPlaceStation(stationX, stationY)
      )
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
    
    // 蛸島駅は終点なので、1つの方向にのみ線路を伸ばす
    const direction = Math.floor(Math.random() * 4) // 0:北, 1:東, 2:南, 3:西
    const length = Math.floor(Math.random() * 5) + 4 // 4-8マス（終点らしく長めに）
    
    const dx = [0, 1, 0, -1][direction]
    const dy = [-1, 0, 1, 0][direction]
    
    let lastValidX = stationX
    let lastValidY = stationY
    
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
          connections: this.calculateTerminalRailConnections(railX, railY, dx, dy, i, length)
        }
        
        lastValidX = railX
        lastValidY = railY
        
        // 駅との接続（最初のレールのみ）
        if (i === 1) {
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
  
  private calculateTerminalRailConnections(x: number, y: number, dx: number, dy: number, currentIndex: number, totalLength: number): PanelConnections {
    const connections: PanelConnections = {
      north: false,
      south: false,
      east: false,
      west: false
    }
    
    // 駅方向への接続（常にあり）
    if (dx === 1) connections.west = true
    if (dx === -1) connections.east = true
    if (dy === 1) connections.north = true
    if (dy === -1) connections.south = true
    
    // 終点以外は進行方向にも接続
    if (currentIndex < totalLength) {
      if (dx === 1) connections.east = true
      if (dx === -1) connections.west = true
      if (dy === 1) connections.south = true
      if (dy === -1) connections.north = true
    }
    // 終点の場合は片方向のみの接続（駅方向のみ）
    
    return connections
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
  
  private generatePathsToHouse() {
    // 確実に家まで到達可能な十字路パスを生成
    this.generateGuaranteedPaths()
  }

  private generateGuaranteedPaths() {
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    const centerX = Math.floor(tilesX / 2)
    const centerY = Math.floor(tilesY / 2)
    
    // 1. 画面中央に縦のあぜ道を作成（上端から下端まで）
    for (let y = 0; y < tilesY; y++) {
      if (this.mapData[centerX][y] === null) {
        this.mapData[centerX][y] = {
          x: centerX,
          y: y,
          type: 'path',
          connections: { north: false, south: false, east: false, west: false }
        }
      }
    }
    
    // 2. 画面中央に横のあぜ道を作成（左端から右端まで）
    for (let x = 0; x < tilesX; x++) {
      if (this.mapData[x][centerY] === null) {
        this.mapData[x][centerY] = {
          x: x,
          y: centerY,
          type: 'path',
          connections: { north: false, south: false, east: false, west: false }
        }
      }
    }
    
    // 3. 自宅は既にplacePlayerHouse()で配置済みなのでスキップ
    
    // 4. 水路を自宅の近くに作成（自宅から1マス離れた位置）
    const waterOffsetX = centerX + 2 // 自宅から1マス右
    const waterOffsetY = centerY + 2 // 自宅から2マス下
    
    // 縦の水路
    for (let y = 0; y < tilesY; y++) {
      if (this.mapData[waterOffsetX][y] === null) {
        this.mapData[waterOffsetX][y] = {
          x: waterOffsetX,
          y: y,
          type: 'water',
          connections: { north: false, south: false, east: false, west: false }
        }
      }
    }
    
    // 横の水路
    for (let x = 0; x < tilesX; x++) {
      if (this.mapData[x][waterOffsetY] === null) {
        this.mapData[x][waterOffsetY] = {
          x: x,
          y: waterOffsetY,
          type: 'water',
          connections: { north: false, south: false, east: false, west: false }
        }
      }
    }
  }

  private updateAllConnections() {
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    
    for (let x = 0; x < tilesX; x++) {
      for (let y = 0; y < tilesY; y++) {
        const panel = this.mapData[x][y]
        if (panel) {
          this.updatePanelConnections(x, y)
        }
      }
    }
  }

  private updatePanelConnections(x: number, y: number) {
    const panel = this.mapData[x][y]
    if (!panel) return

    const connections = { north: false, south: false, east: false, west: false }

    // 同じタイプの隣接パネルとの接続をチェック
    if (y > 0 && this.mapData[x][y - 1]?.type === panel.type) {
      connections.north = true
    }
    if (y < this.mapData[0].length - 1 && this.mapData[x][y + 1]?.type === panel.type) {
      connections.south = true
    }
    if (x > 0 && this.mapData[x - 1][y]?.type === panel.type) {
      connections.west = true
    }
    if (x < this.mapData.length - 1 && this.mapData[x + 1][y]?.type === panel.type) {
      connections.east = true
    }

    // 地上タコの場合はpathとrailの相互接続も許可
    if (panel.type === 'path') {
      if (y > 0 && this.mapData[x][y - 1]?.type === 'rail') connections.north = true
      if (y < this.mapData[0].length - 1 && this.mapData[x][y + 1]?.type === 'rail') connections.south = true
      if (x > 0 && this.mapData[x - 1][y]?.type === 'rail') connections.west = true
      if (x < this.mapData.length - 1 && this.mapData[x + 1][y]?.type === 'rail') connections.east = true
    }
    if (panel.type === 'rail') {
      if (y > 0 && this.mapData[x][y - 1]?.type === 'path') connections.north = true
      if (y < this.mapData[0].length - 1 && this.mapData[x][y + 1]?.type === 'path') connections.south = true
      if (x > 0 && this.mapData[x - 1][y]?.type === 'path') connections.west = true
      if (x < this.mapData.length - 1 && this.mapData[x + 1][y]?.type === 'path') connections.east = true
    }

    panel.connections = connections
  }
  
  private generateSinglePathToHouse() {
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    const centerX = Math.floor(tilesX / 2)
    const centerY = Math.floor(tilesY / 2)
    
    // ランダムな開始端を選択
    const startEdge = Math.floor(Math.random() * 4) // 0:上, 1:右, 2:下, 3:左
    // 終了端は開始端と異なる端を選択
    let endEdge
    do {
      endEdge = Math.floor(Math.random() * 4)
    } while (endEdge === startEdge)
    
    let startX, startY, endX, endY
    
    // 開始位置（端）
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
      default:
        startX = 0
        startY = 0
    }
    
    // 終了位置（反対端）
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
      default:
        endX = tilesX - 1
        endY = tilesY - 1
    }
    
    // 端から端まで、自宅横を通過する経路作成
    this.createPathThroughHouse(startX!, startY!, endX!, endY!, centerX, centerY)
  }
  
  private createPathThroughHouse(startX: number, startY: number, endX: number, endY: number, centerX: number, centerY: number) {
    // 家を通過する3ポイントルート：開始点 → 家付近 → 終了点
    const houseApproachDistance = 2 // 家から2マス離れた位置を通過
    
    // 家の周辺で通過するポイントを計算
    const houseX = centerX + (Math.random() - 0.5) * 4 // 家の±2マス範囲
    const houseY = centerY + (Math.random() - 0.5) * 4
    
    // 開始点から家付近まで
    this.createPathBetween(startX, startY, houseX, houseY)
    
    // 家付近から終了点まで
    this.createPathBetween(houseX, houseY, endX, endY)
  }

  private createPathBetween(startX: number, startY: number, endX: number, endY: number) {
    // 座標を整数に変換し、境界内に制限
    let currentX = Math.floor(Math.max(0, Math.min(this.mapData.length - 1, startX)))
    let currentY = Math.floor(Math.max(0, Math.min(this.mapData[0].length - 1, startY)))
    endX = Math.floor(Math.max(0, Math.min(this.mapData.length - 1, endX)))
    endY = Math.floor(Math.max(0, Math.min(this.mapData[0].length - 1, endY)))
    
    const visited = new Set<string>()
    const maxIterations = 1000 // 無限ループ防止
    let iterations = 0
    
    while ((currentX !== endX || currentY !== endY) && iterations < maxIterations) {
      iterations++
      
      // 境界チェック
      if (currentX < 0 || currentX >= this.mapData.length || 
          currentY < 0 || currentY >= this.mapData[0].length) {
        break
      }
      
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
    
    // 最終地点もあぜ道に（境界チェック付き）
    if (endX >= 0 && endX < this.mapData.length && 
        endY >= 0 && endY < this.mapData[0].length &&
        this.mapData[endX][endY] === null) {
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
    // 蛸島は海と川のみ（池なし）
    // 1. 端から海を生成
    this.generateSeaFromEdge()
    // 2. 海から川を内陸に向けて生成
    this.generateRiversFromSea()
    
    // 水パネルの接続を更新
    this.updateWaterConnections()
  }
  
  private generateSeaFromEdge() {
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    
    // ランダムな端を選択（海はマップの端から始まる）
    const seaEdge = Math.floor(Math.random() * 4) // 0:上, 1:右, 2:下, 3:左
    const seaLength = Math.floor(Math.random() * 12) + 8 // 海岸線の長さを増加（8-19）
    
    let startPositions: { x: number; y: number }[] = []
    
    // 海岸線の開始位置を生成
    switch (seaEdge) {
      case 0: // 上端
        for (let i = 0; i < seaLength; i++) {
          const x = Math.floor(Math.random() * tilesX)
          startPositions.push({ x, y: 0 })
        }
        break
      case 1: // 右端
        for (let i = 0; i < seaLength; i++) {
          const y = Math.floor(Math.random() * tilesY)
          startPositions.push({ x: tilesX - 1, y })
        }
        break
      case 2: // 下端
        for (let i = 0; i < seaLength; i++) {
          const x = Math.floor(Math.random() * tilesX)
          startPositions.push({ x, y: tilesY - 1 })
        }
        break
      case 3: // 左端
        for (let i = 0; i < seaLength; i++) {
          const y = Math.floor(Math.random() * tilesY)
          startPositions.push({ x: 0, y })
        }
        break
    }
    
    // 海岸線から内陸に2-3マス海を広げる
    for (const startPos of startPositions) {
      this.expandSeaInland(startPos.x, startPos.y, seaEdge)
    }
  }
  
  private expandSeaInland(startX: number, startY: number, direction: number) {
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    const centerX = Math.floor(tilesX / 2)
    const centerY = Math.floor(tilesY / 2)
    
    // 中心までの距離に応じて海の深度を決定（中心に近いほど深く）
    const distanceToCenter = Math.max(
      Math.abs(startX - centerX), 
      Math.abs(startY - centerY)
    )
    const maxDepth = Math.max(5, Math.floor(distanceToCenter * 0.6)) // より深く侵入
    const inlandDepth = Math.floor(Math.random() * 4) + 3 // 3-6マス内陸（より深く）
    const actualDepth = Math.min(inlandDepth, maxDepth)
    
    // 内陸方向のベクトル
    const inlandDx = [0, -1, 0, 1][direction] // 上->下, 右->左, 下->上, 左->右
    const inlandDy = [1, 0, -1, 0][direction]
    
    for (let depth = 0; depth < actualDepth; depth++) {
      const seaX = startX + inlandDx * depth
      const seaY = startY + inlandDy * depth
      
      if (seaX >= 0 && seaX < tilesX && seaY >= 0 && seaY < tilesY &&
          this.mapData[seaX][seaY] === null) {
        this.mapData[seaX][seaY] = {
          x: seaX,
          y: seaY,
          type: 'water',
          connections: { north: false, south: false, east: false, west: false }
        }
      }
    }
  }
  
  private generateRiversFromSea() {
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    const centerX = Math.floor(tilesX / 2)
    const centerY = Math.floor(tilesY / 2)
    
    // 海パネルを探す
    const seaPanels: { x: number; y: number }[] = []
    for (let x = 0; x < tilesX; x++) {
      for (let y = 0; y < tilesY; y++) {
        if (this.mapData[x][y]?.type === 'water') {
          seaPanels.push({ x, y })
        }
      }
    }
    
    if (seaPanels.length === 0) return
    
    // 1本目の川は必ず自宅横まで到達させる
    const startSea = seaPanels[Math.floor(Math.random() * seaPanels.length)]
    this.createRiverToHouse(startSea.x, startSea.y, centerX, centerY)
    
    // 追加で1本の川をランダムに生成
    if (seaPanels.length > 0) {
      const additionalSea = seaPanels[Math.floor(Math.random() * seaPanels.length)]
      this.createRiverFromSea(additionalSea.x, additionalSea.y)
    }
  }
  
  private createRiverToHouse(startX: number, startY: number, houseX: number, houseY: number) {
    // 自宅の隣接位置をランダムに選択
    const houseAdjacentPositions = [
      { x: houseX, y: houseY - 1 }, // 北
      { x: houseX + 1, y: houseY }, // 東
      { x: houseX, y: houseY + 1 }, // 南
      { x: houseX - 1, y: houseY }  // 西
    ]
    
    // あぜ道と被らない位置を選択
    let riverEndPos = houseAdjacentPositions[0] // デフォルト
    for (const pos of houseAdjacentPositions) {
      if (pos.x >= 0 && pos.x < this.mapData.length &&
          pos.y >= 0 && pos.y < this.mapData[0].length &&
          this.mapData[pos.x][pos.y] === null) {
        riverEndPos = pos
        break
      }
    }
    
    // 海から自宅横まで川を作成
    this.createWaterPathBetween(startX, startY, riverEndPos.x, riverEndPos.y)
  }
  
  private createWaterPathBetween(startX: number, startY: number, endX: number, endY: number) {
    let currentX = startX
    let currentY = startY
    const visited = new Set<string>()
    const maxIterations = 100
    let iterations = 0
    
    while ((currentX !== endX || currentY !== endY) && iterations < maxIterations) {
      iterations++
      visited.add(`${currentX},${currentY}`)
      
      // 既に水パネルでない場合のみ配置
      if (this.mapData[currentX][currentY] === null) {
        this.mapData[currentX][currentY] = {
          x: currentX,
          y: currentY,
          type: 'water',
          connections: { north: false, south: false, east: false, west: false }
        }
      }
      
      // 次の移動方向を決定（目的地に向かって）
      const dx = endX - currentX
      const dy = endY - currentY
      
      // 目的地へ向かう優先度70%、ランダム30%
      if (Math.random() < 0.7) {
        if (Math.abs(dx) > Math.abs(dy)) {
          currentX += Math.sign(dx)
        } else {
          currentY += Math.sign(dy)
        }
      } else {
        // 30%の確率でランダムな方向へ（蛇行効果）
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
        // 別のルートを試す
        const directions = [
          { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, 
          { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
        ]
        const randomDir = directions[Math.floor(Math.random() * directions.length)]
        currentX = Math.max(0, Math.min(this.mapData.length - 1, currentX + randomDir.dx))
        currentY = Math.max(0, Math.min(this.mapData[0].length - 1, currentY + randomDir.dy))
      }
    }
    
    // 最終地点も水に
    if (endX >= 0 && endX < this.mapData.length && 
        endY >= 0 && endY < this.mapData[0].length &&
        this.mapData[endX][endY] === null) {
      this.mapData[endX][endY] = {
        x: endX,
        y: endY,
        type: 'water',
        connections: { north: false, south: false, east: false, west: false }
      }
    }
  }

  private createRiverFromSea(startX: number, startY: number) {
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    const riverLength = Math.floor(Math.random() * 6) + 4 // 4-9マスの川
    
    let currentX = startX
    let currentY = startY
    const visited = new Set<string>()
    
    for (let i = 0; i < riverLength; i++) {
      visited.add(`${currentX},${currentY}`)
      
      // 次の位置を内陸方向に向けて選択
      const directions = [
        { dx: 0, dy: -1 }, // 北
        { dx: 1, dy: 0 },  // 東
        { dx: 0, dy: 1 },  // 南
        { dx: -1, dy: 0 }  // 西
      ]
      
      // 利用可能な方向をフィルタ
      const validDirections = directions.filter(dir => {
        const newX = currentX + dir.dx
        const newY = currentY + dir.dy
        return newX >= 0 && newX < tilesX && 
               newY >= 0 && newY < tilesY &&
               this.mapData[newX][newY] === null &&
               !visited.has(`${newX},${newY}`)
      })
      
      if (validDirections.length === 0) break
      
      // ランダムな方向を選択
      const chosenDir = validDirections[Math.floor(Math.random() * validDirections.length)]
      currentX += chosenDir.dx
      currentY += chosenDir.dy
      
      // 川パネルを配置
      this.mapData[currentX][currentY] = {
        x: currentX,
        y: currentY,
        type: 'water',
        connections: { north: false, south: false, east: false, west: false }
      }
    }
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
    const maxAttempts = 200
    let attempts = 0
    
    while (housesPlaced < 2 && attempts < maxAttempts) {
      attempts++
      
      const houseX = Math.floor(Math.random() * tilesX)
      const houseY = Math.floor(Math.random() * tilesY)
      
      // 自分の家から最低2マス離れた場所に配置
      if (Math.abs(houseX - centerX) < 3 || Math.abs(houseY - centerY) < 3) continue
      if (this.mapData[houseX][houseY] !== null) continue
      
      // 他の家との距離チェック（最低2マス離す）
      if (!this.canPlaceHouse(houseX, houseY)) continue
      
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
  
  private canPlaceStation(x: number, y: number): boolean {
    // 周囲2マス以内に家がないかチェック
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const checkX = x + dx
        const checkY = y + dy
        
        if (checkX >= 0 && checkX < this.mapData.length &&
            checkY >= 0 && checkY < this.mapData[0].length) {
          const panel = this.mapData[checkX][checkY]
          if (panel && (panel.type === 'player_house' || panel.type === 'other_house')) {
            return false
          }
        }
      }
    }
    return true
  }
  
  private canPlaceHouse(x: number, y: number): boolean {
    // 周囲2マス以内に他の家や駅がないかチェック
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const checkX = x + dx
        const checkY = y + dy
        
        if (checkX >= 0 && checkX < this.mapData.length &&
            checkY >= 0 && checkY < this.mapData[0].length) {
          const panel = this.mapData[checkX][checkY]
          if (panel && (panel.type === 'player_house' || panel.type === 'other_house' || panel.type === 'station')) {
            return false
          }
        }
      }
    }
    return true
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