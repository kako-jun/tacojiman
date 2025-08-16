import * as yaml from 'js-yaml'
import { z } from 'zod'
import { 
  GameConfigSchema, 
  SettingsSchema, 
  EnemyDataSchema, 
  BombDataSchema, 
  EndingDataSchema 
} from '@/types'

// 設定ファイルのパース
export async function loadYamlConfig<T>(
  filePath: string, 
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const response = await fetch(filePath)
    const yamlText = await response.text()
    const data = yaml.load(yamlText)
    
    return schema.parse(data)
  } catch (error) {
    console.error(`Failed to load config from ${filePath}:`, error)
    throw error
  }
}

// API レスポンスの検証
export function validateApiResponse<T>(
  data: unknown, 
  schema: z.ZodSchema<T>
): T {
  try {
    return schema.parse(data)
  } catch (error) {
    console.error('API response validation failed:', error)
    throw new Error('Invalid API response format')
  }
}

// デフォルト設定
export const DEFAULT_GAME_CONFIG = GameConfigSchema.parse({
  width: 400,
  height: 600,
  maxEnemies: 50,
  gameDuration: 180,
  bossBattleStart: 170
})

export const DEFAULT_SETTINGS = SettingsSchema.parse({
  graphics: {
    pixelArt: true,
    colorTemperature: 0.8,
    enableTrails: true
  },
  audio: {
    enableSounds: false,
    enableNatureSounds: false,
    volume: 0
  },
  gameplay: {
    enableVibration: false,
    autoSubmitRanking: true
  }
})

// 敵データ（TypeScriptで型安全に定義）
export const ENEMY_DATA = [
  EnemyDataSchema.parse({
    type: 'ground',
    hp: 2,
    speed: 1.0,
    score: 1,
    spawnRoute: 'road',
    color: { hp2: '#FF4444', hp1: '#FF8888' }
  }),
  EnemyDataSchema.parse({
    type: 'water',
    hp: 2,
    speed: 0.8,
    score: 2,
    spawnRoute: 'river',
    color: { hp2: '#FF4444', hp1: '#FF8888' }
  }),
  EnemyDataSchema.parse({
    type: 'air',
    hp: 2,
    speed: 1.5,
    score: 3,
    spawnRoute: 'sky',
    color: { hp2: '#FF4444', hp1: '#FF8888' }
  }),
  EnemyDataSchema.parse({
    type: 'underground',
    hp: 2,
    speed: 0.5,
    score: 4,
    spawnRoute: 'underground',
    color: { hp2: '#FF4444', hp1: '#FF8888' }
  })
] as const

// ボム忍術データ
export const BOMB_DATA = [
  BombDataSchema.parse({
    type: 'proton',
    name: '浦恋菊流怒之術',
    description: 'プロトンビーム - 直線状の敵を一掃',
    damage: 1,
    range: 1000 // 画面全体
  }),
  BombDataSchema.parse({
    type: 'muddy',
    name: '埋弟盆流怒之術',
    description: 'マッディボム - 地雷を設置',
    damage: 1,
    range: 100
  }),
  BombDataSchema.parse({
    type: 'sentry',
    name: '千鳥臥流怒之術',
    description: 'セントリーガン - 自動連射砲台',
    damage: 1,
    duration: 5, // 5秒間
    range: 150
  })
] as const

// エンディングデータ
export const ENDING_DATA = [
  EndingDataSchema.parse({
    minScore: 0,
    maxScore: 1000,
    level: 'bad',
    description: 'バッドエンド - もう来ない...',
    unlocksTitle: 1
  }),
  EndingDataSchema.parse({
    minScore: 1001,
    maxScore: 3000,
    level: 'normal',
    description: 'ノーマルエンド - 今日は大事な日だったのに...',
    unlocksTitle: 2
  }),
  EndingDataSchema.parse({
    minScore: 3001,
    maxScore: 5000,
    level: 'good',
    description: 'グッドエンド - 目元が見え、涙を浮かべる',
    unlocksTitle: 5
  }),
  EndingDataSchema.parse({
    minScore: 5001,
    maxScore: 8000,
    level: 'special',
    description: 'スペシャルエンド - 本当は...好きだったの',
    unlocksTitle: 8
  }),
  EndingDataSchema.parse({
    minScore: 8001,
    level: 'true',
    description: '真エンディング - 全ての真実と未来への約束',
    unlocksTitle: 10
  })
] as const

// ローカルストレージキー
export const STORAGE_KEYS = {
  SETTINGS: 'tacojiman_settings',
  TITLE_PROGRESS: 'tacojiman_title_progress',
  HIGH_SCORE: 'tacojiman_high_score'
} as const

// ランキングAPI設定（Nostalgicアプリ連携）
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://api.nostalgic.app',
  ENDPOINTS: {
    SUBMIT_SCORE: '/tacojiman/score',
    GET_RANKINGS: '/tacojiman/rankings'
  }
} as const