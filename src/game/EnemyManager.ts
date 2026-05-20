import type {
  EnemyState,
  EnemyType,
  GameState,
  MapPanel,
} from '../types/GameState'
import {
  computeTakokongDamage,
  createTakokongState,
  MAP_RADIUS_PX,
  TAKOKONG_DEFEAT_BONUS,
  TILE_SIZE,
} from '../types/GameState'
import { findPathEdgePosition, findWaterGoalPanel, findWaterPath } from './map'
import {
  ENEMY_SPAWN_WEIGHTS,
  INITIAL_GROUND_SPAWN_INTERVAL_MS,
  MAX_ENEMIES_CAP,
  MAX_ENEMIES_INCREMENT,
  MAX_ENEMIES_UPGRADE_INTERVAL_MS,
  SPAWN_INTERVAL_MIN_MS,
  SPAWN_RATE_DECAY,
  SPAWN_RATE_UPGRADE_INTERVAL_MS,
} from './domain/GameRules'

// 蜂忍術通常攻撃の固定パラメータ
export const ATTACK_RANGE = 80
export const ATTACK_DAMAGE = 1

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

// 重み付き選択（旧Phaser版準拠）— ENEMY_SPAWN_WEIGHTS を順序固定で展開する
const ENEMY_WEIGHTS: Array<{
  type: Exclude<EnemyType, 'takokong'>
  weight: number
}> = [
  { type: 'ground', weight: ENEMY_SPAWN_WEIGHTS.ground },
  { type: 'water', weight: ENEMY_SPAWN_WEIGHTS.water },
  { type: 'air', weight: ENEMY_SPAWN_WEIGHTS.air },
  { type: 'underground', weight: ENEMY_SPAWN_WEIGHTS.underground },
]

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
// 円形マップの外（半径 MAP_RADIUS_PX）から内側 (0,0) へ直進する形で空タコを出現させる。
// 旧 4 辺ランダム方式だと、円形マップでは円外の黒地（rice_field でも path でもない場所）
// からフェードインする見た目になっていた。円外周にスポーン位置を揃えることで「円の縁から
// 飛び込んで来る」表現にする。
const AIR_SPAWN_MARGIN = 40
function makeAirEnemy(
  ctx: SpawnContext,
  rand: () => number = Math.random
): EnemyState {
  void ctx
  const angle = rand() * Math.PI * 2
  const dist = MAP_RADIUS_PX + AIR_SPAWN_MARGIN
  const x = Math.cos(angle) * dist
  const y = Math.sin(angle) * dist
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
    // #37: 専用ステートを初期化する。バリアは出現直後から数秒間有効。
    state.takokongState = createTakokongState(state.elapsedMs + deltaMS)
  }

  state.spawnTimer = nextTimer

  return result
}

export interface DefeatedEnemyDetail {
  id: string
  x: number
  y: number
  type: EnemyType
  score: number
}

export interface AttackHitResult {
  defeatedEnemyIds: string[]
  damagedEnemyIds: string[]
  earnedScore: number
  defeatedDetails: DefeatedEnemyDetail[]
}

/**
 * mapLayer ローカル座標 (worldX, worldY) を中心とした攻撃判定。
 * - 範囲 (range 半径) 内の敵に damage を与える
 * - 敵が乗っている panel が 'other_house' / 'station' なら無敵エリア扱いでスキップ
 * - HP <= 0 になった敵は除去し、スコアに ENEMY_SPECS[type].score * zoomMultiplier を加算
 *
 * 副作用あり: state.enemies を破壊的に変更する（HP 更新 + 撃破した敵を除去）。
 */
export function checkAttackHit(
  state: GameState,
  worldX: number,
  worldY: number,
  range: number,
  damage: number,
  zoomMultiplier: number
): AttackHitResult {
  const defeated: string[] = []
  const damaged: string[] = []
  const defeatedDetails: DefeatedEnemyDetail[] = []
  let earned = 0

  const map = state.map
  const cols = map.length
  const rows = map[0]?.length ?? 0
  const width = cols * TILE_SIZE
  const height = rows * TILE_SIZE
  const offsetX = -width / 2
  const offsetY = -height / 2

  const range2 = range * range

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i]
    const dx = enemy.x - worldX
    const dy = enemy.y - worldY
    if (dx * dx + dy * dy > range2) continue

    // 敵が乗っている panel をチェック（無敵エリア判定）
    const panelX = Math.floor((enemy.x - offsetX) / TILE_SIZE)
    const panelY = Math.floor((enemy.y - offsetY) / TILE_SIZE)
    const panel = map[panelX]?.[panelY]
    if (panel && (panel.type === 'other_house' || panel.type === 'station')) {
      continue
    }

    // #37: takokong は専用ステートでダメージ管理する（バリア軽減・撃破ボーナス）
    if (enemy.type === 'takokong' && state.takokongState !== null) {
      const tk = state.takokongState
      const actualDamage = computeTakokongDamage(tk.barrierActive, damage)
      if (actualDamage <= 0) {
        damaged.push(enemy.id)
        continue
      }
      tk.hp = Math.max(0, tk.hp - actualDamage)
      enemy.hp = tk.hp
      if (tk.hp <= 0) {
        tk.defeated = true
        tk.active = false
        const score =
          ENEMY_SPECS.takokong.score * zoomMultiplier + TAKOKONG_DEFEAT_BONUS
        earned += score
        defeated.push(enemy.id)
        defeatedDetails.push({
          id: enemy.id,
          x: enemy.x,
          y: enemy.y,
          type: enemy.type,
          score,
        })
        state.enemies.splice(i, 1)
      } else {
        damaged.push(enemy.id)
      }
      continue
    }

    enemy.hp -= damage
    if (enemy.hp <= 0) {
      const score = ENEMY_SPECS[enemy.type].score * zoomMultiplier
      earned += score
      defeated.push(enemy.id)
      defeatedDetails.push({
        id: enemy.id,
        x: enemy.x,
        y: enemy.y,
        type: enemy.type,
        score,
      })
      state.enemies.splice(i, 1)
    } else {
      damaged.push(enemy.id)
    }
  }

  return {
    defeatedEnemyIds: defeated,
    damagedEnemyIds: damaged,
    earnedScore: earned,
    defeatedDetails,
  }
}
