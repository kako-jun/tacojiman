export const COLORS = {
  background: 0x111512,
  sky: 0xf2b47c,
  sea: 0x34779b,
  river: 0x4f9cc6,
  riceField: 0x5c8f3b,
  path: 0xa97944,
  rail: 0x4f5159,
  playerHouse: 0xf4ece0,
  otherHouse: 0xb98052,
  station: 0xd8d1c4,
  enemyHp2: 0xc94043,
  enemyHp1: 0xf18496,
  uiText: 0xf9f3e7,
  uiMuted: 0x312d2a,
  uiAccent: 0xffd36f,
} as const

export const PANEL_COLORS = {
  water: COLORS.sea,
  river: COLORS.river,
  rice_field: COLORS.riceField,
  path: COLORS.path,
  rail: COLORS.rail,
  player_house: COLORS.playerHouse,
  other_house: COLORS.otherHouse,
  station: COLORS.station,
} as const
