import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type FederatedPointerEvent,
  type Ticker,
} from 'pixi.js'
import gsap from 'gsap'
import { COLORS, PANEL_COLORS } from '../constants/colors'
import {
  getClockText,
  isHouseTapped,
  isTakokongActive,
  pickRandomBomb,
  tickTakokongBarrier,
  tickTakokongCountdown,
  tryBombRecovery,
  TILE_SIZE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type BombType,
  type Direction,
  type EnemyState,
  type GameState,
  type MapPanel,
} from '../types/GameState'
import { findPath, findWaterGoalPanel, findWaterPath } from '../game/map'
import { KeyboardManager } from '../game/KeyboardManager'
import {
  spawnEnemies,
  checkAttackHit,
  ATTACK_RANGE,
  ATTACK_DAMAGE,
} from '../game/EnemyManager'
import { applyBombDamage } from '../game/BombJutsu'
import {
  calcShakeOffset,
  getCurrentZoom,
  screenToWorld,
  startZoomIn,
  updateZoom,
  zoomOut,
} from '../game/CameraController'
import {
  classifyPointerUp,
  LONG_PRESS_THRESHOLD_MS,
} from '../game/PointerInput'
import { GameEventEmitter } from '../game/GameEvents'
import { EffectManager } from './EffectManager'
import { SoundManager } from '../game/SoundManager'

export class GameScene extends Container {
  onEnding: ((score: number) => void) | null = null
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
  private takokongBgmStarted = false
  private readonly events = new GameEventEmitter()
  private effectManager: EffectManager | null = null
  private sound: SoundManager | null = null
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

  private readonly uiGraphics = new Graphics()
  private readonly bombText = new Text({
    text: 'none',
    style: {
      fill: COLORS.uiText,
      fontFamily: 'monospace',
      fontSize: 16,
      fontWeight: '700',
      stroke: { color: 0x000000, width: 3 },
    },
  })
  private readonly bombStockText = new Text({
    text: '×0',
    style: {
      fill: COLORS.uiText,
      fontFamily: 'monospace',
      fontSize: 16,
      fontWeight: '700',
      stroke: { color: 0x000000, width: 3 },
    },
  })
  private readonly minimapGraphics = new Graphics()
  private readonly minimapMarker = new Graphics()
  // タココング戦 UI（#37）
  private readonly takokongHpBar = new Graphics()
  private readonly takokongCountdownText = new Text({
    text: '',
    style: {
      fill: 0xff4444,
      fontFamily: 'monospace',
      fontSize: 96,
      fontWeight: '900',
      stroke: { color: 0x000000, width: 8 },
    },
  })
  private takokongCleanupDone = false
  // ポインター入力状態
  private pointerDownAtMs: number | null = null
  private pointerDownPos: { x: number; y: number } | null = null
  private isLongPressing = false
  // ticker now（pointerdown→pointerup 間で経過時間を測るための累積 ms）
  private nowMs = 0
  // window blur ハンドラの参照（destroy 時に解除するため）
  private blurHandler: (() => void) | null = null

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
    // ボム選択表示（左下）
    this.bombText.x = 14
    this.bombText.y = VIEW_HEIGHT - 70
    this.bombStockText.x = 14 + 120
    this.bombStockText.y = VIEW_HEIGHT - 70
    // ミニマップ（右下）
    this.minimapGraphics.x = VIEW_WIDTH - 80 - 14
    this.minimapGraphics.y = VIEW_HEIGHT - 80 - 14
    this.minimapMarker.x = VIEW_WIDTH - 80 - 14
    this.minimapMarker.y = VIEW_HEIGHT - 80 - 14
    // タココング HP バー（画面上部、時計の下）
    this.takokongHpBar.x = 0
    this.takokongHpBar.y = 0
    // カウントダウン Text（画面中央、anchor 中央）
    this.takokongCountdownText.anchor.set(0.5)
    this.takokongCountdownText.x = VIEW_WIDTH / 2
    this.takokongCountdownText.y = VIEW_HEIGHT / 2
    this.takokongCountdownText.visible = false
    this.uiLayer.addChild(
      this.clockText,
      this.scoreText,
      this.uiGraphics,
      this.bombText,
      this.bombStockText,
      this.minimapGraphics,
      this.minimapMarker,
      this.takokongHpBar,
      this.takokongCountdownText
    )

    // ポインター入力: scene root 全体をヒット領域にする
    this.eventMode = 'static'
    this.hitArea = new Rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    this.on('pointerdown', this.handlePointerDown, this)
    this.on('pointerup', this.handlePointerUp, this)
    this.on('pointerupoutside', this.handlePointerUp, this)
    this.on('pointermove', this.handlePointerMove, this)
  }

  initWithState(state: GameState): void {
    this.state = structuredClone(state)
    this.takokongBgmStarted = false
    this.takokongCleanupDone = false
    this.state.phase = 'playing'
    this.pointerDownAtMs = null
    this.pointerDownPos = null
    this.isLongPressing = false
    this.nowMs = 0
    this.takokongHpBar.clear()
    this.takokongCountdownText.visible = false

    // window blur で強制ズームアウト（フォーカス喪失時）
    if (this.blurHandler === null) {
      this.blurHandler = (): void => {
        if (this.state === null) return
        this.pointerDownAtMs = null
        this.pointerDownPos = null
        if (this.isLongPressing || this.state.camera.scale > 1) {
          this.state.camera = zoomOut(this.state.camera)
        }
        this.isLongPressing = false
      }
      window.addEventListener('blur', this.blurHandler)
    }

    const map = this.state.map
    const width = map.length * TILE_SIZE
    const height = map[0].length * TILE_SIZE
    // enemyLayer / playerLayer は mapLayer の子のためオフセット設定不要

    // KeyboardManager を生成
    this.keyboard = new KeyboardManager()

    // EffectManager を生成（mapLayer の子として設定）
    this.effectManager = new EffectManager(this.mapLayer)

    // SoundManager を生成して環境音を開始
    this.sound = new SoundManager()
    this.sound.startAmbient()

    // score-gain イベントのハンドラを登録
    this.events.removeAllListeners('score-gain')
    this.events.on('score-gain', (e) => {
      this.effectManager?.showScoreGain(e)
      this.sound?.playSe('se_score')
    })

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
    this.initMinimap()
  }

  getState(): GameState | null {
    return this.state === null ? null : structuredClone(this.state)
  }

  update(ticker: Ticker): void {
    if (this.state === null || this.state.phase !== 'playing') return
    this.nowMs += ticker.deltaMS
    this.state.elapsedMs = Math.min(
      this.state.durationMs,
      this.state.elapsedMs + ticker.deltaMS
    )

    // ── ボム自動回復（60s, 120s 経過時に +1 個 + 新ランダム抽選） ──
    const recovery = tryBombRecovery(this.state)
    if (recovery.recovered > 0) {
      this.state.bombStock = recovery.newStock
      this.state.selectedBomb = recovery.newSelected
      this.state.bombRecoveryThresholds = recovery.newThresholds
    }

    // ── 長押し検出: pointerdown 後 300ms 経過でズーム開始 ──
    // #37: タココング戦中はズーム不可（全体俯瞰スケール固定）
    if (
      this.pointerDownAtMs !== null &&
      this.pointerDownPos !== null &&
      !this.isLongPressing &&
      this.nowMs - this.pointerDownAtMs >= LONG_PRESS_THRESHOLD_MS &&
      !isTakokongActive(this.state)
    ) {
      this.isLongPressing = true
      const world = screenToWorld(
        this.state.camera,
        this.pointerDownPos.x,
        this.pointerDownPos.y
      )
      this.state.camera = startZoomIn(this.state.camera, world.x, world.y)
    }

    // 時間切れ → ending フェーズへ
    if (this.state.elapsedMs >= this.state.durationMs) {
      // phase を 'ending' に設定してから return することで以降のフレームは早期 return される
      this.state.phase = 'ending'
      this.onEnding?.(this.state.score)
      return
    }

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
        if (e.type === 'ground') {
          const route = findPath(
            map,
            { x: startX, y: startY },
            { x: goalPanel.x, y: goalPanel.y }
          )
          e.route =
            route.length > 0 ? route : [{ x: goalPanel.x, y: goalPanel.y }]
        } else if (e.type === 'water') {
          // 水タコは water/river ネットワークを A* で辿る
          const waterGoal = findWaterGoalPanel(map, {
            x: goalPanel.x,
            y: goalPanel.y,
          })
          if (waterGoal !== null) {
            const route = findWaterPath(
              map,
              { x: startX, y: startY },
              waterGoal
            )
            // Q2: 水路の終端から家へ突入する視覚演出のため、敢えて water/river
            //     ネットワーク外の player_house を route 末尾に接続している。
            //     A* は water/river ネットワーク内のみで動くので、最後の 1 セグメントは
            //     ネットワーク外の player_house へ直線補間で「上陸する」イメージ。
            e.route =
              route.length > 0
                ? [...route, { x: goalPanel.x, y: goalPanel.y }]
                : [{ x: goalPanel.x, y: goalPanel.y }]
          } else {
            e.route = [{ x: goalPanel.x, y: goalPanel.y }]
          }
        }
        // air / underground / takokong は route=[] のまま
        // advanceEnemies の else 分岐で直線移動する
      }
      this.state.enemies.push(e)
    }

    // #37: 新しくスポーンした敵に takokong があれば「登場演出」を起こす。
    // - ズームインはしない（戦闘中は全体俯瞰スケール固定）
    // - 画面シェイク（強）+ フラッシュ + BGM 開始
    for (const e of newEnemies) {
      if (e.type === 'takokong') {
        this.state.shakeState = { remainingMs: 1000, intensity: 10 }
        // 強制的にズームアウト（直前まで長押しズーム中だった場合のリセット）
        this.state.camera = zoomOut(this.state.camera, 200)
        this.isLongPressing = false
        // 登場フラッシュ
        const flash = new Graphics()
        this.uiLayer.addChild(flash)
        flash.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
        flash.fill({ color: 0xffffff, alpha: 0.8 })
        gsap.to(flash, {
          alpha: 0,
          duration: 0.5,
          onComplete: () => flash.destroy(),
        })
      }
    }

    // シェイク適用
    const state = this.state
    const { dx, dy, nextShake } = calcShakeOffset(
      state.shakeState,
      ticker.deltaMS
    )
    state.shakeState = nextShake
    this.mapLayer.x = VIEW_WIDTH / 2 + dx
    this.mapLayer.y = VIEW_HEIGHT / 2 + dy

    // #37: タココング戦中はズーム強制 1.0 固定（俯瞰）
    if (isTakokongActive(state)) {
      state.camera.scale = 1
      state.camera.pivot = { x: 0, y: 0 }
      state.camera.zoom = null
    }

    // ズーム適用（新 camera.zoom 経路）
    state.camera = updateZoom(state.camera, ticker.deltaMS)
    this.mapLayer.scale.set(state.camera.scale)
    this.mapLayer.pivot.set(state.camera.pivot.x, state.camera.pivot.y)

    this.advanceEnemies(ticker.deltaMS)

    // #37: バリアタイマー更新
    if (state.takokongState !== null && state.takokongState.active) {
      state.takokongState = tickTakokongBarrier(
        state.takokongState,
        state.elapsedMs
      )
    }

    // takokong が消えたらズームリセット
    if (state.takokongSpawned && !this.takokongCleanupDone) {
      const stillAlive = state.enemies.some((e) => e.type === 'takokong')
      if (!stillAlive) {
        // takokong が消えた（撃破 or 家到達）
        this.takokongCleanupDone = true
        // #37: takokongState を撃破/到達確定状態にする
        if (state.takokongState !== null) {
          state.takokongState = {
            ...state.takokongState,
            active: false,
          }
        }
        // ズーム解除（戦闘中は固定だったので、scale=1 のまま）
        state.camera = zoomOut(state.camera, 0)
        state.camera.scale = 1
        state.camera.pivot = { x: 0, y: 0 }
        state.camera.zoom = null
        this.mapLayer.scale.set(1)
        this.mapLayer.pivot.set(0, 0)
        // BGM 停止
        this.sound?.stopTakokongBgm()
        // UI 隠す
        this.takokongHpBar.clear()
        this.takokongCountdownText.visible = false
      }
    }

    // takokong スポーン時に BGM を開始（1回のみ）
    if (state.takokongSpawned && !this.takokongBgmStarted) {
      this.takokongBgmStarted = true
      this.sound?.playTakokongBgm()
    }

    // #37: タココング戦 UI（HP バー + カウントダウン）の更新
    this.updateTakokongUi()

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
    this.updateUI()
  }

  private updateUI(): void {
    const state = this.requireState()
    this.uiGraphics.clear()

    // HPバー（左上、y=42）
    const maxHp = 3
    const hpBoxSize = 16
    const hpGap = 2
    for (let i = 0; i < maxHp; i++) {
      const color = i < state.playerHp ? COLORS.enemyHp2 : 0x555555
      this.uiGraphics.rect(
        14 + i * (hpBoxSize + hpGap),
        42,
        hpBoxSize,
        hpBoxSize
      )
      this.uiGraphics.fill(color)
    }

    // ボム選択テキスト
    this.bombText.text = state.selectedBomb ?? 'none'
    this.bombStockText.text = `×${state.bombStock}`

    // プレイヤーマーカー（ミニマップ）
    const map = state.map
    const mapW = map.length // 19
    const mapH = map[0].length // 25
    const mmW = 80
    const mmH = 80
    const cellW = mmW / mapW
    const cellH = mmH / mapH
    this.minimapMarker.clear()
    const mx = state.player.panelX * cellW + cellW / 2
    const my = state.player.panelY * cellH + cellH / 2
    this.minimapMarker.circle(mx, my, 2)
    this.minimapMarker.fill(0xffffff)
  }

  /**
   * #37: タココング戦 UI（HP バー + 残時間カウントダウン）を毎フレーム更新する。
   * - HP バー: 画面上部に横長 (画面幅 - 28) × 高 16、active のときだけ表示
   * - カウントダウン: 残り 10s 以降、画面中央に大きな数字
   * - バリア中はバリア表示マーカー（紫リング）
   */
  private updateTakokongUi(): void {
    const state = this.requireState()
    const tk = state.takokongState
    this.takokongHpBar.clear()

    // カウントダウン: 残り 10s 以降は常に表示（タココング登場と独立）
    const countdownSec = tickTakokongCountdown(
      state.elapsedMs,
      state.durationMs
    )
    if (countdownSec !== null && countdownSec > 0) {
      this.takokongCountdownText.text = `${countdownSec}`
      this.takokongCountdownText.visible = true
    } else {
      this.takokongCountdownText.visible = false
    }

    if (tk === null || !tk.active) {
      return
    }

    // HP バー（画面上部、時計の下）
    const barX = 14
    const barY = 70
    const barW = VIEW_WIDTH - 28
    const barH = 18
    // 背景
    this.takokongHpBar.rect(barX - 2, barY - 2, barW + 4, barH + 4)
    this.takokongHpBar.fill(0x000000)
    this.takokongHpBar.rect(barX, barY, barW, barH)
    this.takokongHpBar.fill(0x333333)
    // HP
    const ratio = Math.max(0, tk.hp / tk.maxHp)
    this.takokongHpBar.rect(barX, barY, barW * ratio, barH)
    this.takokongHpBar.fill(0xff2244)
    // 縁
    this.takokongHpBar.rect(barX, barY, barW, barH)
    this.takokongHpBar.stroke({ color: 0xffffff, width: 2 })
    // バリア中マーカー（紫リング、HP バー左端）
    if (tk.barrierActive) {
      this.takokongHpBar.circle(barX + 8, barY + barH / 2, 6)
      this.takokongHpBar.fill(0x9900cc)
      this.takokongHpBar.stroke({ color: 0xffffff, width: 1 })
    }
  }

  private initMinimap(): void {
    const state = this.requireState()
    const map = state.map
    const mapW = map.length
    const mapH = map[0].length
    const mmW = 80
    const mmH = 80
    const cellW = mmW / mapW
    const cellH = mmH / mapH

    this.minimapGraphics.clear()
    // 半透明背景
    this.minimapGraphics.rect(0, 0, mmW, mmH)
    this.minimapGraphics.fill({ color: 0x000000, alpha: 0.5 })

    // 各パネルを塗る
    for (const col of map) {
      for (const panel of col) {
        const px = panel.x * cellW
        const py = panel.y * cellH
        const color = PANEL_COLORS[panel.type]
        this.minimapGraphics.rect(px, py, cellW, cellH)
        this.minimapGraphics.fill(color)
      }
    }
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
        // air: 4 辺ランダム入射 → 家 (0,0) 方向へ直進
        if (enemy.type === 'air') {
          const dx = 0 - enemy.x
          const dy = 0 - enemy.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist <= 1) {
            state.enemies.splice(i, 1)
          } else {
            const norm = (enemy.speed * deltaMS * 0.05) / dist
            enemy.x += dx * norm
            enemy.y += dy * norm
          }
        }
        // takokong: player_house に向かって直進（x=0, y=0 つまり mapLayer 中心）
        else if (enemy.type === 'takokong') {
          const dx = 0 - enemy.x
          const dy = 0 - enemy.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist <= 1) {
            // player_house 到達 → 除去
            state.enemies.splice(i, 1)
          } else {
            const norm = (enemy.speed * deltaMS * 0.05) / dist
            enemy.x += dx * norm
            enemy.y += dy * norm
          }
        }
        // underground: rice_field から直線で家へ
        else if (enemy.type === 'underground') {
          const dx = 0 - enemy.x
          const dy = 0 - enemy.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist <= 1) {
            state.enemies.splice(i, 1)
          } else {
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
    this.effectManager?.destroy()
    this.sound?.stopAll()
    this.events.clear()
    if (this.blurHandler !== null) {
      window.removeEventListener('blur', this.blurHandler)
      this.blurHandler = null
    }
    super.destroy()
  }

  // ─── ポインター入力ハンドラ ─────────────────────────
  private handlePointerDown(e: FederatedPointerEvent): void {
    if (this.state === null || this.state.phase !== 'playing') return
    const screenX = e.global.x
    const screenY = e.global.y

    // 既にズーム中（連打）→ checkAttackHit を即実行
    if (this.isLongPressing && this.state.camera.scale > 1) {
      const world = screenToWorld(this.state.camera, screenX, screenY)
      this.attackAt(world.x, world.y)
      return
    }

    this.pointerDownAtMs = this.nowMs
    this.pointerDownPos = { x: screenX, y: screenY }
    this.isLongPressing = false
  }

  private handlePointerMove(e: FederatedPointerEvent): void {
    if (this.state === null || this.state.phase !== 'playing') return
    if (!this.isLongPressing) return
    // 長押し中はズーム中心を追従させる
    const world = screenToWorld(this.state.camera, e.global.x, e.global.y)
    this.state.camera = startZoomIn(this.state.camera, world.x, world.y)
  }

  private handlePointerUp(e: FederatedPointerEvent): void {
    if (this.state === null || this.state.phase !== 'playing') return
    const downAt = this.pointerDownAtMs
    this.pointerDownAtMs = null
    this.pointerDownPos = null

    if (downAt === null) return

    const screenX = e.global.x
    const screenY = e.global.y
    const world = screenToWorld(this.state.camera, screenX, screenY)

    const kind = classifyPointerUp(downAt, this.nowMs)
    if (kind === 'long_release' || this.isLongPressing) {
      // 長押し離し → ズームアウト（攻撃判定は行わない: 旧版踏襲）
      this.state.camera = zoomOut(this.state.camera)
      this.isLongPressing = false
      return
    }

    // 短タップ: 家タップなら bomb 発動、それ以外は蜂忍術
    if (isHouseTapped(world.x, world.y)) {
      this.tryActivateSelectedBomb()
    } else {
      this.attackAt(world.x, world.y)
    }
  }

  /**
   * 蜂忍術通常攻撃を発火。zoomMultiplier は現在のズーム倍率を採用する。
   */
  private attackAt(worldX: number, worldY: number): void {
    if (this.state === null) return
    const zoomMul = getCurrentZoom(this.state.camera)
    const result = checkAttackHit(
      this.state,
      worldX,
      worldY,
      ATTACK_RANGE,
      ATTACK_DAMAGE,
      zoomMul
    )
    if (result.earnedScore > 0) {
      this.state.score += result.earnedScore
      this.events.emit('score-gain', {
        x: worldX,
        y: worldY,
        score: result.earnedScore,
        combo: 1,
      })
    }
  }

  /**
   * 家タップでの bomb 発動: stock > 0 なら selectedBomb を発動し、stock を 1 減らして
   * 次の bomb をランダム抽選する。stock==0 なら無視。
   */
  private tryActivateSelectedBomb(): void {
    if (this.state === null) return
    if (this.state.bombStock <= 0 || this.state.selectedBomb === null) return
    const type = this.state.selectedBomb
    this.activateBomb(type)
    this.state.bombStock -= 1
    this.state.selectedBomb = pickRandomBomb()
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
    this.sound?.playSe('se_bomb')
    // ダメージ計算（muddy/sentry/bunshin はダメージなし）
    const result = applyBombDamage(state, type)
    // スコア加算と score-gain イベント emit
    // #37: takokongBonus（撃破時 +100）も加算する
    const earnedScore = result.hitResults.size + result.takokongBonus
    if (earnedScore > 0) {
      state.score += earnedScore
      this.events.emit('score-gain', {
        x: this.playerGraphics.x,
        y: this.playerGraphics.y,
        score: earnedScore,
        combo: 1,
      })
    }
    // シェイクトリガー
    switch (type) {
      case 'muteki':
      case 'sol':
      case 'jakuhou':
        state.shakeState = { remainingMs: 500, intensity: 8 }
        break
      case 'proton':
      case 'dainsleif':
        state.shakeState = { remainingMs: 300, intensity: 5 }
        break
      default:
        // muddy / sentry / bunshin: シェイクなし
        break
    }
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
