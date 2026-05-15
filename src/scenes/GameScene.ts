import { Container, Graphics, Text, type Ticker } from 'pixi.js'
import gsap from 'gsap'
import { COLORS, PANEL_COLORS } from '../constants/colors'
import {
  getClockText,
  TILE_SIZE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type Direction,
  type EnemyState,
  type GameState,
  type MapPanel,
} from '../types/GameState'
import { findPath } from '../game/map'
import { KeyboardManager } from '../game/KeyboardManager'

export class GameScene extends Container {
  private state: GameState | null = null
  private readonly mapLayer = new Container()
  private readonly enemyLayer = new Container()
  private readonly playerLayer = new Container()
  private readonly uiLayer = new Container()
  private readonly mapGraphics = new Graphics()
  private readonly enemyGraphics = new Graphics()
  private readonly playerGraphics = new Graphics()
  private keyboard: KeyboardManager | null = null
  private readonly clockText = new Text({
    text: '7:00 AM',
    style: {
      fill: COLORS.uiText,
      fontFamily: 'monospace',
      fontSize: 20,
      fontWeight: '700',
      stroke: { color: 0x000000, width: 4 },
    },
  })
  private readonly scoreText = new Text({
    text: '000000',
    style: {
      fill: COLORS.uiText,
      fontFamily: 'monospace',
      fontSize: 18,
      fontWeight: '700',
      stroke: { color: 0x000000, width: 4 },
    },
  })

  constructor() {
    super()
    this.mapLayer.addChild(this.mapGraphics)
    this.enemyLayer.addChild(this.enemyGraphics)
    // playerLayer は mapLayer の子にして自動回転に追従させる
    this.playerLayer.addChild(this.playerGraphics)
    this.mapLayer.addChild(this.playerLayer)
    this.addChild(this.mapLayer, this.enemyLayer, this.uiLayer)
    this.clockText.x = 14
    this.clockText.y = 12
    this.scoreText.anchor.set(1, 0)
    this.scoreText.x = VIEW_WIDTH - 14
    this.scoreText.y = 12
    this.uiLayer.addChild(this.clockText, this.scoreText)
  }

  initWithState(state: GameState): void {
    this.state = structuredClone(state)
    this.state.phase = 'playing'

    const map = this.state.map
    const width = map.length * TILE_SIZE
    const height = map[0].length * TILE_SIZE
    this.enemyLayer.x = VIEW_WIDTH / 2
    this.enemyLayer.y = VIEW_HEIGHT / 2
    // playerLayer は mapLayer の子のためオフセット設定不要

    // KeyboardManager を生成
    this.keyboard = new KeyboardManager()

    // プレイヤーの初期ピクセル座標を計算
    const { panelX, panelY } = this.state.player
    const initialPixel = this.panelToPixel(panelX, panelY)
    this.playerGraphics.x = initialPixel.x
    this.playerGraphics.y = initialPixel.y
    this.drawPlayer(this.state.player.direction)

    // A*で各敵のrouteを計算
    const goalPanel = map.flat().find((p) => p.type === 'player_house')
    if (goalPanel) {
      const offsetX = -width / 2
      const offsetY = -height / 2
      for (const enemy of this.state.enemies) {
        // ピクセル座標からpanel座標に変換
        const startX = Math.round((enemy.x - (VIEW_WIDTH / 2) - offsetX) / TILE_SIZE)
        const startY = Math.round((enemy.y - (VIEW_HEIGHT / 2) - offsetY) / TILE_SIZE)
        const route = findPath(map, { x: startX, y: startY }, { x: goalPanel.x, y: goalPanel.y })
        enemy.route = route
      }
    }

    this.draw()
  }

  getState(): GameState | null {
    return this.state === null ? null : structuredClone(this.state)
  }

  update(ticker: Ticker): void {
    if (this.state === null || this.state.phase !== 'playing') return
    this.state.elapsedMs = Math.min(
      this.state.durationMs,
      this.state.elapsedMs + ticker.deltaMS
    )
    this.mapLayer.rotation += 0.00005 * ticker.deltaMS
    this.advanceEnemies(ticker.deltaMS)
    this.drawEnemies()
    this.drawUi()
    this.tryMovePlayer()
  }

  private draw(): void {
    const state = this.requireState()
    this.drawMap(state.map)
    this.drawEnemies()
    this.drawUi()
  }

  private drawMap(map: MapPanel[][]): void {
    const width = map.length * TILE_SIZE
    const height = map[0].length * TILE_SIZE
    const offsetX = -width / 2
    const offsetY = -height / 2
    this.mapLayer.x = VIEW_WIDTH / 2
    this.mapLayer.y = VIEW_HEIGHT / 2

    this.mapGraphics.clear()
    this.mapGraphics.rect(offsetX - 80, offsetY - 80, width + 160, height + 160)
    this.mapGraphics.fill(COLORS.background)

    for (const col of map) {
      for (const panel of col) {
        const x = offsetX + panel.x * TILE_SIZE
        const y = offsetY + panel.y * TILE_SIZE
        // ベース矩形
        this.mapGraphics.rect(x, y, TILE_SIZE - 1, TILE_SIZE - 1)
        this.mapGraphics.fill(PANEL_COLORS[panel.type])

        const cx = x + TILE_SIZE / 2
        const cy = y + TILE_SIZE / 2

        if (panel.type === 'path') {
          // 接続方向への道路線（幅 8px）
          this.drawConnectionLines(cx, cy, x, y, panel.connections, 8, COLORS.pathLine)
        } else if (panel.type === 'rail') {
          // 接続方向への線路線（幅 6px）
          this.drawConnectionLines(cx, cy, x, y, panel.connections, 6, COLORS.railLine)
          // 枕木（4px × 10px を中心付近に 3 本）
          const sleeperOffsets = [-6, 0, 6]
          for (const off of sleeperOffsets) {
            this.mapGraphics.rect(cx - 5, cy + off - 2, 10, 4)
            this.mapGraphics.fill(COLORS.railSleeper)
          }
        } else if (panel.type === 'station') {
          // 接続方向への線（rail と同色・同幅）
          this.drawConnectionLines(cx, cy, x, y, panel.connections, 6, COLORS.railLine)
          // プラットフォーム矩形（中央寄り 70%）
          const platformW = (TILE_SIZE - 1) * 0.7
          const platformH = (TILE_SIZE - 1) * 0.7
          this.mapGraphics.rect(
            cx - platformW / 2,
            cy - platformH / 2,
            platformW,
            platformH
          )
          this.mapGraphics.fill(COLORS.stationPlatform)
        } else if (panel.type === 'player_house') {
          // 家らしい内側矩形（木の色）
          this.mapGraphics.rect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10)
          this.mapGraphics.fill(COLORS.playerHouseWood)
          // 接続している path 方向に玄関（4px 幅の明るい線）
          const half = 4 / 2
          if (panel.connections.north) {
            this.mapGraphics.rect(cx - half, y, half * 2, 5)
            this.mapGraphics.fill(COLORS.playerHouseDoor)
          }
          if (panel.connections.south) {
            this.mapGraphics.rect(cx - half, y + TILE_SIZE - 6, half * 2, 5)
            this.mapGraphics.fill(COLORS.playerHouseDoor)
          }
          if (panel.connections.east) {
            this.mapGraphics.rect(x + TILE_SIZE - 6, cy - half, 5, half * 2)
            this.mapGraphics.fill(COLORS.playerHouseDoor)
          }
          if (panel.connections.west) {
            this.mapGraphics.rect(x, cy - half, 5, half * 2)
            this.mapGraphics.fill(COLORS.playerHouseDoor)
          }
        } else if (panel.type === 'other_house') {
          // 屋根風の内側矩形
          const roofW = (TILE_SIZE - 1) * 0.6
          const roofH = (TILE_SIZE - 1) * 0.35
          this.mapGraphics.rect(
            cx - roofW / 2,
            y + 3,
            roofW,
            roofH
          )
          this.mapGraphics.fill(COLORS.otherHouseRoof)
        }
      }
    }
  }

  private drawConnectionLines(
    cx: number,
    cy: number,
    x: number,
    y: number,
    connections: MapPanel['connections'],
    lineWidth: number,
    color: number
  ): void {
    const half = lineWidth / 2
    if (connections.north) {
      this.mapGraphics.rect(cx - half, y, half * 2, TILE_SIZE / 2)
      this.mapGraphics.fill(color)
    }
    if (connections.south) {
      this.mapGraphics.rect(cx - half, cy, half * 2, TILE_SIZE / 2)
      this.mapGraphics.fill(color)
    }
    if (connections.east) {
      this.mapGraphics.rect(cx, cy - half, TILE_SIZE / 2, half * 2)
      this.mapGraphics.fill(color)
    }
    if (connections.west) {
      this.mapGraphics.rect(x, cy - half, TILE_SIZE / 2, half * 2)
      this.mapGraphics.fill(color)
    }
  }

  private drawEnemies(): void {
    const state = this.requireState()
    this.enemyGraphics.clear()
    for (const enemy of state.enemies) {
      this.drawEnemy(enemy)
    }
  }

  private drawEnemy(enemy: EnemyState): void {
    const color = enemy.hp > 1 ? COLORS.enemyHp2 : COLORS.enemyHp1
    const radius = enemy.type === 'takokong' ? 22 : 11
    this.enemyGraphics.circle(enemy.x, enemy.y, radius)
    this.enemyGraphics.fill(color)
    this.enemyGraphics.circle(
      enemy.x - radius * 0.35,
      enemy.y - radius * 0.2,
      2
    )
    this.enemyGraphics.circle(
      enemy.x + radius * 0.35,
      enemy.y - radius * 0.2,
      2
    )
    this.enemyGraphics.fill(0xffffff)
  }

  private drawUi(): void {
    const state = this.requireState()
    this.clockText.text = getClockText(state)
    this.scoreText.text = state.score.toString().padStart(6, '0')
  }

  private advanceEnemies(deltaMS: number): void {
    const state = this.requireState()
    const map = state.map
    const width = map.length * TILE_SIZE
    const height = map[0].length * TILE_SIZE
    const offsetX = -width / 2
    const offsetY = -height / 2

    for (const enemy of state.enemies) {
      if (enemy.route.length > 0) {
        enemy.routeProgress = Math.min(1, enemy.routeProgress + deltaMS / 18_000)
        const t = enemy.routeProgress * enemy.route.length
        const segIndex = Math.min(Math.floor(t), enemy.route.length - 1)
        const segT = t - segIndex

        const toPixel = (panel: { x: number; y: number }) => ({
          px: panel.x * TILE_SIZE + TILE_SIZE / 2 + offsetX,
          py: panel.y * TILE_SIZE + TILE_SIZE / 2 + offsetY,
        })

        if (segIndex >= enemy.route.length - 1) {
          const last = toPixel(enemy.route[enemy.route.length - 1])
          enemy.x = last.px
          enemy.y = last.py
        } else {
          const from = toPixel(enemy.route[segIndex])
          const to = toPixel(enemy.route[segIndex + 1])
          enemy.x = from.px + (to.px - from.px) * segT
          enemy.y = from.py + (to.py - from.py) * segT
        }
      } else {
        // フォールバック: 中心引き寄せ
        enemy.routeProgress += deltaMS / 18_000
        const t = Math.min(1, enemy.routeProgress)
        enemy.x += (VIEW_WIDTH / 2 - enemy.x) * t * 0.002
        enemy.y += (VIEW_HEIGHT / 2 - enemy.y) * t * 0.002
      }
    }
  }

  override destroy(): void {
    this.keyboard?.destroy()
    super.destroy()
  }

  private requireState(): GameState {
    if (this.state === null) {
      throw new Error('GameScene.initWithState must be called before use')
    }
    return this.state
  }

  private panelToPixel(panelX: number, panelY: number): { x: number; y: number } {
    const width = this.state!.map.length * TILE_SIZE
    const height = this.state!.map[0].length * TILE_SIZE
    const offsetX = -width / 2
    const offsetY = -height / 2
    return {
      x: panelX * TILE_SIZE + offsetX + TILE_SIZE / 2,
      y: panelY * TILE_SIZE + offsetY + TILE_SIZE / 2,
    }
  }

  private tryMovePlayer(): void {
    const state = this.requireState()
    if (state.player.isMoving || state.phase !== 'playing') return

    if (this.keyboard === null) return
    const dir = this.keyboard.getDirection()
    if (dir === null) return

    const { panelX, panelY } = state.player
    const currentPanel = state.map[panelX]?.[panelY]
    if (!currentPanel) return

    if (!currentPanel.connections[dir]) return

    const dx = dir === 'east' ? 1 : dir === 'west' ? -1 : 0
    const dy = dir === 'south' ? 1 : dir === 'north' ? -1 : 0
    const nextPanelX = panelX + dx
    const nextPanelY = panelY + dy

    const targetPixel = this.panelToPixel(nextPanelX, nextPanelY)

    state.player.direction = dir
    state.player.isMoving = true
    state.player.panelX = nextPanelX
    state.player.panelY = nextPanelY

    this.drawPlayer(dir)

    gsap.to(this.playerGraphics, {
      x: targetPixel.x,
      y: targetPixel.y,
      duration: 0.15,
      ease: 'none',
      onComplete: () => {
        state.player.isMoving = false
      },
    })
  }

  private drawPlayer(direction: Direction): void {
    this.playerGraphics.clear()

    // 胴体
    this.playerGraphics.circle(0, 0, 14)
    this.playerGraphics.fill(0x3a7abf)

    // 向きに応じた目のオフセット
    let eyeOffsetX = 0
    let eyeOffsetY = 0
    if (direction === 'north') eyeOffsetY = -4
    else if (direction === 'south') eyeOffsetY = 4
    else if (direction === 'east') eyeOffsetX = 4
    else if (direction === 'west') eyeOffsetX = -4

    // 目（白丸）
    this.playerGraphics.circle(-5 + eyeOffsetX, -3 + eyeOffsetY, 3)
    this.playerGraphics.circle(5 + eyeOffsetX, -3 + eyeOffsetY, 3)
    this.playerGraphics.fill(0xffffff)

    // 目（黒丸）
    this.playerGraphics.circle(-5 + eyeOffsetX, -3 + eyeOffsetY, 1.5)
    this.playerGraphics.circle(5 + eyeOffsetX, -3 + eyeOffsetY, 1.5)
    this.playerGraphics.fill(0x000000)

    // 触腕（4本、胴体下部から）
    const tentacleStartX = -6
    const tentacleSpacing = 4
    for (let i = 0; i < 4; i++) {
      const tx = tentacleStartX + i * tentacleSpacing
      this.playerGraphics.rect(tx - 1.5, 12, 3, 6)
      this.playerGraphics.fill(0x2a5a9f)
    }
  }
}
