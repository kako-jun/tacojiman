import { Container, Graphics, Text } from 'pixi.js'
import { COLORS } from '../constants/colors'
import { VIEW_HEIGHT, VIEW_WIDTH } from '../types/GameState'

export class TitleScene extends Container {
  constructor(onStart: () => void) {
    super()

    const bg = new Graphics()
      .rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
      .fill(COLORS.background)
      .rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT * 0.56)
      .fill(COLORS.sky)
    this.addChild(bg)

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
    title.y = 154
    this.addChild(title)

    const subtitle = new Text({
      text: 'All Your Wake Are Belong To Us!',
      style: {
        fill: COLORS.uiMuted,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        fontWeight: '700',
      },
    })
    subtitle.anchor.set(0.5)
    subtitle.x = VIEW_WIDTH / 2
    subtitle.y = 204
    this.addChild(subtitle)

    const button = new Graphics()
      .roundRect(92, 430, 216, 52, 8)
      .fill(COLORS.uiAccent)
    button.eventMode = 'static'
    button.cursor = 'pointer'
    button.on('pointertap', onStart)
    this.addChild(button)

    const buttonText = new Text({
      text: 'START',
      style: {
        fill: 0x20120c,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 20,
        fontWeight: '700',
      },
    })
    buttonText.anchor.set(0.5)
    buttonText.x = VIEW_WIDTH / 2
    buttonText.y = 456
    this.addChild(buttonText)
  }
}
