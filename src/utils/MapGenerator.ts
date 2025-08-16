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
    
    // 2. 確実にパスが通る十字路システムを最初に配置（最優先）
    this.generateGuaranteedPaths()
    
    // 3. 他人の家を2つバラけて配置（十字路を避けて配置）
    this.placeOtherHouses()
    
    // 4. 駅を配置（十字路を避けて配置）
    this.placeStation()
    
    // 5. 駅から線路を伸ばす
    this.generateRailFromStation()
    
    // 6. 残った場所に田んぼで埋める
    this.fillWithRiceFields()
    
    // 7. 接続情報を更新
    this.updateAllConnections()
    
    return this.mapData as MapPanel[][]
  }
  
  private placePlayerHouse() {
    const centerX = Math.floor(this.mapData.length / 2)
    const centerY = Math.floor(this.mapData[0].length / 2)
    
    // 自宅を画面中央に配置
    this.mapData[centerX][centerY] = {
      x: centerX,
      y: centerY,
      type: 'player_house',
      connections: { north: false, south: false, east: false, west: false }
    }
  }
  
  private placeStation() {
    // 画面に見える範囲内で駅を配置（中央から適度に離れた場所）
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    const centerX = Math.floor(tilesX / 2)
    const centerY = Math.floor(tilesY / 2)
    
    // 画面表示範囲を考慮（マップサイズ * 1.4倍だが、見える範囲は元サイズ相当）
    const visibleRangeX = Math.floor(tilesX * 0.7) // 見える範囲の70%程度
    const visibleRangeY = Math.floor(tilesY * 0.7)
    
    let stationX, stationY
    let attempts = 0
    const maxAttempts = 100
    
    do {
      // 中央付近だが画面内に確実に見える範囲で配置
      const offsetX = Math.floor(Math.random() * visibleRangeX) - Math.floor(visibleRangeX / 2)
      const offsetY = Math.floor(Math.random() * visibleRangeY) - Math.floor(visibleRangeY / 2)
      
      stationX = centerX + offsetX
      stationY = centerY + offsetY
      
      // 境界チェック
      stationX = Math.max(2, Math.min(tilesX - 3, stationX))
      stationY = Math.max(2, Math.min(tilesY - 3, stationY))
      
      attempts++
    } while (
      attempts < maxAttempts && (
        Math.abs(stationX - centerX) < 2 || // 最低2マス離す
        Math.abs(stationY - centerY) < 2 ||
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
    
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    const centerX = Math.floor(tilesX / 2)
    const centerY = Math.floor(tilesY / 2)
    
    // 画面内に収まる方向を優先して選択
    const directions = [
      { dx: 0, dy: -1, name: '北' }, // 北
      { dx: 1, dy: 0, name: '東' },  // 東  
      { dx: 0, dy: 1, name: '南' },  // 南
      { dx: -1, dy: 0, name: '西' }  // 西
    ]
    
    // 各方向でどれだけ線路を伸ばせるかチェック
    let bestDirection = directions[0]
    let maxLength = 0
    
    for (const dir of directions) {
      let possibleLength = 0
      for (let i = 1; i <= 6; i++) { // 最大6マスチェック
        const railX = stationX + dir.dx * i
        const railY = stationY + dir.dy * i
        
        if (railX >= 1 && railX < tilesX - 1 &&
            railY >= 1 && railY < tilesY - 1 &&
            this.mapData[railX][railY] === null) {
          possibleLength = i
        } else {
          break
        }
      }
      
      if (possibleLength > maxLength) {
        maxLength = possibleLength
        bestDirection = dir
      }
    }
    
    // 選択した方向に線路を配置（3-5マス程度の適度な長さ）
    const railLength = Math.min(maxLength, Math.floor(Math.random() * 3) + 3) // 3-5マス
    
    for (let i = 1; i <= railLength; i++) {
      const railX = stationX + bestDirection.dx * i
      const railY = stationY + bestDirection.dy * i
      
      if (railX >= 0 && railX < tilesX &&
          railY >= 0 && railY < tilesY &&
          this.mapData[railX][railY] === null) {
        
        this.mapData[railX][railY] = {
          x: railX,
          y: railY,
          type: 'rail',
          connections: this.calculateTerminalRailConnections(railX, railY, bestDirection.dx, bestDirection.dy, i, railLength)
        }
        
        // 駅との接続（最初のレールのみ）
        if (i === 1) {
          const station = this.mapData[stationX][stationY]!
          if (bestDirection.dx === 1) station.connections.east = true
          if (bestDirection.dx === -1) station.connections.west = true
          if (bestDirection.dy === 1) station.connections.south = true
          if (bestDirection.dy === -1) station.connections.north = true
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
  
  // この関数は generateMap() で直接 generateGuaranteedPaths() を呼ぶように変更したため削除

  private generateGuaranteedPaths() {
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    const centerX = Math.floor(tilesX / 2)
    const centerY = Math.floor(tilesY / 2)
    
    console.log(`マップ生成: 中央位置 (${centerX}, ${centerY})、自宅位置 (${centerX}, ${centerY})`)
    
    // 1. 自宅から1マス離れた位置に縦のあぜ道を作成（自宅を避けて）
    const pathLineX = centerX - 1  // 自宅から1マス左
    for (let y = 0; y < tilesY; y++) {
      if (pathLineX >= 0 && this.mapData[pathLineX][y] === null) {
        this.mapData[pathLineX][y] = {
          x: pathLineX,
          y: y,
          type: 'path',
          connections: { north: false, south: false, east: false, west: false }
        }
      }
    }
    
    // 2. 自宅から1マス離れた位置に横のあぜ道を作成（自宅を避けて）
    const pathLineY = centerY - 1  // 自宅から1マス上
    for (let x = 0; x < tilesX; x++) {
      if (pathLineY >= 0 && this.mapData[x][pathLineY] === null) {
        this.mapData[x][pathLineY] = {
          x: x,
          y: pathLineY,
          type: 'path',
          connections: { north: false, south: false, east: false, west: false }
        }
      }
    }
    
    // 3. 自宅は既にplacePlayerHouse()で中央に配置済み
    
    // 4. 水路を自宅から1マス離れた位置に作成（確実に到達可能にする）
    const waterLineX = centerX + 1  // 自宅から1マス右の縦水路
    const waterLineY = centerY + 1  // 自宅から1マス下の横水路
    
    // 境界チェック付きで縦の水路を作成
    if (waterLineX < tilesX) {
      for (let y = 0; y < tilesY; y++) {
        if (this.mapData[waterLineX][y] === null) {
          this.mapData[waterLineX][y] = {
            x: waterLineX,
            y: y,
            type: 'water',
            connections: { north: false, south: false, east: false, west: false }
          }
        }
      }
    }
    
    // 境界チェック付きで横の水路を作成  
    if (waterLineY < tilesY) {
      for (let x = 0; x < tilesX; x++) {
        if (this.mapData[x][waterLineY] === null) {
          this.mapData[x][waterLineY] = {
            x: x,
            y: waterLineY,
            type: 'water',
            connections: { north: false, south: false, east: false, west: false }
          }
        }
      }
    }
    
    console.log(`十字路システム生成完了: 自宅(${centerX}, ${centerY})、あぜ道(${pathLineX}, *) (*, ${pathLineY})、水路(${waterLineX}, *) (*, ${waterLineY})`)
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
  
  // 古い水路生成システムを削除 - generateGuaranteedPaths() で十字路システムとして統合
  
  private placeOtherHouses() {
    const tilesX = this.mapData.length
    const tilesY = this.mapData[0].length
    const centerX = Math.floor(tilesX / 2)
    const centerY = Math.floor(tilesY / 2)
    
    // 画面に見える範囲を考慮した配置範囲
    const visibleRangeX = Math.floor(tilesX * 0.6) // 見える範囲の60%程度
    const visibleRangeY = Math.floor(tilesY * 0.6)
    
    let housesPlaced = 0
    const maxAttempts = 200
    let attempts = 0
    
    while (housesPlaced < 2 && attempts < maxAttempts) {
      attempts++
      
      // 中央周辺だが画面内に見える範囲で配置
      const offsetX = Math.floor(Math.random() * visibleRangeX) - Math.floor(visibleRangeX / 2)
      const offsetY = Math.floor(Math.random() * visibleRangeY) - Math.floor(visibleRangeY / 2)
      
      let houseX = centerX + offsetX
      let houseY = centerY + offsetY
      
      // 境界チェック
      houseX = Math.max(1, Math.min(tilesX - 2, houseX))
      houseY = Math.max(1, Math.min(tilesY - 2, houseY))
      
      // 自分の家から最低2マス離れた場所に配置
      if (Math.abs(houseX - centerX) < 2 || Math.abs(houseY - centerY) < 2) continue
      if (this.mapData[houseX][houseY] !== null) continue
      
      // 他の家・駅との距離チェック（最低2マス離す）
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