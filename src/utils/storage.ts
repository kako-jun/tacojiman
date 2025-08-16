import { z } from 'zod'
import { SettingsSchema, GameStateSchema, STORAGE_KEYS } from '@/utils/config'
import type { Settings, GameState } from '@/types'

/**
 * ローカルストレージから型安全にデータを取得
 */
export function getStorageData<T>(
  key: string,
  schema: z.ZodSchema<T>,
  defaultValue: T
): T {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return defaultValue
    
    const parsed = JSON.parse(stored)
    return schema.parse(parsed)
  } catch (error) {
    console.warn(`Failed to load ${key} from storage:`, error)
    return defaultValue
  }
}

/**
 * ローカルストレージに型安全にデータを保存
 */
export function setStorageData<T>(
  key: string,
  data: T,
  schema: z.ZodSchema<T>
): void {
  try {
    const validated = schema.parse(data)
    localStorage.setItem(key, JSON.stringify(validated))
  } catch (error) {
    console.error(`Failed to save ${key} to storage:`, error)
  }
}

/**
 * 設定の読み込み
 */
export function loadSettings(): Settings {
  return getStorageData(
    STORAGE_KEYS.SETTINGS,
    SettingsSchema,
    SettingsSchema.parse({})
  )
}

/**
 * 設定の保存
 */
export function saveSettings(settings: Settings): void {
  setStorageData(STORAGE_KEYS.SETTINGS, settings, SettingsSchema)
}

/**
 * タイトル画面の進捗レベル取得
 */
export function getTitleProgress(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TITLE_PROGRESS)
    return stored ? Math.max(0, Math.min(10, parseInt(stored))) : 0
  } catch {
    return 0
  }
}

/**
 * タイトル画面の進捗レベル保存
 */
export function setTitleProgress(level: number): void {
  const validLevel = Math.max(0, Math.min(10, level))
  localStorage.setItem(STORAGE_KEYS.TITLE_PROGRESS, validLevel.toString())
}

/**
 * ハイスコア取得
 */
export function getHighScore(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.HIGH_SCORE)
    return stored ? Math.max(0, parseInt(stored)) : 0
  } catch {
    return 0
  }
}

/**
 * ハイスコア保存
 */
export function setHighScore(score: number): void {
  const validScore = Math.max(0, score)
  localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, validScore.toString())
}

/**
 * 自動生成されるプレイヤー名（IPベース）
 */
export function generatePlayerName(): string {
  // 実際の実装では、IPアドレスのハッシュなどを使用
  // ここでは簡単な実装
  const stored = localStorage.getItem('tacojiman_player_id')
  if (stored) return stored
  
  const cities = ['東京', '大阪', '横浜', '名古屋', '札幌', '福岡', '神戸', '仙台']
  const city = cities[Math.floor(Math.random() * cities.length)]
  const number = Math.floor(Math.random() * 9999) + 1
  const name = `${city}${number.toString().padStart(4, '0')}`
  
  localStorage.setItem('tacojiman_player_id', name)
  return name
}