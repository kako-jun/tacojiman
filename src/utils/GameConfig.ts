/**
 * ゲーム全体の設定値を一元管理
 * マジックナンバーを排除し、調整を容易にする
 */

export const GAME_CONFIG = {
  // ゲーム基本設定
  GAME: {
    TOTAL_DURATION_SECONDS: 180,           // ゲーム総時間（秒）
    TAKOKONG_SPAWN_TIME_REMAINING: 110,    // タココング出現時間（残り秒）
    INITIAL_BOMB_STOCK: 1,                 // 初期ボムストック数
    MAX_BOMB_STOCK: 1,                     // 最大ボムストック数
    BOMB_RECOVERY_TIMES: [120, 60],        // ボム回復タイミング（残り秒）
  },

  // スコア関連設定
  SCORE: {
    ENDING_THRESHOLDS: {
      TRUE_ENDING: 8001,
      SPECIAL_ENDING: 5001,
      GOOD_ENDING: 3001,
      NORMAL_ENDING: 1001,
      BAD_ENDING: 0
    },
    ZOOM_MULTIPLIER: {
      MIN: 1.0,
      MAX: 3.0,
      ZOOM_IN_TARGET: 3.0
    }
  },

  // 攻撃システム設定
  ATTACK: {
    NORMAL_ATTACK_RADIUS: 80,              // 通常攻撃の半径（ピクセル）
    TAKOKONG_ATTACK_RADIUS: 40,            // タココング攻撃の半径
    HOUSE_CLICK_RADIUS: 30,                // 家クリック判定の半径
    HOUSE_REACH_RADIUS: 25,                // 敵が家に到達とみなす半径
    ENEMY_COLLISION_RADIUS: 60,            // 敵との当たり判定半径（攻撃時）
    ENEMY_ZOOM_DETECTION_RADIUS: 25,       // 敵のズーム判定半径（敵の実サイズ相当）
  },

  // 敵システム設定
  ENEMY: {
    INITIAL_MAX_COUNT: 40,                 // 初期最大敵数
    ABSOLUTE_MAX_COUNT: 70,                // 絶対最大敵数
    ENEMY_INCREASE_PER_CYCLE: 5,           // サイクルあたりの敵数増加
    DIFFICULTY_CYCLE_SECONDS: 15,          // 難易度上昇サイクル（秒）
    
    INITIAL_SPAWN_DELAY: 500,              // 初期出現間隔（ms）
    MIN_SPAWN_DELAY: 200,                  // 最小出現間隔（ms）
    SPAWN_RATE_MULTIPLIER: 0.8,            // 出現間隔短縮率
    
    INITIAL_GROUND_ENEMIES: 3,             // 開始時の地上タコ数
    INITIAL_SPAWN_INTERVAL: 200,           // 初期出現時の間隔（ms）
    
    SPAWN_WEIGHTS: {
      ground: 0.5,      // 地上タコ50%
      water: 0.25,      // 水タコ25%
      air: 0.15,        // 空タコ15%
      underground: 0.1  // 地下タコ10%
    }
  },

  // タココング設定
  TAKOKONG: {
    BASE_HP: 42,                           // 基本HP
    BASE_SCORE: 10,                        // 基本スコア
    MOVEMENT_SPEED_MULTIPLIER: 2.0,        // 移動速度倍率
    DEFEAT_BONUS_SCORE: 100,               // 撃破ボーナス
    FINAL_BATTLE_DELAY: 1000,              // 撃破後ゲーム終了までの遅延（ms）
  },

  // マップ設定
  MAP: {
    TILE_SIZE: 30,                         // タイルサイズ（ピクセル）
    SIZE_MULTIPLIER: 1.4,                  // 回転対応のサイズ倍率
    BASE_COLOR: 0x004400,                  // 基本背景色
    
    ROTATION: {
      MIN_DURATION: 120000,                // 最小回転時間（ms）：2分
      MAX_DURATION: 180000,                // 最大回転時間（ms）：3分
      RANDOM_DURATION_RANGE: 60000,        // ランダム幅（ms）：1分
    },
    
    UNDERGROUND_SPAWN_MAX_DISTANCE: 90,    // 地下敵の家からの最大出現距離
    NEAR_HOUSE_SPAWN_MIN_RADIUS: 3,        // 家近接出現の最小半径（タイル）
    NEAR_HOUSE_SPAWN_MAX_RADIUS: 6,        // 家近接出現の最大半径（タイル）
  },

  // UI設定
  UI: {
    CLOCK_UPDATE_INTERVAL: 100,            // 時計更新間隔（ms）
    GAME_TIMER_INTERVAL: 1000,             // ゲームタイマー間隔（ms）
    
    EFFECT_DURATIONS: {
      ATTACK_EFFECT: 300,                  // 攻撃エフェクト表示時間
      SCORE_GAIN: 1500,                    // スコア獲得エフェクト時間
      SCORE_LOSS: 1800,                    // スコア減少エフェクト時間
      BOMB_EFFECT: 500,                    // ボムエフェクト時間
      MULTI_HIT: 200,                      // 多段ヒットエフェクト時間
      CONTINUOUS_HIT: 150,                 // 連続ヒットエフェクト時間
      HOUSE_DAMAGE_BLINK: 100,             // 家ダメージ点滅時間
    },
    
    FONT_SETTINGS: {
      FAMILY: 'monospace',
      STROKE_COLOR: '#000000',
      DEFAULT_STROKE_THICKNESS: 2,
      SCORE_STROKE_THICKNESS: 4,
    }
  },

  // スクリーンショット設定
  SCREENSHOT: {
    INTERVAL_SECONDS: 60,                  // 撮影間隔（秒）
    MAX_COUNT: 3,                          // 最大撮影枚数
    REPEAT_COUNT: 2,                       // タイマーのリピート回数（3回実行用）
    
    THUMBNAIL: {
      WIDTH: 80,                           // サムネイル幅
      HEIGHT: 60,                          // サムネイル高さ
      SPACING: 90,                         // サムネイル間隔
      BORDER_WIDTH: 2,                     // 枠線幅
      BORDER_COLOR: 0xffffff,              // 枠線色
      BORDER_ALPHA: 0.8,                   // 枠線透明度
    }
  },

  // エフェクト表示設定
  EFFECTS: {
    SCORE_DISPLAY: {
      OFFSET_Y: -40,                       // Y座標オフセット
      MOVE_DISTANCE: -60,                  // 移動距離
      PADDING: 8,                          // テキスト枠のパディング
      FRAME_ALPHA: 0.7,                    // 枠の透明度
    },
    
    DAMAGE_DISPLAY: {
      OFFSET_Y: -30,                       // Y座標オフセット
      MOVE_DISTANCE: 100,                  // 移動距離（下方向）
      PADDING: 8,                          // テキスト枠のパディング
    },
    
    ATTACK_EFFECT: {
      HIT_COLOR: 0xffff00,                 // ヒット時の色
      MISS_COLOR: 0x888888,                // ミス時の色
      ALPHA: 0.5,                          // 透明度
    }
  },

  // 時刻システム設定
  TIME: {
    GAME_TIME_RATIO: 30 / 180,             // ゲーム内30分を実時間3分で進行
    SECOND_SPEED_MULTIPLIER: 10,           // 秒の進行速度（10倍速）
    SECOND_UPDATE_INTERVAL: 100,           // 秒更新間隔（ms）
    REAL_TO_GAME_TIME_RATIO: 180000,       // 実時間3分（180000ms）
    GAME_TOTAL_MINUTES: 30,                // ゲーム内総時間（分）
    
    DIFFICULTY_MULTIPLIERS: {              // 時刻別難易度倍率
      4: 1.5,
      5: 1.4,
      6: 1.3,
      7: 1.2,
      8: 1.0
    },
    
    DEFAULT_START_TIME: '7:00:00 AM',       // デフォルト開始時刻
    TIME_FORMAT_REGEX: /(\d+):(\d+):(\d+) AM/, // 時刻パースパターン
  },

  // ボム忍術設定
  BOMB: {
    PROTON_BEAM: {
      CHARGE_TIME: 2000,                   // チャージ時間（ms）
      DAMAGE: 1,                           // ダメージ
      WIDTH_RATIO: 0.2,                    // 画面幅に対する比率
    },
    
    MUDDY_BOMB: {
      RANGE_LIMIT: 3,                      // 設置範囲（タイル数）
      DAMAGE: 1,                           // ダメージ
    },
    
    SENTRY_GUN: {
      RANGE_LIMIT: 5,                      // 設置範囲（タイル数）
      OPERATION_TIME: 5000,                // 動作時間（ms）
      ATTACK_INTERVAL: 200,                // 攻撃間隔（ms）
      ATTACK_RANGE: 2,                     // 攻撃範囲（タイル数）
      DAMAGE: 1,                           // ダメージ
    },
    
    // ボムタイプリスト
    AVAILABLE_TYPES: ['proton', 'muddy', 'sentry', 'muteki', 'sol', 'dainsleif', 'jakuhou', 'bunshin'] as const
  },

  // 入力システム設定
  INPUT: {
    LONG_PRESS_THRESHOLD: 300,             // 長押し判定時間（ms）
    ZOOM_PREVENTION_RADIUS: 60,            // ズーム防止半径（敵がいる場合）
  },

  // 数値定数
  NUMBERS: {
    ZERO: 0,
    ONE: 1,
    TWO: 2,
    PROGRESS_MAX: 10,                      // 進捗最大値
    TILE_SEARCH_ATTEMPTS: 50,              // タイル検索試行回数
    ROTATION_FULL_CIRCLE: Math.PI * 2,     // 一回転のラジアン
    PERCENTAGE_HALF: 0.5,                  // 50%
  },

  // 色定数
  COLORS: {
    TRANSPARENT: 0x000000,
    WHITE: 0xffffff,
    BLACK: 0x000000,
    RED: 0xff0000,
    GREEN: 0x00ff00,
    BLUE: 0x0000ff,
    YELLOW: 0xffff00,
    PURPLE: 0x8800ff,
    ORANGE: 0xffaa00,
    GRAY: 0x888888,
  },

  // エラーメッセージ
  MESSAGES: {
    INVALID_TIME_FORMAT: 'Invalid time format',
    CANVAS_CONTEXT_FAILED: 'Canvas context creation failed',
    IMAGE_CONVERSION_FAILED: 'Image conversion failed',
    UNKNOWN_SCREENSHOT_ERROR: 'Unknown screenshot error',
    INVALID_IMAGE_DATA: 'Invalid image data',
  }
} as const

// 型エクスポート用
export type GameConfig = typeof GAME_CONFIG