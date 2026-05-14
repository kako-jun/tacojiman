// マップパネルの種類
export type PanelType = 
  | 'water'         // 水パネル（海・川）
  | 'rice_field'    // 田んぼパネル
  | 'other_house'   // 他人の家パネル
  | 'station'       // 駅パネル
  | 'rail'          // 線路パネル
  | 'player_house'  // 自分の家パネル
  | 'path'          // あぜ道パネル

// パネルの接続情報
export interface PanelConnections {
  north: boolean
  south: boolean
  east: boolean
  west: boolean
}

// マップパネルのデータ
export interface MapPanel {
  x: number
  y: number
  type: PanelType
  connections: PanelConnections
  isInvulnerable?: boolean  // 他人の家の無敵フラグ
}

// パネルの特性設定
export const PANEL_CONFIG = {
  water: {
    color: 0x000088,
    alpha: 0.7,
    clusterMin: 2,      // 最小連続数
    clusterMax: 6,      // 最大連続数
    frequency: 0.15     // 出現頻度
  },
  rice_field: {
    color: 0x008800,
    alpha: 0.7,
    frequency: 0.4      // 最も多い
  },
  other_house: {
    color: 0x884400,
    alpha: 0.8,
    count: 2,           // 固定2個
    isInvulnerable: true
  },
  station: {
    color: 0x444444,
    alpha: 0.8,
    count: 1            // 固定1個
  },
  rail: {
    color: 0x666666,
    alpha: 0.7,
    minLength: 3,       // 最小長さ
    maxLength: 8        // 最大長さ
  },
  player_house: {
    color: 0x888888,
    alpha: 1.0,
    count: 1            // 固定1個（中央）
  },
  path: {
    color: 0xaa8844,
    alpha: 0.6,
    mustConnect: true   // 端から端へ接続必須
  }
} as const