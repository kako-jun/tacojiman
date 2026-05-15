import { Container, Graphics, Rectangle, Text } from 'pixi.js'
import { VIEW_HEIGHT, VIEW_WIDTH } from '../types/GameState'

interface EndingInfo {
  level: number
  bgColor: number
  title: string
  dialogue: string
}

const SCORE_THRESHOLDS = {
  true: 8001,
  special: 5001,
  good: 3001,
  normal: 1001,
} as const

function getEndingInfo(score: number): EndingInfo {
  if (score >= SCORE_THRESHOLDS.true) {
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
    this.dialogueText.y = VIEW_HEIGHT * 0.5
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
    this.scoreText.y = VIEW_HEIGHT * 0.68
    this.addChild(this.scoreText)

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
    this.hintText.y = VIEW_HEIGHT * 0.9
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
    this.bgGraphics.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    this.bgGraphics.fill({ color: info.bgColor, alpha: 0.3 })
    this.bgGraphics.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    this.bgGraphics.fill({ color: 0x000000, alpha: 0.7 })

    // テキスト更新
    this.titleText.text = info.title
    this.dialogueText.text = info.dialogue
    this.scoreText.text = `Final Score: ${score}`
  }
}
