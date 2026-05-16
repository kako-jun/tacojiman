import { generateMap } from '../game/map'
import type {
  CameraZoomAnim,
  ShakeState,
  ZoomState,
} from '../game/CameraController'

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
  phase: 'ready' | 'playing' | 'ending'
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
    map: generateMap(19, 25),
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
      panelX: 9,
      panelY: 12,
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
  const gameMinutes = Math.floor((state.elapsedMs / state.durationMs) * 30)
  const totalMinutes = state.morningStartMinutes + gameMinutes
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${hour}:${minute.toString().padStart(2, '0')} AM`
}
