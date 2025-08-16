import { z } from 'zod'

// ゲーム基本設定
export const GameConfigSchema = z.object({
  width: z.number().default(400),
  height: z.number().default(600),
  maxEnemies: z.number().default(50),
  gameDuration: z.number().default(180), // 3分間
  bossBattleStart: z.number().default(170), // 2分50秒
})

export type GameConfig = z.infer<typeof GameConfigSchema>

// タコロボの種類
export const EnemyTypeSchema = z.enum(['ground', 'water', 'air', 'underground'])
export type EnemyType = z.infer<typeof EnemyTypeSchema>

// タコロボデータ
export const EnemyDataSchema = z.object({
  type: EnemyTypeSchema,
  hp: z.number().min(1).max(2),
  speed: z.number().positive(),
  score: z.number().positive(),
  spawnRoute: z.string(),
  color: z.object({
    hp2: z.string(), // 赤色
    hp1: z.string(), // ピンク色
  }),
})

export type EnemyData = z.infer<typeof EnemyDataSchema>

// ボム忍術の種類
export const BombTypeSchema = z.enum(['proton', 'muddy', 'sentry'])
export type BombType = z.infer<typeof BombTypeSchema>

// ボム忍術データ
export const BombDataSchema = z.object({
  type: BombTypeSchema,
  name: z.string(),
  description: z.string(),
  damage: z.number().positive(),
  duration: z.number().optional(), // セントリーガンなどの持続時間
  range: z.number().positive(),
})

export type BombData = z.infer<typeof BombDataSchema>

// スコア範囲とエンディング
export const EndingDataSchema = z.object({
  minScore: z.number(),
  maxScore: z.number().optional(),
  level: z.string(),
  description: z.string(),
  unlocksTitle: z.number().min(0).max(10), // タイトル進捗レベル
})

export type EndingData = z.infer<typeof EndingDataSchema>

// ゲーム状態
export const GameStateSchema = z.object({
  score: z.number().default(0),
  timeRemaining: z.number().default(180),
  bombStock: z.number().min(0).max(1).default(1),
  currentBombType: BombTypeSchema.optional(),
  isGameOver: z.boolean().default(false),
  titleProgressLevel: z.number().min(0).max(10).default(0),
})

export type GameState = z.infer<typeof GameStateSchema>

// API レスポンス（Nostalgicアプリ連携用）
export const RankingEntrySchema = z.object({
  rank: z.number().positive(),
  playerName: z.string(),
  score: z.number(),
  timestamp: z.string(), // ISO 8601 format
})

export type RankingEntry = z.infer<typeof RankingEntrySchema>

export const RankingResponseSchema = z.object({
  daily: z.array(RankingEntrySchema),
  weekly: z.array(RankingEntrySchema),
  allTime: z.array(RankingEntrySchema),
})

export type RankingResponse = z.infer<typeof RankingResponseSchema>

// 設定ファイル用（YAML）
export const SettingsSchema = z.object({
  graphics: z.object({
    pixelArt: z.boolean().default(true),
    colorTemperature: z.number().default(0.8), // 朝焼けの色温度
    enableTrails: z.boolean().default(true), // 残像エフェクト
  }),
  audio: z.object({
    enableSounds: z.boolean().default(false), // デフォルトは無音
    enableNatureSounds: z.boolean().default(false),
    volume: z.number().min(0).max(1).default(0),
  }),
  gameplay: z.object({
    enableVibration: z.boolean().default(false),
    autoSubmitRanking: z.boolean().default(true),
  }),
})

export type Settings = z.infer<typeof SettingsSchema>

// マップ生成用
export const TerrainTypeSchema = z.enum(['sea', 'river', 'field', 'road', 'station', 'farm', 'house'])
export type TerrainType = z.infer<typeof TerrainTypeSchema>

export const MapTileSchema = z.object({
  x: z.number(),
  y: z.number(),
  terrain: TerrainTypeSchema,
  connections: z.object({
    north: z.boolean().default(false),
    south: z.boolean().default(false),
    east: z.boolean().default(false),
    west: z.boolean().default(false),
  }),
})

export type MapTile = z.infer<typeof MapTileSchema>