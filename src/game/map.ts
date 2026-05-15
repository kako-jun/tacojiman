import type { MapPanel, PanelConnections, PanelType } from '../types/GameState'

const WALKABLE: PanelType[] = ['path', 'rail', 'station', 'player_house']

function isWalkable(type: PanelType): boolean {
  return WALKABLE.includes(type)
}

function heuristic(a: { x: number; y: number }, b: { x: number; y: number }): number {
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

  const openSet: Node[] = [{ x: start.x, y: start.y, f: heuristic(start, goal) }]
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
    if (panel.connections.north) neighbors.push({ x: current.x, y: current.y - 1 })
    if (panel.connections.south) neighbors.push({ x: current.x, y: current.y + 1 })
    if (panel.connections.east) neighbors.push({ x: current.x + 1, y: current.y })
    if (panel.connections.west) neighbors.push({ x: current.x - 1, y: current.y })

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
  if (x === 2 && y === centerY + 5) return 'other_house'
  if (x === cols - 4 && y === centerY - 5) return 'other_house'
  if (x > cols - 5 && y < rows - 8) return 'water'
  if (x === cols - 6 && y < centerY + 2) return 'river'
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
  return type === 'path' || type === 'rail' || type === 'station' || type === 'player_house'
}

function isSameNetwork(
  other: PanelType | undefined,
  current: PanelType
): boolean {
  if (other === undefined) return false
  if (current === 'rail' || current === 'station') {
    return other === 'rail' || other === 'station'
  }
  // path と player_house は同一ネットワーク
  const pathNetwork = new Set<PanelType>(['path', 'player_house'])
  if (pathNetwork.has(current)) return pathNetwork.has(other)
  // isConnectable を通過した型は上記で網羅済み
  return false
}
