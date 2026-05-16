import { Container, Graphics, Rectangle, Text } from 'pixi.js'
import { COLORS } from '../constants/colors'
import { VIEW_HEIGHT, VIEW_WIDTH } from '../types/GameState'
import {
  computeProgressBackground,
  loadHighScore,
  loadProgress,
} from '../game/storage'

/**
 * #40: タイトル画面。
 * - 中央 START ボタンを撤去し、画面全体タップで即開始
 * - 進捗 Lv に応じて背景色を線形補間（夜 → 朝焼け）
 * - 進捗 Lv は右下、ハイスコアは左下に小さく表示
 *
 * ストーリーボタン・外部リンクはスコープ判断で省略。
 */
export class TitleScene extends Container {
  private readonly bgGraphics = new Graphics()
  private readonly progressText: Text
  private readonly highScoreText: Text
  private readonly subtitleText: Text
  private readonly startPromptText: Text

  constructor(onStart: () => void) {
    super()

    // 背景（進捗 Lv 由来の動的色）を一番下に
    this.addChild(this.bgGraphics)

    const title = new Text({
      text: 'tacojiman',
      style: {
        fill: COLORS.uiText,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 44,
        fontWeight: '700',
        stroke: { color: 0x20120c, width: 4 },
      },
    })
    title.anchor.set(0.5)
    title.x = VIEW_WIDTH / 2
    title.y = 180
    this.addChild(title)

    this.subtitleText = new Text({
      text: 'All Your Wake Are Belong To Us!',
      style: {
        fill: COLORS.uiText,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        fontWeight: '700',
        stroke: { color: 0x20120c, width: 2 },
      },
    })
    this.subtitleText.anchor.set(0.5)
    this.subtitleText.x = VIEW_WIDTH / 2
    this.subtitleText.y = 224
    this.addChild(this.subtitleText)

    this.startPromptText = new Text({
      text: 'タップしてスタート',
      style: {
        fill: COLORS.uiText,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 22,
        fontWeight: '700',
        stroke: { color: 0x20120c, width: 3 },
      },
    })
    this.startPromptText.anchor.set(0.5)
    this.startPromptText.x = VIEW_WIDTH / 2
    this.startPromptText.y = VIEW_HEIGHT * 0.62
    this.addChild(this.startPromptText)

    // ハイスコア（左下）
    this.highScoreText = new Text({
      text: '',
      style: {
        fill: COLORS.uiText,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        stroke: { color: 0x20120c, width: 2 },
      },
    })
    this.highScoreText.anchor.set(0, 1)
    this.highScoreText.x = 10
    this.highScoreText.y = VIEW_HEIGHT - 10
    this.addChild(this.highScoreText)

    // 進捗 Lv（右下）
    this.progressText = new Text({
      text: '',
      style: {
        fill: COLORS.uiText,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        stroke: { color: 0x20120c, width: 2 },
      },
    })
    this.progressText.anchor.set(1, 1)
    this.progressText.x = VIEW_WIDTH - 10
    this.progressText.y = VIEW_HEIGHT - 10
    this.addChild(this.progressText)

    // 画面全体タップで即開始（#40）
    this.eventMode = 'static'
    this.hitArea = new Rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    this.on('pointertap', onStart)

    this.refresh()
  }

  /**
   * 表示用ストレージ値を再読込する。タイトルへ戻るたびに呼ぶ想定。
   */
  refresh(): void {
    const progress = loadProgress()
    const highScore = loadHighScore()
    const bgColor = computeProgressBackground(progress.level)

    this.bgGraphics.clear()
    this.bgGraphics.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    this.bgGraphics.fill(bgColor)

    // 進捗が進むほど subtitle / prompt の影色を明るく揃える
    if (progress.level > 0) {
      this.progressText.text = `進捗 Lv.${progress.level}/10`
    } else {
      this.progressText.text = ''
    }

    if (highScore !== null && highScore.score > 0) {
      this.highScoreText.text = `Best ${highScore.score}  ${highScore.playerName}`
    } else {
      this.highScoreText.text = ''
    }
  }
}
