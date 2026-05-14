import type { MapPanel, PanelConnections, PanelType } from '../types/GameState'

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
  return type === 'path' || type === 'rail' || type === 'station'
}

function isSameNetwork(
  other: PanelType | undefined,
  current: PanelType
): boolean {
  if (other === undefined) return false
  if (current === 'rail' || current === 'station') {
    return other === 'rail' || other === 'station'
  }
  return other === current
}
