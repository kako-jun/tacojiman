import { Container, Graphics, Rectangle, Text } from 'pixi.js'
import { VIEW_HEIGHT, VIEW_WIDTH } from '../types/GameState'
import { rankingClient } from '../game/RankingClient'
import {
  generatePlayerName,
  incrementProgress,
  loadHighScore,
  saveHighScoreIfNew,
  type TacojimanHighScore,
} from '../game/storage'

interface EndingInfo {
  level: number
  bgColor: number
  title: string
  dialogue: string
}

const SCORE_THRESHOLDS = {
  trueEnd: 8001,
  special: 5001,
  good: 3001,
  normal: 1001,
} as const

function getEndingInfo(score: number): EndingInfo {
  if (score >= SCORE_THRESHOLDS.trueEnd) {
    return {
      level: 5,
      bgColor: 0xffd700,
      title: '真エンディング',
      dialogue: '「ありがとう...今度は私が守るから」',
    }
  }
  if (score >= SCORE_THRESHOLDS.special) {
    return {
      level: 4,
      bgColor: 0xff69b4,
      title: 'スペシャルエンド',
      dialogue: '「本当は...好きだったの」',
    }
  }
  if (score >= SCORE_THRESHOLDS.good) {
    return {
      level: 3,
      bgColor: 0x87ceeb,
      title: 'グッドエンド',
      dialogue: '「心配してくれてたのね...」',
    }
  }
  if (score >= SCORE_THRESHOLDS.normal) {
    return {
      level: 2,
      bgColor: 0xdda0dd,
      title: 'ノーマルエンド',
      dialogue: '「今日は大事な日だったのに...」',
    }
  }
  return {
    level: 1,
    bgColor: 0x696969,
    title: 'バッドエンド',
    dialogue: '「...」',
  }
}

export class EndingScene extends Container {
  private readonly bgGraphics = new Graphics()
  private readonly titleText: Text
  private readonly dialogueText: Text
  private readonly scoreText: Text
  private readonly highScoreText: Text
  private readonly newHighScoreText: Text
  private readonly progressText: Text
  private readonly hintText: Text

  constructor(onReplay: () => void) {
    super()

    // 背景
    this.addChild(this.bgGraphics)

    // エンディングタイトル（中央上部）
    this.titleText = new Text({
      text: '',
      style: {
        fill: 0xffffff,
        fontFamily: 'monospace',
        fontSize: 32,
        fontWeight: '700',
        stroke: { color: 0x000000, width: 3 },
        align: 'center',
      },
    })
    this.titleText.anchor.set(0.5, 0)
    this.titleText.x = VIEW_WIDTH / 2
    this.titleText.y = VIEW_HEIGHT * 0.2
    this.addChild(this.titleText)

    // キャラクターの台詞（中央）
    this.dialogueText = new Text({
      text: '',
      style: {
        fill: 0xffaaaa,
        fontFamily: 'monospace',
        fontSize: 20,
        stroke: { color: 0x000000, width: 2 },
        align: 'center',
        wordWrap: true,
        wordWrapWidth: VIEW_WIDTH * 0.8,
      },
    })
    this.dialogueText.anchor.set(0.5, 0.5)
    this.dialogueText.x = VIEW_WIDTH / 2
    this.dialogueText.y = VIEW_HEIGHT * 0.48
    this.addChild(this.dialogueText)

    // Final Score 表示
    this.scoreText = new Text({
      text: '',
      style: {
        fill: 0xffffff,
        fontFamily: 'monospace',
        fontSize: 24,
        fontWeight: '700',
        stroke: { color: 0x000000, width: 2 },
        align: 'center',
      },
    })
    this.scoreText.anchor.set(0.5, 0.5)
    this.scoreText.x = VIEW_WIDTH / 2
    this.scoreText.y = VIEW_HEIGHT * 0.62
    this.addChild(this.scoreText)

    // Best 表示（その下に小さく並べる）
    this.highScoreText = new Text({
      text: '',
      style: {
        fill: 0xcccccc,
        fontFamily: 'monospace',
        fontSize: 16,
        stroke: { color: 0x000000, width: 2 },
        align: 'center',
      },
    })
    this.highScoreText.anchor.set(0.5, 0.5)
    this.highScoreText.x = VIEW_WIDTH / 2
    this.highScoreText.y = VIEW_HEIGHT * 0.68
    this.addChild(this.highScoreText)

    // NEW HIGH SCORE! 表示（更新時のみ可視）
    this.newHighScoreText = new Text({
      text: 'NEW HIGH SCORE!',
      style: {
        fill: 0xffd36f,
        fontFamily: 'monospace',
        fontSize: 20,
        fontWeight: '700',
        stroke: { color: 0x402000, width: 3 },
        align: 'center',
      },
    })
    this.newHighScoreText.anchor.set(0.5, 0.5)
    this.newHighScoreText.x = VIEW_WIDTH / 2
    this.newHighScoreText.y = VIEW_HEIGHT * 0.76
    this.newHighScoreText.visible = false
    this.addChild(this.newHighScoreText)

    // 進捗 Lv 更新表示
    this.progressText = new Text({
      text: '',
      style: {
        fill: 0xaaaaaa,
        fontFamily: 'monospace',
        fontSize: 14,
        align: 'center',
      },
    })
    this.progressText.anchor.set(0.5, 0.5)
    this.progressText.x = VIEW_WIDTH / 2
    this.progressText.y = VIEW_HEIGHT * 0.82
    this.addChild(this.progressText)

    // タップ誘導テキスト（下部）
    this.hintText = new Text({
      text: 'タップでタイトルへ',
      style: {
        fill: 0xaaaaaa,
        fontFamily: 'monospace',
        fontSize: 16,
        align: 'center',
      },
    })
    this.hintText.anchor.set(0.5, 1)
    this.hintText.x = VIEW_WIDTH / 2
    this.hintText.y = VIEW_HEIGHT * 0.92
    this.hintText.alpha = 0.7
    this.addChild(this.hintText)

    // 画面全体タップでリプレイ
    this.eventMode = 'static'
    this.hitArea = new Rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    this.on('pointertap', () => {
      onReplay()
    })
  }

  show(score: number): void {
    const info = getEndingInfo(score)

    // 背景再描画
    this.bgGraphics.clear()
    // ベースカラー（半透明）
    this.bgGraphics.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    this.bgGraphics.fill({ color: info.bgColor, alpha: 0.3 })
    // 黒オーバーレイで輝度を下げる
    this.bgGraphics.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    this.bgGraphics.fill({ color: 0x000000, alpha: 0.7 })

    // テキスト更新
    this.titleText.text = info.title
    this.dialogueText.text = info.dialogue
    this.scoreText.text = `Final Score: ${score}`

    // #39: ハイスコア更新と進捗 Lv インクリメント
    const playerName = generatePlayerName()
    const prevHigh = loadHighScore()
    const { updated, current } = saveHighScoreIfNew(score, playerName)
    this.newHighScoreText.visible = updated
    this.highScoreText.text = this.formatHighScoreLine(
      current,
      prevHigh,
      updated
    )

    const progress = incrementProgress()
    this.progressText.text = `進捗 Lv.${progress.level}/10  (play #${progress.totalPlays})`

    // #39: Nostalgic Ranking へ自動送信（失敗は無視）
    if (updated && score > 0) {
      void rankingClient.submit(playerName, score).catch(() => {
        // 念のためここでも握りつぶす（client 内でも catch しているが二重防御）
      })
    }
  }

  private formatHighScoreLine(
    current: TacojimanHighScore,
    prev: TacojimanHighScore | null,
    updated: boolean
  ): string {
    if (updated) {
      const prevScore = prev?.score ?? 0
      return `Best: ${current.score} (prev ${prevScore})`
    }
    if (current.score <= 0) return ''
    return `Best: ${current.score}`
  }
}
