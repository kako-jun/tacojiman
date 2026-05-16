/**
 * #39: ローカルストレージ経由の永続化レイヤー。
 *
 * - 進捗 Lv (0-10) と総プレイ回数を保持する `tacojiman_progress`
 * - ハイスコアを保持する `tacojiman_high_score`
 * - プレイヤー名を再利用するための `tacojiman_player_name`
 *
 * zod を導入していないので、JSON.parse 後に `typeof` で素朴に検証する。
 * 不正値・パース失敗は console.warn したうえでデフォルトを返す。
 * SSR / テスト環境（jsdom 未設定）で `localStorage` が無い場合も
 * 各関数は安全側（読み出しはデフォルト、書き込みは no-op）に倒す。
 */

export interface TacojimanProgress {
  /** 0〜10 の整数。プレイ完了ごとに +1（上限 10）。 */
  level: number
  /** 累計プレイ回数（プレイ完了で +1）。 */
  totalPlays: number
}

export interface TacojimanHighScore {
  score: number
  /** ISO 8601 文字列。 */
  achievedAt: string
  playerName: string
}

const STORAGE_KEYS = {
  progress: 'tacojiman_progress',
  highScore: 'tacojiman_high_score',
  playerName: 'tacojiman_player_name',
} as const

export const PROGRESS_LEVEL_MAX = 10
export const PROGRESS_LEVEL_MIN = 0

const DEFAULT_PROGRESS: TacojimanProgress = {
  level: 0,
  totalPlays: 0,
}

/**
 * 進捗 Lv を 0〜10 の整数にクランプする（ピュア関数、テスト容易性のため公開）。
 */
export function clampProgressLevel(level: number): number {
  if (!Number.isFinite(level)) return PROGRESS_LEVEL_MIN
  const floored = Math.floor(level)
  if (floored < PROGRESS_LEVEL_MIN) return PROGRESS_LEVEL_MIN
  if (floored > PROGRESS_LEVEL_MAX) return PROGRESS_LEVEL_MAX
  return floored
}

/**
 * 与えられたスコアがハイスコア更新に値するか判定する（ピュア関数）。
 * - prev が null なら必ず更新
 * - currentScore が prev.score より大きいときだけ更新（同点は据え置き）
 */
export function shouldUpdateHighScore(
  currentScore: number,
  prev: TacojimanHighScore | null
): boolean {
  if (!Number.isFinite(currentScore)) return false
  if (currentScore <= 0) return false
  if (prev === null) return true
  return currentScore > prev.score
}

/**
 * 進捗 Lv (0-10) → タイトル背景色 (0xRRGGBB) への線形補間（ピュア関数）。
 *
 * Lv 0: 0x000033（夜）
 * Lv 10: 0xff9966（朝焼け）
 *
 * 中間値は RGB 各成分を独立に線形補間する。
 */
export function computeProgressBackground(level: number): number {
  const t = clampProgressLevel(level) / PROGRESS_LEVEL_MAX
  const startR = 0x00
  const startG = 0x00
  const startB = 0x33
  const endR = 0xff
  const endG = 0x99
  const endB = 0x66
  const r = Math.round(startR + (endR - startR) * t)
  const g = Math.round(startG + (endG - startG) * t)
  const b = Math.round(startB + (endB - startB) * t)
  return (r << 16) | (g << 8) | b
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function readJson<T>(key: string, validate: (value: unknown) => T | null): T | null {
  const storage = getStorage()
  if (storage === null) return null
  try {
    const raw = storage.getItem(key)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return validate(parsed)
  } catch (error) {
    console.warn(`[storage] failed to read ${key}:`, error)
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  const storage = getStorage()
  if (storage === null) return
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`[storage] failed to write ${key}:`, error)
  }
}

function validateProgress(value: unknown): TacojimanProgress | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (typeof v.level !== 'number') return null
  if (typeof v.totalPlays !== 'number') return null
  return {
    level: clampProgressLevel(v.level),
    totalPlays: Math.max(0, Math.floor(v.totalPlays)),
  }
}

function validateHighScore(value: unknown): TacojimanHighScore | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (typeof v.score !== 'number' || !Number.isFinite(v.score)) return null
  if (typeof v.achievedAt !== 'string') return null
  if (typeof v.playerName !== 'string') return null
  return {
    score: Math.max(0, Math.floor(v.score)),
    achievedAt: v.achievedAt,
    playerName: v.playerName,
  }
}

export function loadProgress(): TacojimanProgress {
  const loaded = readJson(STORAGE_KEYS.progress, validateProgress)
  return loaded ?? { ...DEFAULT_PROGRESS }
}

export function saveProgress(progress: TacojimanProgress): void {
  const normalized: TacojimanProgress = {
    level: clampProgressLevel(progress.level),
    totalPlays: Math.max(0, Math.floor(progress.totalPlays)),
  }
  writeJson(STORAGE_KEYS.progress, normalized)
}

/**
 * 進捗 Lv を 1 つ進める。Lv は上限 10、totalPlays は無制限で +1。
 * 副作用として localStorage に保存し、保存後の値を返す。
 */
export function incrementProgress(): TacojimanProgress {
  const current = loadProgress()
  const next: TacojimanProgress = {
    level: clampProgressLevel(current.level + 1),
    totalPlays: current.totalPlays + 1,
  }
  saveProgress(next)
  return next
}

export function loadHighScore(): TacojimanHighScore | null {
  return readJson(STORAGE_KEYS.highScore, validateHighScore)
}

/**
 * ハイスコア更新ロジック。
 * - 既存値より大きいスコアのときだけ上書き
 * - 更新時は achievedAt = 現在の ISO 文字列、playerName を一緒に保存
 * - 戻り値で `updated` フラグと現在の（更新後 or 既存の）ハイスコアを返す
 */
export function saveHighScoreIfNew(
  score: number,
  playerName: string
): { updated: boolean; current: TacojimanHighScore } {
  const prev = loadHighScore()
  if (!shouldUpdateHighScore(score, prev)) {
    return {
      updated: false,
      current: prev ?? {
        score: 0,
        achievedAt: new Date(0).toISOString(),
        playerName,
      },
    }
  }
  const next: TacojimanHighScore = {
    score: Math.max(0, Math.floor(score)),
    achievedAt: new Date().toISOString(),
    playerName,
  }
  writeJson(STORAGE_KEYS.highScore, next)
  return { updated: true, current: next }
}

const PLAYER_NAME_CITIES = [
  '東京',
  '大阪',
  '横浜',
  '名古屋',
  '札幌',
  '福岡',
  '神戸',
  '仙台',
]

/**
 * プレイヤー名を取得する。
 * 1 回目に呼ばれたときランダム生成して localStorage に保存し、
 * 以降は同じ名前を返す。
 *
 * `rand` は 0〜1 の乱数源を差し替えるためのテスト用パラメータ。
 */
export function generatePlayerName(rand: () => number = Math.random): string {
  const storage = getStorage()
  if (storage !== null) {
    try {
      const stored = storage.getItem(STORAGE_KEYS.playerName)
      if (stored !== null && stored.length > 0) return stored
    } catch {
      // ignore and fall through
    }
  }
  const city = PLAYER_NAME_CITIES[Math.floor(rand() * PLAYER_NAME_CITIES.length)]
  const number = Math.floor(rand() * 9999) + 1
  const name = `${city}${number.toString().padStart(4, '0')}`
  if (storage !== null) {
    try {
      storage.setItem(STORAGE_KEYS.playerName, name)
    } catch {
      // ignore
    }
  }
  return name
}

/**
 * テスト用：保存済みのキーを全消去する。
 * production コードからは呼ばない想定。
 */
export function __clearTacojimanStorage(): void {
  const storage = getStorage()
  if (storage === null) return
  try {
    storage.removeItem(STORAGE_KEYS.progress)
    storage.removeItem(STORAGE_KEYS.highScore)
    storage.removeItem(STORAGE_KEYS.playerName)
  } catch {
    // ignore
  }
}
