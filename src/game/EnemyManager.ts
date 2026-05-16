import type {
  EnemyState,
  EnemyType,
  GameState,
  MapPanel,
} from '../types/GameState'
import { TILE_SIZE } from '../types/GameState'
import { findPathEdgePosition, findWaterGoalPanel, findWaterPath } from './map'

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

// 重み付き選択（旧Phaser版準拠）
const ENEMY_WEIGHTS: Array<{
  type: Exclude<EnemyType, 'takokong'>
  weight: number
}> = [
  { type: 'ground', weight: 0.5 },
  { type: 'water', weight: 0.25 },
  { type: 'air', weight: 0.15 },
  { type: 'underground', weight: 0.1 },
]

// 動的調整パラメータ
const SPAWN_RATE_UPGRADE_INTERVAL_MS = 15_000
const SPAWN_RATE_DECAY = 0.8
const SPAWN_INTERVAL_MIN_MS = 200
const MAX_ENEMIES_UPGRADE_INTERVAL_MS = 15_000
const MAX_ENEMIES_INCREMENT = 5
const MAX_ENEMIES_CAP = 70

// 初期 3 体地上タコの間隔（200ms）
const INITIAL_GROUND_SPAWN_INTERVAL_MS = 200

function makeId(type: EnemyType): string {
  return `${type}-${globalThis.crypto.randomUUID()}`
}

/**
 * 重み付きで通常敵タイプを選ぶ。
 * rand: 省略時は Math.random()
 */
export function selectRandomEnemyType(
  rand: number = Math.random()
): Exclude<EnemyType, 'takokong'> {
  let cumulative = 0
  for (const { type, weight } of ENEMY_WEIGHTS) {
    cumulative += weight
    if (rand <= cumulative) return type
  }
  return 'ground'
}

interface SpawnContext {
  map: MapPanel[][]
  offsetX: number
  offsetY: number
  width: number
  height: number
  goalPanel: MapPanel | undefined
  // waterGoal は makeContext 構築時に 1 回だけ計算しておく（N3: フレーム毎の二重走査を避ける）
  waterGoal: { x: number; y: number } | null
}

function makeContext(state: GameState): SpawnContext {
  const map = state.map
  const cols = map.length
  const rows = map[0]?.length ?? 0
  const width = cols * TILE_SIZE
  const height = rows * TILE_SIZE
  // N2: goalPanel の検索は 1 spawnEnemies 呼び出しにつき 1 回だけ走る
  // （ここでキャッシュし、以下の make*Enemy ヘルパは ctx.goalPanel を参照する）
  const goalPanel = map.flat().find((p) => p.type === 'player_house')
  // N3: waterGoal も同様に 1 回だけ計算してキャッシュする
  const waterGoal = goalPanel
    ? findWaterGoalPanel(map, { x: goalPanel.x, y: goalPanel.y })
    : null
  return {
    map,
    width,
    height,
    offsetX: -width / 2,
    offsetY: -height / 2,
    goalPanel,
    waterGoal,
  }
}

function panelToPixel(
  panel: { x: number; y: number },
  ctx: SpawnContext
): { x: number; y: number } {
  return {
    x: panel.x * TILE_SIZE + TILE_SIZE / 2 + ctx.offsetX,
    y: panel.y * TILE_SIZE + TILE_SIZE / 2 + ctx.offsetY,
  }
}

function makeEnemy(type: EnemyType, x: number, y: number): EnemyState {
  const spec = ENEMY_SPECS[type]
  return {
    id: makeId(type),
    type,
    hp: spec.baseHp,
    speed: spec.speed,
    x,
    y,
    routeProgress: 0,
    route: [],
  }
}

/**
 * 地上タコのスポーン位置（端の path タイル）を返す。
 * 候補がない場合は null。
 */
function makeGroundEnemy(ctx: SpawnContext): EnemyState | null {
  if (!ctx.goalPanel) return null
  const panel = findPathEdgePosition(ctx.map, {
    x: ctx.goalPanel.x,
    y: ctx.goalPanel.y,
  })
  if (panel === null) return null
  const { x, y } = panelToPixel(panel, ctx)
  return makeEnemy('ground', x, y)
}

/**
 * 水タコのスポーン位置を返す。
 * 家から遠い water/river（マンハッタン降順上位 30%）から複数候補を取り、
 * waterGoal まで A* で到達可能なものをランダムに選ぶ（S1/N4）。
 * 到達可能な候補がなければ null（S2）。
 * 「river の終端 or マップ端の water からの出現」を、毎回複数候補からランダム化して再現する。
 */
function makeWaterEnemy(
  ctx: SpawnContext,
  rand: () => number = Math.random
): EnemyState | null {
  if (!ctx.goalPanel) return null
  const goal = ctx.waterGoal
  if (goal === null) return null

  const cols = ctx.map.length
  const rows = ctx.map[0]?.length ?? 0

  // water/river 全タイルと家からのマンハッタン距離を収集
  const all: Array<{ x: number; y: number; d: number }> = []
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const panel = ctx.map[x][y]
      if (!panel) continue
      if (panel.type !== 'water' && panel.type !== 'river') continue
      const d = Math.abs(x - ctx.goalPanel.x) + Math.abs(y - ctx.goalPanel.y)
      all.push({ x, y, d })
    }
  }
  if (all.length === 0) return null

  // マンハッタン降順上位 30% を候補にする（S1: 複数候補からランダム）
  all.sort((a, b) => b.d - a.d)
  const topN = Math.max(1, Math.ceil(all.length * 0.3))
  const top = all.slice(0, topN)

  // 到達可能なものだけ残す（S2）
  const reachable = top.filter(
    (c) => findWaterPath(ctx.map, { x: c.x, y: c.y }, goal).length > 0
  )
  if (reachable.length === 0) return null

  const picked = reachable[Math.floor(rand() * reachable.length)]
  const { x, y } = panelToPixel(picked, ctx)
  return makeEnemy('water', x, y)
}

/**
 * 空タコのスポーン位置（4 辺ランダム入射）を返す。
 * 出現したら家 (0,0) 方向へ直進する（移動は GameScene 側）。
 */
function makeAirEnemy(
  ctx: SpawnContext,
  rand: () => number = Math.random
): EnemyState {
  const margin = 200
  const edge = Math.floor(rand() * 4)
  let x: number
  let y: number
  switch (edge) {
    case 0:
      // 上辺
      x = ctx.offsetX + rand() * ctx.width
      y = ctx.offsetY - margin
      break
    case 1:
      // 右辺
      x = ctx.offsetX + ctx.width + margin
      y = ctx.offsetY + rand() * ctx.height
      break
    case 2:
      // 下辺
      x = ctx.offsetX + rand() * ctx.width
      y = ctx.offsetY + ctx.height + margin
      break
    case 3:
    default:
      // 左辺
      x = ctx.offsetX - margin
      y = ctx.offsetY + rand() * ctx.height
      break
  }
  return makeEnemy('air', x, y)
}

/**
 * 地下タコのスポーン位置（家からマンハッタン 3 タイル以内の rice_field）を返す。
 * 「家のすぐ近くから湧く」設計（CLAUDE.md 仕様）。
 * 3 タイル以内の候補がない場合は rice_field 全体からフォールバックでランダム選択する。
 */
const UNDERGROUND_HOUSE_RADIUS = 3

function makeUndergroundEnemy(
  ctx: SpawnContext,
  rand: () => number = Math.random
): EnemyState | null {
  const allRiceFields = ctx.map.flat().filter((p) => p.type === 'rice_field')
  if (allRiceFields.length === 0) return null

  let candidates = allRiceFields
  if (ctx.goalPanel) {
    const goal = ctx.goalPanel
    const near = allRiceFields.filter(
      (p) =>
        Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y) <=
        UNDERGROUND_HOUSE_RADIUS
    )
    if (near.length > 0) candidates = near
  }

  const panel = candidates[Math.floor(rand() * candidates.length)]
  const { x, y } = panelToPixel(panel, ctx)
  return makeEnemy('underground', x, y)
}

function makeEnemyOfType(
  type: Exclude<EnemyType, 'takokong'>,
  ctx: SpawnContext,
  rand: () => number
): EnemyState | null {
  switch (type) {
    case 'ground':
      return makeGroundEnemy(ctx)
    case 'water':
      return makeWaterEnemy(ctx, rand)
    case 'air':
      return makeAirEnemy(ctx, rand)
    case 'underground':
      return makeUndergroundEnemy(ctx, rand)
    default:
      // N1: 不明型は明示的に null（never ガード相当）
      return null
  }
}

/**
 * 経過時間に応じて新たにスポーンすべき敵を返す。
 * 副作用: state の以下フィールドを書き換える。
 *   - spawnTimer (累積 ms)
 *   - takokongSpawned (true 化)
 *   - initialEnemiesSpawned / initialEnemiesRemaining / initialEnemiesNextDelayMs
 *   - spawnIntervalMs / spawnRateUpgradeAccumMs
 *   - maxEnemies / maxEnemiesUpgradeAccumMs
 *
 * 第 3 引数 randomSource (S3): テスト容易性のため Math.random を差し替え可能にする。
 * 省略時は Math.random。全敵生成関数に伝搬する。
 */
export function spawnEnemies(
  state: GameState,
  deltaMS: number,
  randomSource: () => number = Math.random
): EnemyState[] {
  const result: EnemyState[] = []
  const ctx = makeContext(state)
  const map = ctx.map

  // S5: 空マップ時も deltaMS<=0 と同様、state を一切触らず空配列を返す
  if (map.length === 0) {
    return result
  }

  // delta=0 は何もしない（spawnTimer も増やさない）
  if (deltaMS <= 0) {
    return result
  }

  const prevTimer = state.spawnTimer
  const nextTimer = prevTimer + deltaMS

  // ── 初期 3 体地上タコスポーン ─────────────────────────
  // S4: legacy Phaser 版が delayedCall で 200ms 刻みに発火していた挙動に合わせ、
  // 「1 フレームに最大 1 体ずつ」スポーンする（while ではなく if）。
  // 初回呼び出しで 1 体即時、その後 200ms 間隔で残り 2 体。
  if (!state.initialEnemiesSpawned) {
    state.initialEnemiesNextDelayMs -= deltaMS
    if (
      state.initialEnemiesRemaining > 0 &&
      state.initialEnemiesNextDelayMs <= 0
    ) {
      const enemy = makeGroundEnemy(ctx)
      if (enemy !== null) {
        result.push(enemy)
        state.initialEnemiesRemaining -= 1
        if (state.initialEnemiesRemaining > 0) {
          state.initialEnemiesNextDelayMs += INITIAL_GROUND_SPAWN_INTERVAL_MS
        }
      }
      // enemy === null（path タイル等が無いマップ）の場合は消費せず次フレームで再試行
    }
    if (state.initialEnemiesRemaining <= 0) {
      state.initialEnemiesSpawned = true
    }
  }

  // ── スポーン間隔（15秒ごと × 0.8、下限 200ms）─────────
  state.spawnRateUpgradeAccumMs += deltaMS
  while (state.spawnRateUpgradeAccumMs >= SPAWN_RATE_UPGRADE_INTERVAL_MS) {
    state.spawnRateUpgradeAccumMs -= SPAWN_RATE_UPGRADE_INTERVAL_MS
    state.spawnIntervalMs = Math.max(
      SPAWN_INTERVAL_MIN_MS,
      state.spawnIntervalMs * SPAWN_RATE_DECAY
    )
  }

  // ── 最大敵数（15秒ごと +5、上限 70）─────────────────
  state.maxEnemiesUpgradeAccumMs += deltaMS
  while (state.maxEnemiesUpgradeAccumMs >= MAX_ENEMIES_UPGRADE_INTERVAL_MS) {
    state.maxEnemiesUpgradeAccumMs -= MAX_ENEMIES_UPGRADE_INTERVAL_MS
    state.maxEnemies = Math.min(
      MAX_ENEMIES_CAP,
      state.maxEnemies + MAX_ENEMIES_INCREMENT
    )
  }

  // ── 通常スポーン（spawnIntervalMs ごと、weighted random）──
  // spawnTimer を spawnIntervalMs で割り、跨いだ回数だけスポーンを試みる
  const interval = state.spawnIntervalMs
  if (interval > 0) {
    const crossings =
      Math.floor(nextTimer / interval) - Math.floor(prevTimer / interval)
    // N5: maxEnemies は通常敵の同時存在上限。takokong はボス枠で別カウント扱いなので除外する
    const isCounted = (e: { type: EnemyType }) => e.type !== 'takokong'
    const currentEnemyCount =
      state.enemies.filter(isCounted).length + result.filter(isCounted).length
    let spawnable = Math.max(0, state.maxEnemies - currentEnemyCount)
    for (let i = 0; i < crossings && spawnable > 0; i++) {
      const type = selectRandomEnemyType(randomSource())
      const enemy = makeEnemyOfType(type, ctx, randomSource)
      if (enemy !== null) {
        result.push(enemy)
        spawnable--
      }
    }
  }

  // ── takokong: elapsedMs が 170000 を超えたとき1体 ─────
  if (!state.takokongSpawned && state.elapsedMs + deltaMS >= 170_000) {
    result.push(makeEnemy('takokong', 0, ctx.offsetY - 200))
    state.takokongSpawned = true
  }

  state.spawnTimer = nextTimer

  return result
}
