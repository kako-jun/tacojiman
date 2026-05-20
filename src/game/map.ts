import type { MapPanel, PanelConnections, PanelType } from '../types/GameState'

const WALKABLE: PanelType[] = ['path', 'rail', 'station', 'player_house']

function isWalkable(type: PanelType): boolean {
  return WALKABLE.includes(type)
}

function heuristic(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function findPath(
  map: MapPanel[][],
  start: { x: number; y: number },
  goal: { x: number; y: number }
): Array<{ x: number; y: number }> {
  const startPanel = map[start.x]?.[start.y]
  const goalPanel = map[goal.x]?.[goal.y]
  if (!startPanel || !goalPanel) return []
  if (!isWalkable(startPanel.type) || !isWalkable(goalPanel.type)) return []

  type Node = { x: number; y: number; f: number }
  const key = (x: number, y: number) => `${x},${y}`

  const openSet: Node[] = [
    { x: start.x, y: start.y, f: heuristic(start, goal) },
  ]
  const cameFrom = new Map<string, { x: number; y: number }>()
  const gScore = new Map<string, number>()
  gScore.set(key(start.x, start.y), 0)
  const closedSet = new Set<string>()

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f)
    const current = openSet.shift()!
    const currentKey = key(current.x, current.y)

    if (closedSet.has(currentKey)) continue
    closedSet.add(currentKey)

    if (current.x === goal.x && current.y === goal.y) {
      const path: Array<{ x: number; y: number }> = []
      let node: { x: number; y: number } = current
      while (!(node.x === start.x && node.y === start.y)) {
        path.unshift({ x: node.x, y: node.y })
        node = cameFrom.get(key(node.x, node.y))!
      }
      return path
    }

    const panel = map[current.x]?.[current.y]
    if (!panel) continue

    const neighbors: Array<{ x: number; y: number }> = []
    if (panel.connections.north)
      neighbors.push({ x: current.x, y: current.y - 1 })
    if (panel.connections.south)
      neighbors.push({ x: current.x, y: current.y + 1 })
    if (panel.connections.east)
      neighbors.push({ x: current.x + 1, y: current.y })
    if (panel.connections.west)
      neighbors.push({ x: current.x - 1, y: current.y })

    for (const neighbor of neighbors) {
      const neighborPanel = map[neighbor.x]?.[neighbor.y]
      if (!neighborPanel || !isWalkable(neighborPanel.type)) continue

      const tentativeG = (gScore.get(key(current.x, current.y)) ?? Infinity) + 1
      const neighborKey = key(neighbor.x, neighbor.y)
      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, { x: current.x, y: current.y })
        gScore.set(neighborKey, tentativeG)
        const f = tentativeG + heuristic(neighbor, goal)
        openSet.push({ x: neighbor.x, y: neighbor.y, f })
      }
    }
  }

  return []
}

/**
 * 自宅まで A* で到達可能な path タイル全候補から
 * 「マップ4辺からの距離が最小」のパネル座標を返す。
 * 候補が複数ある場合は最初に見つかった先頭を返す（決定的）。
 * 候補がない場合は null を返す。
 */
export function findPathEdgePosition(
  map: MapPanel[][],
  goal: { x: number; y: number }
): { x: number; y: number } | null {
  const cols = map.length
  const rows = map[0]?.length ?? 0
  if (cols === 0 || rows === 0) return null

  let best: { x: number; y: number; distanceFromEdge: number } | null = null

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const panel = map[x][y]
      if (!panel || panel.type !== 'path') continue
      // 自宅まで到達可能か
      const route = findPath(map, { x, y }, goal)
      if (route.length === 0 && !(x === goal.x && y === goal.y)) continue
      const distanceFromEdge = Math.min(x, cols - 1 - x, y, rows - 1 - y)
      if (best === null || distanceFromEdge < best.distanceFromEdge) {
        best = { x, y, distanceFromEdge }
      }
    }
  }

  if (best === null) return null
  return { x: best.x, y: best.y }
}

const WATER_TYPES: PanelType[] = ['water', 'river']

function isWaterWalkable(type: PanelType): boolean {
  return WATER_TYPES.includes(type)
}

/**
 * 水タコ用 A*。
 * water と river を歩行可能タイルとして 4 方向に隣接探索する
 * （MapPanel.connections は無視して、隣接セルの type だけで判定する）。
 * 返値は start を含まず goal を末尾に持つルート、または到達不能なら []。
 */
export function findWaterPath(
  map: MapPanel[][],
  start: { x: number; y: number },
  goal: { x: number; y: number }
): Array<{ x: number; y: number }> {
  const startPanel = map[start.x]?.[start.y]
  const goalPanel = map[goal.x]?.[goal.y]
  if (!startPanel || !goalPanel) return []
  if (!isWaterWalkable(startPanel.type) || !isWaterWalkable(goalPanel.type))
    return []

  type Node = { x: number; y: number; f: number }
  const key = (x: number, y: number) => `${x},${y}`

  const openSet: Node[] = [
    { x: start.x, y: start.y, f: heuristic(start, goal) },
  ]
  const cameFrom = new Map<string, { x: number; y: number }>()
  const gScore = new Map<string, number>()
  gScore.set(key(start.x, start.y), 0)
  const closedSet = new Set<string>()

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f)
    const current = openSet.shift()!
    const currentKey = key(current.x, current.y)
    if (closedSet.has(currentKey)) continue
    closedSet.add(currentKey)

    if (current.x === goal.x && current.y === goal.y) {
      const path: Array<{ x: number; y: number }> = []
      let node: { x: number; y: number } = current
      while (!(node.x === start.x && node.y === start.y)) {
        path.unshift({ x: node.x, y: node.y })
        node = cameFrom.get(key(node.x, node.y))!
      }
      return path
    }

    const neighbors: Array<{ x: number; y: number }> = [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
    ]
    for (const neighbor of neighbors) {
      const neighborPanel = map[neighbor.x]?.[neighbor.y]
      if (!neighborPanel || !isWaterWalkable(neighborPanel.type)) continue
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1
      const neighborKey = key(neighbor.x, neighbor.y)
      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, { x: current.x, y: current.y })
        gScore.set(neighborKey, tentativeG)
        const f = tentativeG + heuristic(neighbor, goal)
        openSet.push({ x: neighbor.x, y: neighbor.y, f })
      }
    }
  }

  return []
}

/**
 * 自宅 (goal) に隣接する water または river パネルのうち、
 * water/river ネットワークで goal に最寄りのものを返す。
 * 候補がない場合は water/river の中で goal にユークリッド最寄りのものを返す。
 */
export function findWaterGoalPanel(
  map: MapPanel[][],
  goal: { x: number; y: number }
): { x: number; y: number } | null {
  const cols = map.length
  const rows = map[0]?.length ?? 0

  // まず goal に隣接（4方向）の water/river を探す
  const adjacent: Array<{ x: number; y: number }> = []
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [1, 0],
    [-1, 0],
  ]) {
    const nx = goal.x + dx
    const ny = goal.y + dy
    const panel = map[nx]?.[ny]
    if (panel && isWaterWalkable(panel.type)) {
      adjacent.push({ x: nx, y: ny })
    }
  }
  if (adjacent.length > 0) return adjacent[0]

  // 隣接にいない場合は水パネル全体で goal にユークリッド最寄りを返す
  let best: { x: number; y: number; d: number } | null = null
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const panel = map[x][y]
      if (!panel || !isWaterWalkable(panel.type)) continue
      const d = Math.abs(x - goal.x) + Math.abs(y - goal.y)
      if (best === null || d < best.d) best = { x, y, d }
    }
  }
  return best === null ? null : { x: best.x, y: best.y }
}

const CLOSED: PanelConnections = {
  north: false,
  south: false,
  east: false,
  west: false,
}

export function generateMap(cols: number, rows: number): MapPanel[][] {
  const centerX = Math.floor(cols / 2)
  const centerY = Math.floor(rows / 2)

  const map = Array.from({ length: cols }, (_, x) =>
    Array.from({ length: rows }, (_, y): MapPanel => {
      const type = getPanelType(x, y, centerX, centerY, cols, rows)
      return { x, y, type, connections: { ...CLOSED } }
    })
  )

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      map[x][y].connections = getConnections(map, x, y)
    }
  }

  return map
}

function getPanelType(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  cols: number,
  rows: number
): PanelType {
  if (x === centerX && y === centerY) return 'player_house'
  if (x === centerX - 5 && y === centerY - 4) return 'station'
  if (x >= centerX - 8 && x <= centerX - 3 && y === centerY - 4) return 'rail'
  if (x === centerX || y === centerY || x === centerX - 3) return 'path'
  // #57: 円形マップ化に伴い、other_house/water/river も centerX/centerY 相対で
  // 配置する（以前は cols/rows の絶対端基準だったので、マップサイズを拡張すると
  // playable area の外に追いやられてしまった）。
  // 旧 generateMap(19, 25) の位置と一致するように相対化:
  //   other_house: (2, 17) = (centerX-7, centerY+5)
  //   other_house: (cols-4, centerY-5) = (15, 7) = (centerX+6, centerY-5)
  //   water:       x in [centerX+6 .. centerX+9], y < centerY+5
  //                （旧: x > cols-5 = x >= 15, y < rows-8 = y < 17）
  //   river:       x = centerX+4, y < centerY+2
  //                （旧: x = cols-6 = 13, y < centerY+2 = 14）
  if (x === centerX - 7 && y === centerY + 5) return 'other_house'
  if (x === centerX + 6 && y === centerY - 5) return 'other_house'
  if (x >= centerX + 6 && x <= centerX + 9 && y < centerY + 5) return 'water'
  if (x === centerX + 4 && y < centerY + 2) return 'river'
  // 引数 cols, rows は旧実装で other_house/water/river の絶対端配置に使われていたが、
  // 円形マップ化に伴い centerX/centerY 相対に変更したため不要。
  // 既存呼び出し互換のため引数自体は残す。
  void cols
  void rows
  return 'rice_field'
}

function getConnections(
  map: MapPanel[][],
  x: number,
  y: number
): PanelConnections {
  const panel = map[x][y]
  if (!isConnectable(panel.type)) return { ...CLOSED }
  return {
    north: isSameNetwork(map[x]?.[y - 1]?.type, panel.type),
    south: isSameNetwork(map[x]?.[y + 1]?.type, panel.type),
    east: isSameNetwork(map[x + 1]?.[y]?.type, panel.type),
    west: isSameNetwork(map[x - 1]?.[y]?.type, panel.type),
  }
}

function isConnectable(type: PanelType): boolean {
  return (
    type === 'path' ||
    type === 'rail' ||
    type === 'station' ||
    type === 'player_house'
  )
}

const PATH_NETWORK = new Set<PanelType>(['path', 'player_house'])

function isSameNetwork(
  other: PanelType | undefined,
  current: PanelType
): boolean {
  if (other === undefined) return false
  if (current === 'rail' || current === 'station') {
    return other === 'rail' || other === 'station'
  }
  // path と player_house は同一ネットワーク
  if (PATH_NETWORK.has(current)) return PATH_NETWORK.has(other)
  // isConnectable を通過した型は上記で網羅済み
  return false
}
