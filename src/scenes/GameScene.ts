import { Container, Graphics, Text, type Ticker } from 'pixi.js'
import gsap from 'gsap'
import { COLORS, PANEL_COLORS } from '../constants/colors'
import {
  getClockText,
  TILE_SIZE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type BombType,
  type Direction,
  type EnemyState,
  type GameState,
  type MapPanel,
} from '../types/GameState'
import { findPath } from '../game/map'
import { KeyboardManager } from '../game/KeyboardManager'
import { spawnEnemies } from '../game/EnemyManager'
import { applyBombDamage } from '../game/BombJutsu'

export class GameScene extends Container {
  private state: GameState | null = null
  private readonly mapLayer = new Container()
  private readonly enemyLayer = new Container()
  private readonly playerLayer = new Container()
  private readonly effectLayer = new Container()
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
    // enemyLayer / playerLayer は mapLayer の子にして自動回転に追従させる
    this.enemyLayer.addChild(this.enemyGraphics)
    this.mapLayer.addChild(this.enemyLayer)
    this.playerLayer.addChild(this.playerGraphics)
    this.mapLayer.addChild(this.playerLayer)
    this.mapLayer.addChild(this.effectLayer)
    this.addChild(this.mapLayer, this.uiLayer)
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
    // enemyLayer / playerLayer は mapLayer の子のためオフセット設定不要

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
        // enemy.x/y は mapLayer ローカル座標（offsetX/offsetY ベース）
        const startX = Math.round((enemy.x - offsetX) / TILE_SIZE)
        const startY = Math.round((enemy.y - offsetY) / TILE_SIZE)
        const route = findPath(
          map,
          { x: startX, y: startY },
          { x: goalPanel.x, y: goalPanel.y }
        )
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

    // スポーン
    const map = this.state.map
    const width = map.length * TILE_SIZE
    const height = map[0].length * TILE_SIZE
    const offsetX = -width / 2
    const offsetY = -height / 2
    const goalPanel = map.flat().find((p) => p.type === 'player_house')
    const newEnemies = spawnEnemies(this.state, ticker.deltaMS)
    for (const e of newEnemies) {
      if (goalPanel) {
        const startX = Math.round((e.x - offsetX) / TILE_SIZE)
        const startY = Math.round((e.y - offsetY) / TILE_SIZE)
        const route = findPath(
          map,
          { x: startX, y: startY },
          { x: goalPanel.x, y: goalPanel.y }
        )
        e.route =
          route.length > 0 ? route : [{ x: goalPanel.x, y: goalPanel.y }]
      }
      this.state.enemies.push(e)
    }

    this.advanceEnemies(ticker.deltaMS)
    this.drawEnemies()
    this.drawUi()
    this.tryMovePlayer()

    // B キーでランダムボムを発動（開発テスト用）
    if (this.keyboard?.getBombKey()) {
      const bombs: BombType[] = [
        'proton',
        'muddy',
        'sentry',
        'muteki',
        'sol',
        'dainsleif',
        'jakuhou',
        'bunshin',
      ]
      const type = bombs[Math.floor(Math.random() * bombs.length)]
      this.activateBomb(type)
    }
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
          this.drawConnectionLines(
            cx,
            cy,
            x,
            y,
            panel.connections,
            8,
            COLORS.pathLine
          )
        } else if (panel.type === 'rail') {
          // 接続方向への線路線（幅 6px）
          this.drawConnectionLines(
            cx,
            cy,
            x,
            y,
            panel.connections,
            6,
            COLORS.railLine
          )
          // 枕木（4px × 10px を中心付近に 3 本）
          const sleeperOffsets = [-6, 0, 6]
          for (const off of sleeperOffsets) {
            this.mapGraphics.rect(cx - 5, cy + off - 2, 10, 4)
            this.mapGraphics.fill(COLORS.railSleeper)
          }
        } else if (panel.type === 'station') {
          // 接続方向への線（rail と同色・同幅）
          this.drawConnectionLines(
            cx,
            cy,
            x,
            y,
            panel.connections,
            6,
            COLORS.railLine
          )
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
          this.mapGraphics.rect(cx - roofW / 2, y + 3, roofW, roofH)
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
    const { x, y } = enemy

    if (enemy.type === 'ground') {
      // 矩形 (hp2:24x24, hp1:20x20)
      const size = enemy.hp > 1 ? 24 : 20
      this.enemyGraphics.rect(x - size / 2, y - size / 2, size, size)
      this.enemyGraphics.fill(color)
      this.enemyGraphics.stroke({ color: 0xffffff, width: 2 })
    } else if (enemy.type === 'water') {
      // 円 (hp2:radius=13, hp1:radius=10)
      const radius = enemy.hp > 1 ? 13 : 10
      this.enemyGraphics.circle(x, y, radius)
      this.enemyGraphics.fill(color)
      this.enemyGraphics.stroke({ color: 0xffffff, width: 2 })
    } else if (enemy.type === 'air') {
      // 三角形
      const size = enemy.hp > 1 ? 14 : 11
      this.enemyGraphics.poly([
        x,
        y - size,
        x + size,
        y + size,
        x - size,
        y + size,
      ])
      this.enemyGraphics.fill(color)
      this.enemyGraphics.stroke({ color: 0xffffff, width: 2 })
    } else if (enemy.type === 'underground') {
      // 菱形
      const size = enemy.hp > 1 ? 14 : 11
      this.enemyGraphics.poly([
        x,
        y - size,
        x + size,
        y,
        x,
        y + size,
        x - size,
        y,
      ])
      this.enemyGraphics.fill(color)
      this.enemyGraphics.stroke({ color: 0xffffff, width: 2 })
    } else {
      // takokong: 大円 radius=22 + 白縁 + 紫オーラ円 radius=28
      const prevAlpha = this.enemyGraphics.alpha
      this.enemyGraphics.alpha = 0.4
      this.enemyGraphics.circle(x, y, 28)
      this.enemyGraphics.fill(0x9900cc)
      this.enemyGraphics.alpha = prevAlpha
      this.enemyGraphics.circle(x, y, 22)
      this.enemyGraphics.fill(color)
      this.enemyGraphics.circle(x, y, 22)
      this.enemyGraphics.stroke({ color: 0xffffff, width: 3 })
    }
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

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i]
      if (enemy.route.length > 0) {
        enemy.routeProgress = Math.min(
          1,
          enemy.routeProgress +
            (deltaMS * enemy.speed) / 1000 / enemy.route.length
        )
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
        // air: 左から右へ直線移動
        if (enemy.type === 'air') {
          enemy.x += enemy.speed * deltaMS * 0.08
          const rightEdge = width / 2 + 200
          if (enemy.x > rightEdge) {
            state.enemies.splice(i, 1)
          }
        }
        // takokong: player_house に向かって直進（x=0, y=0 つまり mapLayer 中心）
        else if (enemy.type === 'takokong') {
          const dx = 0 - enemy.x
          const dy = 0 - enemy.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > 1) {
            const norm = (enemy.speed * deltaMS * 0.05) / dist
            enemy.x += dx * norm
            enemy.y += dy * norm
          }
        }
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

  private panelToPixel(
    panelX: number,
    panelY: number
  ): { x: number; y: number } {
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

  activateBomb(type: BombType): void {
    const state = this.requireState()
    // ダメージ計算（muddy/sentry/bunshin はダメージなし）
    applyBombDamage(state, type)
    // エフェクト描画
    switch (type) {
      case 'proton':
        this.effectProton()
        break
      case 'muddy':
        this.effectMuddy()
        break
      case 'sentry':
        this.effectSentry()
        break
      case 'muteki':
        this.effectMuteki()
        break
      case 'sol':
        this.effectSol()
        break
      case 'dainsleif':
        this.effectDainsleif()
        break
      case 'jakuhou':
        this.effectJakuhou()
        break
      case 'bunshin':
        this.effectBunshin()
        break
    }
  }

  // proton（浦恋菊流怒之術）: 白い大円が膨張 + 横長ビーム
  private effectProton(): void {
    // 大円が 0→200px に膨張してフェードアウト（0.5s）
    const circle = new Graphics()
    this.effectLayer.addChild(circle)
    circle.circle(0, 0, 10)
    circle.fill(0xffffff)
    gsap.to(circle.scale, {
      x: 20,
      y: 20,
      duration: 0.5,
    })
    gsap.to(circle, {
      alpha: 0,
      duration: 0.5,
      onComplete: () => circle.destroy(),
    })

    // 横長ビーム矩形（全幅×20px）が中央を横断してフェードアウト（0.8s）
    const beam = new Graphics()
    this.effectLayer.addChild(beam)
    beam.rect(-600, -10, 1200, 20)
    beam.fill(0xffffff)
    gsap.to(beam, {
      alpha: 0,
      duration: 0.8,
      onComplete: () => beam.destroy(),
    })
  }

  // muddy（埋弟盆流怒之術）: 茶色円が点滅後フェードアウト
  private effectMuddy(): void {
    const g = new Graphics()
    this.effectLayer.addChild(g)
    g.circle(0, 0, 8)
    g.fill(0x8b4513)
    // 2秒間点滅
    gsap.to(g, {
      alpha: 0.2,
      duration: 0.25,
      repeat: 7,
      yoyo: true,
      onComplete: () => {
        gsap.to(g, {
          alpha: 0,
          duration: 0.3,
          onComplete: () => g.destroy(),
        })
      },
    })
  }

  // sentry（千鳥臥流怒之術）: 灰色矩形が5秒間回転後フェードアウト
  private effectSentry(): void {
    const g = new Graphics()
    this.effectLayer.addChild(g)
    g.rect(-10, -10, 20, 20)
    g.fill(0x888888)
    gsap.to(g, {
      rotation: Math.PI * 4,
      duration: 5,
      ease: 'none',
    })
    gsap.to(g, {
      alpha: 0,
      duration: 0.5,
      delay: 4.5,
      onComplete: () => g.destroy(),
    })
  }

  // muteki（無敵砲台）: 大フラッシュ円 + 5箇所ランダム爆発
  private effectMuteki(): void {
    // 白い大フラッシュ円（radius 5→100、0.3s）
    const flash = new Graphics()
    this.effectLayer.addChild(flash)
    flash.circle(0, 0, 5)
    flash.fill(0xffffff)
    gsap.to(flash.scale, {
      x: 20,
      y: 20,
      duration: 0.3,
    })
    gsap.to(flash, {
      alpha: 0,
      duration: 0.3,
      onComplete: () => flash.destroy(),
    })

    // 5箇所にランダム爆発円（0.1s ずらし）
    for (let i = 0; i < 5; i++) {
      const rx = (Math.random() - 0.5) * 400
      const ry = (Math.random() - 0.5) * 400
      const exp = new Graphics()
      exp.x = rx
      exp.y = ry
      this.effectLayer.addChild(exp)
      exp.circle(0, 0, 30)
      exp.fill(0xff6600)
      gsap.to(exp, {
        alpha: 0,
        duration: 0.4,
        delay: 0.1 * i,
        onComplete: () => exp.destroy(),
      })
    }
  }

  // sol（SOL攻撃）: ターゲットサークル点滅 + 白ビーム柱降下 + 爆発円
  private effectSol(): void {
    // 赤いターゲットサークル（radius 60）点滅（2s）
    const target = new Graphics()
    this.effectLayer.addChild(target)
    target.circle(0, 0, 60)
    target.stroke({ color: 0xff0000, width: 3 })
    gsap.to(target, {
      alpha: 0.2,
      duration: 0.25,
      repeat: 7,
      yoyo: true,
      onComplete: () => target.destroy(),
    })

    // 縦の白いビーム柱（幅30×高500）が上から降下（0.5s）
    const beam = new Graphics()
    beam.x = 0
    beam.y = -500
    this.effectLayer.addChild(beam)
    beam.rect(-15, 0, 30, 500)
    beam.fill(0xffffff)
    gsap.to(beam, {
      y: 0,
      duration: 0.5,
      delay: 1.5,
      onComplete: () => {
        // 爆発円（radius 80、0.8s フェードアウト）
        const exp = new Graphics()
        this.effectLayer.addChild(exp)
        exp.circle(0, 0, 10)
        exp.fill(0xff4400)
        gsap.to(exp.scale, { x: 8, y: 8, duration: 0.8 })
        gsap.to(exp, {
          alpha: 0,
          duration: 0.8,
          onComplete: () => exp.destroy(),
        })
        beam.destroy()
      },
    })
  }

  // dainsleif（ダインスレイブ）: 紫チャージ円 + 斜め矩形
  private effectDainsleif(): void {
    // 紫のチャージ円（radius 15→30、1s）
    const charge = new Graphics()
    this.effectLayer.addChild(charge)
    charge.circle(0, 0, 15)
    charge.fill(0x9900cc)
    gsap.to(charge.scale, { x: 2, y: 2, duration: 1 })
    gsap.to(charge, {
      alpha: 0,
      duration: 0.3,
      delay: 0.8,
      onComplete: () => charge.destroy(),
    })

    // 細い紫の矩形（幅8、長400）が斜め方向に伸びる（0.5s）
    const beam = new Graphics()
    beam.rotation = Math.PI / 4
    beam.scale.x = 0
    this.effectLayer.addChild(beam)
    beam.rect(-4, 0, 8, 400)
    beam.fill(0x9900cc)
    gsap.to(beam.scale, {
      x: 1,
      duration: 0.5,
      delay: 0.8,
    })
    gsap.to(beam, {
      alpha: 0,
      duration: 0.3,
      delay: 1.2,
      onComplete: () => beam.destroy(),
    })
  }

  // jakuhou（じゃくほうらいこうべんの術）: ミサイル降下 + 大爆発 + 衝撃波3つ
  private effectJakuhou(): void {
    // 金色の縦長矩形（ミサイル形 30×80）が上から降下（0.3s）
    const missile = new Graphics()
    missile.x = 0
    missile.y = -300
    this.effectLayer.addChild(missile)
    missile.rect(-15, 0, 30, 80)
    missile.fill(0xffd700)
    gsap.to(missile, {
      y: -80,
      duration: 0.3,
      onComplete: () => {
        missile.destroy()
        // 白い大爆発円（radius 10→80、0.6s フェードアウト）
        const exp = new Graphics()
        this.effectLayer.addChild(exp)
        exp.circle(0, 0, 10)
        exp.fill(0xffffff)
        gsap.to(exp.scale, { x: 8, y: 8, duration: 0.6 })
        gsap.to(exp, {
          alpha: 0,
          duration: 0.6,
          onComplete: () => exp.destroy(),
        })

        // 衝撃波3つ（0.15s ずらして順次拡大）
        for (let i = 0; i < 3; i++) {
          const wave = new Graphics()
          this.effectLayer.addChild(wave)
          wave.circle(0, 0, 10)
          wave.stroke({ color: 0xffd700, width: 3 })
          gsap.to(wave.scale, {
            x: 12,
            y: 12,
            duration: 0.5,
            delay: 0.15 * i,
          })
          gsap.to(wave, {
            alpha: 0,
            duration: 0.5,
            delay: 0.15 * i,
            onComplete: () => wave.destroy(),
          })
        }
      },
    })
  }

  // bunshin（分身の術）: 煙エフェクト + 分身布団2つ点滅
  private effectBunshin(): void {
    // 灰色の煙エフェクト（radius 0→60、0.6s フェードアウト）
    const smoke = new Graphics()
    this.effectLayer.addChild(smoke)
    smoke.circle(0, 0, 5)
    smoke.fill(0x999999)
    gsap.to(smoke.scale, { x: 12, y: 12, duration: 0.6 })
    gsap.to(smoke, {
      alpha: 0,
      duration: 0.6,
      onComplete: () => smoke.destroy(),
    })

    // 2箇所に青い矩形（分身布団、40×40）が出現し5秒間点滅後フェードアウト
    const offsets = [
      { x: -60, y: -60 },
      { x: 60, y: 60 },
    ]
    for (const offset of offsets) {
      const futon = new Graphics()
      futon.x = offset.x
      futon.y = offset.y
      this.effectLayer.addChild(futon)
      futon.rect(-20, -20, 40, 40)
      futon.fill(0x3a7abf)
      gsap.to(futon, {
        alpha: 0.3,
        duration: 0.4,
        repeat: 11,
        yoyo: true,
        delay: 0.5,
        onComplete: () => {
          gsap.to(futon, {
            alpha: 0,
            duration: 0.5,
            onComplete: () => futon.destroy(),
          })
        },
      })
    }
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
