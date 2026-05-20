import { generateMap } from '../game/map'
import type {
  CameraZoomAnim,
  ShakeState,
  ZoomState,
} from '../game/CameraController'
import { calculateGameTime, formatGameTime } from '../game/domain/TimeManager'
import { createRotationConfig } from '../game/domain/GameRules'
import type { RotationConfig } from '../game/domain/GameRules'

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

/**
 * #38: マッディの地雷。発動位置に永続設置。
 * トリガー半径内に敵が入ったら爆発し、半径内の敵にダメージを与えてから除去される。
 */
export interface MineState {
  id: string
  x: number
  y: number
  triggerRange: number
  explosionRange: number
  damage: number
}

/**
 * #38: セントリーの自動砲台。5秒間持続して 1 秒ごとに射程内最近敵を撃つ。
 */
export interface SentryState {
  id: string
  x: number
  y: number
  remainingMs: number
  fireCooldownMs: number
  range: number
  damage: number
}

/**
 * #38: 分身の術の囮。プレイヤーから一定距離に 2 つ配置され、5 秒間敵を誘導する。
 */
export interface DecoyState {
  id: string
  x: number
  y: number
  remainingMs: number
  lureRange: number
}

/**
 * #38: ダインスレイブの多段ヒット。発動位置で 0.2 秒間隔で remainingHits 回ヒットする。
 */
export interface MultiHitBombState {
  id: string
  x: number
  y: number
  range: number
  damage: number
  remainingHits: number
  nextHitInMs: number
  hitIntervalMs: number
}

/**
 * タココング戦の専用ステート（#37）。
 * 通常敵と異なり、HP・バリア・撃破フラグなど戦闘専用の情報を持つ。
 * active=true の間は GameScene 側で「ズーム固定」「HP バー表示」「カウントダウン表示」
 * 「BGM 再生」を行う。null のときはタココング未登場 or 戦闘終了済み。
 */
export interface TakokongState {
  active: boolean
  hp: number
  maxHp: number
  barrierActive: boolean
  barrierUntilMs: number
  defeated: boolean
}

export interface EnemyState {
  id: string
  type: EnemyType
  hp: number
  speed: number
  x: number
  y: number
  routeProgress: number
  route: Array<{ x: number; y: number }>
}

export interface CameraState {
  x: number
  y: number
  scale: number
  pivot: { x: number; y: number }
  zoom: CameraZoomAnim | null
}

export type Direction = 'north' | 'south' | 'east' | 'west'

export interface PlayerState {
  panelX: number
  panelY: number
  direction: Direction
  isMoving: boolean
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
  spawnTimer: number
  phase: 'ready' | 'playing' | 'paused' | 'ending'
  player: PlayerState
  shakeState: ShakeState
  zoomState: ZoomState | null
  playerHp: number
  // 初期 3 体スポーン管理
  initialEnemiesSpawned: boolean
  initialEnemiesRemaining: number
  initialEnemiesNextDelayMs: number
  // 動的スポーン間隔
  spawnIntervalMs: number
  spawnRateUpgradeAccumMs: number
  // 動的最大敵数
  maxEnemies: number
  maxEnemiesUpgradeAccumMs: number
  // ボム回復閾値（経過 ms のリスト。発火時に shift する）
  bombRecoveryThresholds: number[]
  // タココング戦専用ステート（出現前は null）
  takokongState: TakokongState | null
  // #38: ボム由来の仕掛けエンティティ
  mines: MineState[]
  sentries: SentryState[]
  decoys: DecoyState[]
  multiHitBombs: MultiHitBombState[]
  // #41: マップ回転（方向・速度をプレイ毎にランダム化）
  rotation: RotationConfig
  // #42: スクリーンショット
  screenshots: string[]
  nextScreenshotAt: number
}

// タココング HP（#37）
export const TAKOKONG_MAX_HP = 42
// バリア持続時間（ms、出現から）
export const TAKOKONG_BARRIER_DURATION_MS = 4_000
// 撃破時のボーナススコア（通常撃破スコア + これ）
export const TAKOKONG_DEFEAT_BONUS = 100
// タココング出現タイミング（残り 10s）
export const TAKOKONG_SPAWN_AT_MS = 170_000
// カウントダウン演出開始タイミング（残り 10s から）
export const TAKOKONG_COUNTDOWN_START_MS = 170_000

export const VIEW_WIDTH = 400
export const VIEW_HEIGHT = 600
export const TILE_SIZE = 28

// #57: 円形マップ。回転時の四隅にビュー対角 sqrt(400^2+600^2)/2 ≈ 360.6px を
// 覆う必要があるため、マップ実体を 27×27 タイル (756×756 px) に拡張し、
// 中心から MAP_RADIUS_TILES 以内のタイルだけを描画する。
// 内側 19×25 の playable area (path/rail/station/player_house/water/river)
// は新 centerX/centerY に対する相対オフセットで生成されるため幾何構造は維持される。
export const MAP_COLS = 27
export const MAP_ROWS = 27
// 半径 = 13.5 タイル × 28 px = 378 px。view 半対角 ≈ 360.6 px をカバーする。
export const MAP_RADIUS_TILES = 13.5
export const MAP_RADIUS_PX = MAP_RADIUS_TILES * TILE_SIZE

const PLAYER_INIT_X = Math.floor(MAP_COLS / 2)
const PLAYER_INIT_Y = Math.floor(MAP_ROWS / 2)

export function createInitialGameState(): GameState {
  return {
    version: 1,
    elapsedMs: 0,
    durationMs: 180_000,
    score: 0,
    combo: 0,
    bombStock: 1,
    selectedBomb: pickRandomBomb(),
    morningStartMinutes: 7 * 60,
    map: generateMap(MAP_COLS, MAP_ROWS),
    enemies: [],
    camera: {
      x: VIEW_WIDTH / 2,
      y: VIEW_HEIGHT / 2,
      scale: 1,
      pivot: { x: 0, y: 0 },
      zoom: null,
    },
    shakeState: { remainingMs: 0, intensity: 0 },
    zoomState: null,
    takokongSpawned: false,
    spawnTimer: 0,
    phase: 'ready',
    player: {
      panelX: PLAYER_INIT_X,
      panelY: PLAYER_INIT_Y,
      direction: 'south',
      isMoving: false,
    },
    playerHp: 3,
    initialEnemiesSpawned: false,
    initialEnemiesRemaining: 3,
    initialEnemiesNextDelayMs: 0,
    spawnIntervalMs: 500,
    spawnRateUpgradeAccumMs: 0,
    maxEnemies: 40,
    maxEnemiesUpgradeAccumMs: 0,
    bombRecoveryThresholds: [60_000, 120_000],
    takokongState: null,
    mines: [],
    sentries: [],
    decoys: [],
    multiHitBombs: [],
    rotation: createRotationConfig(),
    screenshots: [],
    nextScreenshotAt: 60_000,
  }
}

// #38: 仕掛け系ボムのデフォルトパラメータ
export const MINE_TRIGGER_RANGE = 30
export const MINE_EXPLOSION_RANGE = 60
export const MINE_DAMAGE = 1
export const SENTRY_LIFETIME_MS = 5_000
export const SENTRY_FIRE_INTERVAL_MS = 1_000
export const SENTRY_RANGE = 100
export const SENTRY_DAMAGE = 1
export const DECOY_LIFETIME_MS = 5_000
export const DECOY_LURE_RANGE = 120
export const DECOY_DISTANCE = 60
export const DAINSLEIF_HIT_INTERVAL_MS = 200
export const DAINSLEIF_HIT_COUNT = 3
export const DAINSLEIF_RANGE = 80
export const DAINSLEIF_DAMAGE = 1
export const PROTON_BEAM_WIDTH = 40
export const PROTON_BEAM_LENGTH = 600
export const PROTON_DAMAGE = 1

/**
 * #38: 地雷トリガー判定（ピュア関数）。
 * 敵が地雷の triggerRange 内にあるなら true。
 */
export function triggerMineIfHit(mine: MineState, enemy: EnemyState): boolean {
  const dx = enemy.x - mine.x
  const dy = enemy.y - mine.y
  const r2 = mine.triggerRange * mine.triggerRange
  return dx * dx + dy * dy <= r2
}

/**
 * #38: セントリー砲台が狙う敵を選ぶ（ピュア関数）。
 * 射程内で最も近い敵を返す。なければ null。
 */
export function pickSentryTarget(
  sentry: SentryState,
  enemies: EnemyState[]
): EnemyState | null {
  let best: EnemyState | null = null
  let bestDist2 = Infinity
  const r2 = sentry.range * sentry.range
  for (const e of enemies) {
    const dx = e.x - sentry.x
    const dy = e.y - sentry.y
    const d2 = dx * dx + dy * dy
    if (d2 > r2) continue
    if (d2 < bestDist2) {
      bestDist2 = d2
      best = e
    }
  }
  return best
}

/**
 * #38: 分身が敵を誘導すべきか判定する（ピュア関数）。
 * 敵が分身の lureRange 内にいるなら true。
 */
export function pickDecoyTarget(decoy: DecoyState, enemy: EnemyState): boolean {
  const dx = enemy.x - decoy.x
  const dy = enemy.y - decoy.y
  const r2 = decoy.lureRange * decoy.lureRange
  return dx * dx + dy * dy <= r2
}

/**
 * #38: 多段ヒットボムを 1 フレーム分進める（ピュア関数）。
 * nextHitInMs を deltaMS だけ減らし、0 以下になったら fired=true で 1 ヒット消費。
 * remainingHits が 0 になったら remaining=null（除去対象）。
 */
export function tickMultiHitBomb(
  bomb: MultiHitBombState,
  deltaMS: number
): { fired: boolean; remaining: MultiHitBombState | null } {
  const nextIn = bomb.nextHitInMs - deltaMS
  if (nextIn > 0) {
    return {
      fired: false,
      remaining: { ...bomb, nextHitInMs: nextIn },
    }
  }
  const remainingHits = bomb.remainingHits - 1
  if (remainingHits <= 0) {
    return { fired: true, remaining: null }
  }
  return {
    fired: true,
    remaining: {
      ...bomb,
      remainingHits,
      nextHitInMs: bomb.hitIntervalMs,
    },
  }
}

/**
 * タココング戦の判定ヘルパ（#37）。
 * state.takokongState が存在し、active で未撃破なら true。
 * GameScene 側のズーム固定・UI 表示の制御に使う。
 */
export function isTakokongActive(state: GameState): boolean {
  const t = state.takokongState
  return t !== null && t.active && !t.defeated
}

/**
 * タココング戦のカウントダウン残秒数。
 * elapsedMs が durationMs - 10000 (= 170_000) を超えてから演出開始。
 * 戻り値は表示する秒数（10〜0）。範囲外なら null。
 */
export function tickTakokongCountdown(
  elapsedMs: number,
  durationMs: number
): number | null {
  const remaining = durationMs - elapsedMs
  if (remaining < 0) return null
  if (remaining > 10_000) return null
  return Math.ceil(remaining / 1000)
}

/**
 * タココングへの実ダメージを算出する（#37 バリア軽減仕様）。
 * バリア中は 50% 軽減（小数切り捨て）。
 * damage=1 のときは Math.floor(1*0.5)=0 となるので、最低 0 ダメージ（タップは無効）。
 * バリア解除後は damage そのまま。
 */
export function computeTakokongDamage(
  barrierActive: boolean,
  damage: number
): number {
  if (damage <= 0) return 0
  if (barrierActive) {
    return Math.floor(damage * 0.5)
  }
  return damage
}

/**
 * タココング戦のステート初期化（出現時に 1 回だけ呼ぶ）。
 * バリアは出現直後から TAKOKONG_BARRIER_DURATION_MS の間有効。
 */
export function createTakokongState(elapsedMs: number): TakokongState {
  return {
    active: true,
    hp: TAKOKONG_MAX_HP,
    maxHp: TAKOKONG_MAX_HP,
    barrierActive: true,
    barrierUntilMs: elapsedMs + TAKOKONG_BARRIER_DURATION_MS,
    defeated: false,
  }
}

/**
 * タココング戦のバリアタイマー更新（毎フレーム呼ぶ）。
 * elapsedMs が barrierUntilMs を超えていれば barrierActive=false にする。
 * 副作用なしのピュア関数。
 */
export function tickTakokongBarrier(
  takokong: TakokongState,
  elapsedMs: number
): TakokongState {
  if (!takokong.barrierActive) return takokong
  if (elapsedMs >= takokong.barrierUntilMs) {
    return { ...takokong, barrierActive: false }
  }
  return takokong
}

const BOMB_TYPES: BombType[] = [
  'proton',
  'muddy',
  'sentry',
  'muteki',
  'sol',
  'dainsleif',
  'jakuhou',
  'bunshin',
]

/**
 * 8 種のボムから均等抽選する。テスト用に rand 差し替え可。
 */
export function pickRandomBomb(rand: () => number = Math.random): BombType {
  return BOMB_TYPES[Math.floor(rand() * BOMB_TYPES.length)]
}

/**
 * ボム回復閾値の処理。経過時間が先頭閾値を超えていれば 1 個回復し、
 * 新しい selectedBomb を抽選する。複数閾値を一度に跨ぐ場合も全て処理する。
 *
 * 副作用なしのピュア関数。GameScene 側で結果を state に反映する。
 */
export function tryBombRecovery(
  state: GameState,
  rand: () => number = Math.random
): {
  recovered: number
  newStock: number
  newSelected: BombType | null
  newThresholds: number[]
} {
  const thresholds = state.bombRecoveryThresholds
  let recovered = 0
  let newSelected = state.selectedBomb
  let i = 0
  while (i < thresholds.length && state.elapsedMs >= thresholds[i]) {
    recovered++
    newSelected = pickRandomBomb(rand)
    i++
  }
  return {
    recovered,
    newStock: state.bombStock + recovered,
    newSelected,
    newThresholds: thresholds.slice(i),
  }
}

/**
 * #45: pause トグルのピュア関数。playing↔paused を切り替えて返す。
 * 他のフェーズ（ready / ending）は無変更で返す。
 */
export function togglePausePhase(
  phase: GameState['phase']
): GameState['phase'] {
  if (phase === 'playing') return 'paused'
  if (phase === 'paused') return 'playing'
  return phase
}

/**
 * mapLayer ローカル座標 (worldX, worldY) が家タップ判定範囲内か。
 * 家は mapLayer の (0, 0) を中心としているので、|x|<=tileSize/2 かつ |y|<=tileSize/2。
 */
export function isHouseTapped(
  worldX: number,
  worldY: number,
  tileSize: number = TILE_SIZE
): boolean {
  const half = tileSize / 2
  return Math.abs(worldX) <= half && Math.abs(worldY) <= half
}

export function getClockText(state: GameState): string {
  const t = calculateGameTime(
    state.elapsedMs,
    state.durationMs,
    state.morningStartMinutes
  )
  return formatGameTime(t)
}
