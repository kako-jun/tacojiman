import { describe, expect, it } from 'vitest'
import type { MapPanel } from '../types/GameState'
import { createInitialGameState } from '../types/GameState'
import { findPath, generateMap } from './map'

describe('generateMap', () => {
  it('places the player house at the center', () => {
    const map = generateMap(19, 25)

    expect(map[9][12].type).toBe('player_house')
  })

  it('creates connected path and rail networks', () => {
    const map = generateMap(19, 25)

    expect(map[9][10].connections.south).toBe(true)
    expect(map[9][14].connections.north).toBe(true)
    expect(map[4][8].type).toBe('station')
    expect(map[5][8].connections.west).toBe(true)
  })
})

// helpers
function p(x: number, y: number, type: MapPanel['type'], connections: Partial<MapPanel['connections']> = {}): MapPanel {
  return {
    x,
    y,
    type,
    connections: { north: false, south: false, east: false, west: false, ...connections },
  }
}

describe('findPath — 正常系', () => {
  it('直線経路が取得できる（返値が [中間, goal] になること）', () => {
    // x=0 -> x=1 -> x=2 の直線
    const map: MapPanel[][] = [
      [p(0, 0, 'path', { east: true })],
      [p(1, 0, 'path', { west: true, east: true })],
      [p(2, 0, 'path', { west: true })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 })

    expect(result).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }])
  })

  it('L字経路が取得できる（折れ曲がった経路を正しく返すこと）', () => {
    // (0,0) east-> (1,0) south-> (1,1)
    const map: MapPanel[][] = [
      [p(0, 0, 'path', { east: true }), p(0, 1, 'river')],
      [p(1, 0, 'path', { west: true, south: true }), p(1, 1, 'path', { north: true })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 1, y: 1 })

    expect(result).toEqual([{ x: 1, y: 0 }, { x: 1, y: 1 }])
  })

  it('返値に start は含まれない', () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'path', { east: true })],
      [p(1, 0, 'path', { west: true })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 1, y: 0 })

    expect(result.some((n) => n.x === 0 && n.y === 0)).toBe(false)
  })

  it('返値の末尾が goal である', () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'path', { east: true })],
      [p(1, 0, 'path', { west: true, east: true })],
      [p(2, 0, 'path', { west: true })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 })

    expect(result[result.length - 1]).toEqual({ x: 2, y: 0 })
  })

  it('start === goal のとき空配列を返す', () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'path', {})],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 0, y: 0 })

    expect(result).toEqual([])
  })
})

describe('findPath — 異常系 / 境界値 / null', () => {
  it('start が map 範囲外（負座標）のとき [] を返す', () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'path', {})],
    ]
    const result = findPath(map, { x: -1, y: 0 }, { x: 0, y: 0 })

    expect(result).toEqual([])
  })

  it('goal が map 範囲外のとき [] を返す', () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'path', {})],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 5, y: 5 })

    expect(result).toEqual([])
  })

  it('start パネルが non-walkable（water）のとき [] を返す', () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'water', { east: true })],
      [p(1, 0, 'path', { west: true })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 1, y: 0 })

    expect(result).toEqual([])
  })

  it('goal パネルが non-walkable のとき [] を返す', () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'path', { east: true })],
      [p(1, 0, 'river', { west: true })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 1, y: 0 })

    expect(result).toEqual([])
  })
})

describe('findPath — 到達不能 / 孤立', () => {
  it('接続のない孤立 start から [] を返す（connections が全 false）', () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'path', {}), p(0, 1, 'path', {})],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 0, y: 1 })

    expect(result).toEqual([])
  })

  it('経路が存在しない（グラフ的に非連結）とき [] を返す', () => {
    // 2つのパネルが隣接しているが接続されていない
    const map: MapPanel[][] = [
      [p(0, 0, 'path', { east: false })],
      [p(1, 0, 'path', { west: false })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 1, y: 0 })

    expect(result).toEqual([])
  })
})

describe('findPath — 同値分割（PanelType の walkable 境界）', () => {
  it("'path' は walkable として経由できる", () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'path', { east: true })],
      [p(1, 0, 'path', { west: true, east: true })],
      [p(2, 0, 'path', { west: true })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 })

    expect(result.length).toBeGreaterThan(0)
  })

  it("'rail' は walkable として経由できる", () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'path', { east: true })],
      [p(1, 0, 'rail', { west: true, east: true })],
      [p(2, 0, 'path', { west: true })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 })

    expect(result.length).toBeGreaterThan(0)
  })

  it("'station' は walkable として経由できる", () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'path', { east: true })],
      [p(1, 0, 'station', { west: true, east: true })],
      [p(2, 0, 'path', { west: true })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 })

    expect(result.length).toBeGreaterThan(0)
  })

  it("'player_house' は walkable として goal になれる", () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'path', { east: true })],
      [p(1, 0, 'player_house', { west: true })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 1, y: 0 })

    expect(result).toEqual([{ x: 1, y: 0 }])
  })

  it("'other_house' は non-walkable として経由されない", () => {
    // (0,0) -> (1,0)[other_house] -> (2,0) の直線だが other_house は通れない
    const map: MapPanel[][] = [
      [p(0, 0, 'path', { east: true })],
      [p(1, 0, 'other_house', { west: true, east: true })],
      [p(2, 0, 'path', { west: true })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 })

    expect(result).toEqual([])
  })

  it("'river' は non-walkable として経由されない", () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'path', { east: true })],
      [p(1, 0, 'river', { west: true, east: true })],
      [p(2, 0, 'path', { west: true })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 })

    expect(result).toEqual([])
  })
})

describe('findPath — 事故パターン', () => {
  it('1ステップ経路（start の隣が goal）で cameFrom 復元が壊れないこと', () => {
    const map: MapPanel[][] = [
      [p(0, 0, 'path', { east: true })],
      [p(1, 0, 'path', { west: true })],
    ]
    const result = findPath(map, { x: 0, y: 0 }, { x: 1, y: 0 })

    expect(result).toEqual([{ x: 1, y: 0 }])
  })
})

describe('generateMap — connections 構造検証（drawMap の描画前提）', () => {
  // generateMap(19, 25): centerX=9, centerY=12
  // player_house: map[9][12]
  // station:      map[4][8]  (centerX-5=4, centerY-4=8)
  // rail:         map[1..6][8] (centerX-8=1 〜 centerX-3=6, y=8)
  // path col:     x=9 (centerX), y=12 (centerY), x=6 (centerX-3)

  it('path パネルが隣接 path への connections を持つこと（north/south）', () => {
    const map = generateMap(19, 25)

    // x=9 (centerX) は縦 path。y=5 の上下は同じ path 列
    const panel = map[9][5]
    expect(panel.type).toBe('path')
    // y=4 も path（centerX 列）、y=6 も path
    expect(map[9][4].type).toBe('path')
    expect(map[9][6].type).toBe('path')
    expect(panel.connections.north).toBe(true)
    expect(panel.connections.south).toBe(true)
  })

  it('path パネルが隣接 path への connections を持つこと（east/west）', () => {
    const map = generateMap(19, 25)

    // y=12 (centerY) は横 path 行。x=7, x=8, x=9 は連続 path
    const panel = map[8][12]
    expect(panel.type).toBe('path')
    expect(map[7][12].type).toBe('path')
    expect(map[9][12].type).toBe('player_house') // 隣は player_house（PATH_NETWORK）
    expect(panel.connections.west).toBe(true)
    expect(panel.connections.east).toBe(true) // player_house も PATH_NETWORK
  })

  it('rail パネルが隣接 rail への connections を持つこと（east/west）', () => {
    const map = generateMap(19, 25)

    // rail: x=1..6, y=8。中間の x=3 は両隣が rail
    const panel = map[3][8]
    expect(panel.type).toBe('rail')
    expect(map[2][8].type).toBe('rail')
    expect(map[4][8].type).toBe('station')
    expect(panel.connections.west).toBe(true)
    expect(panel.connections.east).toBe(true) // station も rail ネットワーク
  })

  it('rail パネルが path と接続しないこと（異ネットワーク）', () => {
    const map = generateMap(19, 25)

    // rail の x=6, y=8 の south: y=9 は path（centerX-3=6 列）
    const panel = map[6][8]
    expect(panel.type).toBe('rail')
    expect(map[6][9].type).toBe('path')
    expect(panel.connections.south).toBe(false)
  })

  it('station パネルが隣接 rail への connections を持つこと', () => {
    const map = generateMap(19, 25)

    // station: map[4][8]。x=3,y=8 は rail、x=5,y=8 は rail
    const panel = map[4][8]
    expect(panel.type).toBe('station')
    expect(map[3][8].type).toBe('rail')
    expect(map[5][8].type).toBe('rail')
    expect(panel.connections.west).toBe(true)
    expect(panel.connections.east).toBe(true)
  })

  it('station パネルが path と接続しないこと（異ネットワーク）', () => {
    const map = generateMap(19, 25)

    const panel = map[4][8]
    expect(panel.type).toBe('station')
    // north: map[4][7] は rice_field、south: map[4][9] も rice_field
    expect(isNonConnectable(map[4][7].type)).toBe(true)
    expect(panel.connections.north).toBe(false)
    expect(panel.connections.south).toBe(false)
  })

  it('player_house が隣接 path からの接続を持つこと（#6 修正確認）', () => {
    const map = generateMap(19, 25)

    // player_house: map[9][12]
    // north: map[9][11] は path（centerX 列）
    const panel = map[9][12]
    expect(panel.type).toBe('player_house')
    expect(map[9][11].type).toBe('path')
    expect(panel.connections.north).toBe(true)
  })

  it('player_house の connections は南方向の隣接 path と接続していること', () => {
    const map = generateMap(19, 25)

    // player_house: map[9][12]。south: map[9][13] は path（centerY 行）
    const panel = map[9][12]
    expect(map[9][13].type).toBe('path')
    expect(panel.connections.south).toBe(true)
  })

  it('other_house が connections を一切持たないこと（non-connectable）', () => {
    const map = generateMap(19, 25)

    // other_house: map[2][17] (x=2, centerY+5=17)
    const panel = map[2][17]
    expect(panel.type).toBe('other_house')
    expect(panel.connections.north).toBe(false)
    expect(panel.connections.south).toBe(false)
    expect(panel.connections.east).toBe(false)
    expect(panel.connections.west).toBe(false)
  })

  it('water パネルが connections を持たないこと', () => {
    const map = generateMap(19, 25)

    // water: x > cols-5 (x >= 15), y < rows-8 (y <= 16)。map[15][5] は water
    const panel = map[15][5]
    expect(panel.type).toBe('water')
    expect(panel.connections.north).toBe(false)
    expect(panel.connections.south).toBe(false)
    expect(panel.connections.east).toBe(false)
    expect(panel.connections.west).toBe(false)
  })

  it('river パネルが connections を持たないこと', () => {
    const map = generateMap(19, 25)

    // river: x=cols-6=13, y < centerY+2=14。map[13][5] は river
    const panel = map[13][5]
    expect(panel.type).toBe('river')
    expect(panel.connections.north).toBe(false)
    expect(panel.connections.south).toBe(false)
    expect(panel.connections.east).toBe(false)
    expect(panel.connections.west).toBe(false)
  })

  it('rice_field パネルが connections を持たないこと', () => {
    const map = generateMap(19, 25)

    // rice_field: 上記以外の多くのセル。map[1][1] は rice_field
    const panel = map[1][1]
    expect(panel.type).toBe('rice_field')
    expect(panel.connections.north).toBe(false)
    expect(panel.connections.south).toBe(false)
    expect(panel.connections.east).toBe(false)
    expect(panel.connections.west).toBe(false)
  })
})

// テスト内で使うローカルヘルパー
function isNonConnectable(type: string): boolean {
  return !['path', 'rail', 'station', 'player_house'].includes(type)
}

describe('EnemyState.route 初期化', () => {
  it('createInitialGameState の各敵に route: [] が存在すること', () => {
    const state = createInitialGameState()

    for (const enemy of state.enemies) {
      expect(Array.isArray(enemy.route)).toBe(true)
      expect(enemy.route).toEqual([])
    }
  })
})

describe('実際のマップでの統合確認', () => {
  it('generateMap(19, 25) でマップ端の path パネルから別の path パネルまで findPath が非空の経路を返すこと', () => {
    const map = generateMap(19, 25)

    // マップ端の walkable パネルを start にする（x=0, y=12 は edge path）
    const start = { x: 0, y: 12 }
    // マップ反対側の path パネルを goal にする（x=8, y=12 は端側の path）
    const goal = { x: 6, y: 12 }

    const result = findPath(map, start, goal)
    expect(result.length).toBeGreaterThan(0)
    expect(result[result.length - 1]).toEqual(goal)
  })

  it('generateMap で生成した実マップの path から player_house まで経路が見つかる', () => {
    const map = generateMap(19, 25)

    // player_house は map[9][12]
    // path パネルから player_house まで経路が見つかることを確認
    const start = { x: 9, y: 5 }  // x=9（centerX）は path
    const goal = { x: 9, y: 12 }  // player_house

    expect(map[goal.x][goal.y].type).toBe('player_house')
    expect(map[goal.x][goal.y].connections.north).toBe(true)

    const result = findPath(map, start, goal)
    expect(result.length).toBeGreaterThan(0)
    expect(result[result.length - 1]).toEqual(goal)
  })
})
