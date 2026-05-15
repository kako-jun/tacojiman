import { generateMap } from '../game/map'

export type PanelType =
  | 'water'
  | 'river'
  | 'rice_field'
  | 'path'
  | 'rail'
  | 'player_house'
  | 'other_house'
  | 'station'

export interface PanelConnections {
  north: boolean
  south: boolean
  east: boolean
  west: boolean
}

export interface MapPanel {
  x: number
  y: number
  type: PanelType
  connections: PanelConnections
}

export type BombType =
  | 'proton'
  | 'muddy'
  | 'sentry'
  | 'muteki'
  | 'sol'
  | 'dainsleif'
  | 'jakuhou'
  | 'bunshin'

export type EnemyType = 'ground' | 'water' | 'air' | 'underground' | 'takokong'

export interface EnemyState {
  id: string
  type: EnemyType
  hp: number
  x: number
  y: number
  routeProgress: number
  route: Array<{ x: number; y: number }>
}

export interface CameraState {
  x: number
  y: number
  scale: number
}

export interface GameState {
  version: 1
  elapsedMs: number
  durationMs: number
  score: number
  combo: number
  bombStock: number
  selectedBomb: BombType | null
  morningStartMinutes: number
  map: MapPanel[][]
  enemies: EnemyState[]
  camera: CameraState
  takokongSpawned: boolean
  phase: 'ready' | 'playing' | 'ending'
}

export const VIEW_WIDTH = 400
export const VIEW_HEIGHT = 600
export const TILE_SIZE = 28

export function createInitialGameState(): GameState {
  return {
    version: 1,
    elapsedMs: 0,
    durationMs: 180_000,
    score: 0,
    combo: 0,
    bombStock: 1,
    selectedBomb: null,
    morningStartMinutes: 7 * 60,
    map: generateMap(19, 25),
    enemies: [
      {
        id: 'ground-1',
        type: 'ground',
        hp: 2,
        x: 186,
        y: 90,
        routeProgress: 0,
        route: [],
      },
      { id: 'water-1', type: 'water', hp: 2, x: 102, y: 90, routeProgress: 0, route: [] },
      { id: 'air-1', type: 'air', hp: 1, x: 186, y: 510, routeProgress: 0, route: [] },
    ],
    camera: { x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2, scale: 1 },
    takokongSpawned: false,
    phase: 'ready',
  }
}

export function getClockText(state: GameState): string {
  const gameMinutes = Math.floor((state.elapsedMs / state.durationMs) * 30)
  const totalMinutes = state.morningStartMinutes + gameMinutes
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${hour}:${minute.toString().padStart(2, '0')} AM`
}
