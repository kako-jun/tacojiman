import type { EnemyState, EnemyType, GameState } from '../types/GameState'
import { TILE_SIZE } from '../types/GameState'

export interface EnemySpec {
  type: EnemyType
  speed: number
  baseHp: number
  score: number
}

export const ENEMY_SPECS: Record<EnemyType, EnemySpec> = {
  ground: { type: 'ground', speed: 0.4, baseHp: 2, score: 1 },
  water: { type: 'water', speed: 0.35, baseHp: 2, score: 2 },
  air: { type: 'air', speed: 0.6, baseHp: 1, score: 3 },
  underground: { type: 'underground', speed: 0.5, baseHp: 2, score: 4 },
  takokong: { type: 'takokong', speed: 0.8, baseHp: 42, score: 10 },
}

function makeId(type: EnemyType): string {
  return `${type}-${globalThis.crypto.randomUUID()}`
}

const GROUND_WATER_UNDERGROUND_INTERVAL = 30_000

/**
 * 経過時間に応じて新たにスポーンすべき敵を返す。
 * 副作用: state.spawnTimer と state.takokongSpawned を直接書き換える。
 */
export function spawnEnemies(state: GameState, deltaMS: number): EnemyState[] {
  const result: EnemyState[] = []
  const map = state.map
  const cols = map.length
  const rows = map[0]?.length ?? 0
  const width = cols * TILE_SIZE
  const height = rows * TILE_SIZE
  const offsetX = -width / 2
  const offsetY = -height / 2

  const prevTimer = state.spawnTimer
  const nextTimer = prevTimer + deltaMS

  // ground: 30秒ごと（30000ms）
  if (
    Math.floor(prevTimer / GROUND_WATER_UNDERGROUND_INTERVAL) <
    Math.floor(nextTimer / GROUND_WATER_UNDERGROUND_INTERVAL)
  ) {
    const startPanels = map.flat().filter((p) => p.type === 'path' && p.x === 0)
    if (startPanels.length > 0) {
      const panel = startPanels[Math.floor(Math.random() * startPanels.length)]
      const spec = ENEMY_SPECS.ground
      result.push({
        id: makeId('ground'),
        type: 'ground',
        hp: spec.baseHp,
        speed: spec.speed,
        x: panel.x * TILE_SIZE + TILE_SIZE / 2 + offsetX,
        y: panel.y * TILE_SIZE + TILE_SIZE / 2 + offsetY,
        routeProgress: 0,
        route: [],
      })
    }
  }

  // water: 30秒ごと
  if (
    Math.floor(prevTimer / GROUND_WATER_UNDERGROUND_INTERVAL) <
    Math.floor(nextTimer / GROUND_WATER_UNDERGROUND_INTERVAL)
  ) {
    const startPanels = map
      .flat()
      .filter((p) => p.type === 'water' && p.y === 0)
    if (startPanels.length > 0) {
      const panel = startPanels[Math.floor(Math.random() * startPanels.length)]
      const spec = ENEMY_SPECS.water
      result.push({
        id: makeId('water'),
        type: 'water',
        hp: spec.baseHp,
        speed: spec.speed,
        x: panel.x * TILE_SIZE + TILE_SIZE / 2 + offsetX,
        y: panel.y * TILE_SIZE + TILE_SIZE / 2 + offsetY,
        routeProgress: 0,
        route: [],
      })
    }
  }

  // underground: 30秒ごと
  if (
    Math.floor(prevTimer / GROUND_WATER_UNDERGROUND_INTERVAL) <
    Math.floor(nextTimer / GROUND_WATER_UNDERGROUND_INTERVAL)
  ) {
    const startPanels = map.flat().filter((p) => p.type === 'rice_field')
    if (startPanels.length > 0) {
      const panel = startPanels[Math.floor(Math.random() * startPanels.length)]
      const spec = ENEMY_SPECS.underground
      result.push({
        id: makeId('underground'),
        type: 'underground',
        hp: spec.baseHp,
        speed: spec.speed,
        x: panel.x * TILE_SIZE + TILE_SIZE / 2 + offsetX,
        y: panel.y * TILE_SIZE + TILE_SIZE / 2 + offsetY,
        routeProgress: 0,
        route: [],
      })
    }
  }

  // air: 45秒ごと
  const airInterval = 45_000
  if (
    Math.floor(prevTimer / airInterval) < Math.floor(nextTimer / airInterval)
  ) {
    const spec = ENEMY_SPECS.air
    const randomY = offsetY + Math.random() * height
    result.push({
      id: makeId('air'),
      type: 'air',
      hp: spec.baseHp,
      speed: spec.speed,
      x: offsetX - 200,
      y: randomY,
      routeProgress: 0,
      route: [],
    })
  }

  // takokong: elapsedMs が 170000 を超えたとき1体
  if (!state.takokongSpawned && state.elapsedMs + deltaMS >= 170_000) {
    const spec = ENEMY_SPECS.takokong
    result.push({
      id: makeId('takokong'),
      type: 'takokong',
      hp: spec.baseHp,
      speed: spec.speed,
      x: 0,
      y: offsetY - 200,
      routeProgress: 0,
      route: [],
    })
    state.takokongSpawned = true
  }

  state.spawnTimer = nextTimer

  return result
}
