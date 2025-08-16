import Phaser from 'phaser'

export class UIScene extends Phaser.Scene {
  private clockDisplay!: Phaser.GameObjects.Text
  private scoreDisplay!: Phaser.GameObjects.Text
  private bombStockDisplay!: Phaser.GameObjects.Text
  
  private gameStartMorningTime: string = ''
  private currentScore: number = 0
  private gameStartTime: number = 0

  constructor() {
    super({ key: 'UIScene' })
  }

  create() {
    const { width, height } = this.scale
    
    // UI要素を作成（ズームの影響を受けない独立したシーン）
    this.clockDisplay = this.add.text(20, 20, '', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    })
    
    this.scoreDisplay = this.add.text(width - 20, 20, '0 oct', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(1, 0)

    this.bombStockDisplay = this.add.text(20, height - 50, '', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    })
  }

  public updateClock(clockText: string) {
    if (this.clockDisplay) {
      this.clockDisplay.setText(clockText)
    }
  }

  public updateScore(score: number) {
    this.currentScore = score
    if (this.scoreDisplay) {
      this.scoreDisplay.setText(`${score} oct`)
    }
  }

  public updateBombDisplay(bombText: string) {
    if (this.bombStockDisplay) {
      this.bombStockDisplay.setText(bombText)
    }
  }
}