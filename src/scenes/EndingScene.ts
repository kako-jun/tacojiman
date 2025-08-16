import Phaser from 'phaser'

interface EndingData {
  score: number
  timeSpent: number
}

export class EndingScene extends Phaser.Scene {
  private score: number = 0
  private timeSpent: number = 0
  private endingLevel: number = 0
  private currentProgress: number = 0

  constructor() {
    super({ key: 'EndingScene' })
  }

  init(data: EndingData) {
    this.score = data.score || 0
    this.timeSpent = data.timeSpent || 0
    
    // スコアに応じてエンディングレベル決定
    this.endingLevel = this.calculateEndingLevel(this.score)
    
    // 進捗を1段階進める
    this.currentProgress = parseInt(localStorage.getItem('tacojiman_progress') || '0')
    if (this.currentProgress < 10) {
      this.currentProgress++
      localStorage.setItem('tacojiman_progress', this.currentProgress.toString())
    }
  }

  create() {
    const { width, height } = this.scale

    // 背景作成
    this.createEndingBackground(width, height)
    
    // エンディング内容表示
    this.showEndingContent(width, height)
    
    // スコア表示
    this.showScoreResults(width, height)
    
    // リトライボタン
    this.createRetryButton(width, height)
  }

  private calculateEndingLevel(score: number): number {
    if (score >= 8001) return 5 // 真エンディング
    if (score >= 5001) return 4 // スペシャルエンド
    if (score >= 3001) return 3 // グッドエンド
    if (score >= 1001) return 2 // ノーマルエンド
    return 1 // バッドエンド
  }

  private createEndingBackground(width: number, height: number) {
    const graphics = this.add.graphics()
    
    // エンディングレベルに応じた背景色
    let bgColor: number
    switch (this.endingLevel) {
      case 5: bgColor = 0xffd700; break // 金色（真エンディング）
      case 4: bgColor = 0xff69b4; break // ピンク（スペシャル）
      case 3: bgColor = 0x87ceeb; break // 水色（グッド）
      case 2: bgColor = 0xdda0dd; break // 薄紫（ノーマル）
      default: bgColor = 0x696969; break // グレー（バッド）
    }
    
    graphics.fillStyle(bgColor, 0.3)
    graphics.fillRect(0, 0, width, height)
    
    // グラデーション効果
    graphics.fillStyle(0x000000, 0.7)
    graphics.fillRect(0, 0, width, height)
  }

  private showEndingContent(width: number, height: number) {
    let endingTitle: string
    let endingMessage: string
    let characterReaction: string
    
    switch (this.endingLevel) {
      case 5:
        endingTitle = '真エンディング'
        endingMessage = '幼馴染の顔全体が見え、真の笑顔が...'
        characterReaction = '「ありがとう...今度は私が守るから」'
        break
      case 4:
        endingTitle = 'スペシャルエンド'
        endingMessage = '目元が初めて見え、涙を浮かべる'
        characterReaction = '「本当は...好きだったの」'
        break
      case 3:
        endingTitle = 'グッドエンド'
        endingMessage = '目元が初めて見え、涙を浮かべる'
        characterReaction = '「心配してくれてたのね...」'
        break
      case 2:
        endingTitle = 'ノーマルエンド'
        endingMessage = '幼馴染が少し寂しそうに'
        characterReaction = '「今日は大事な日だったのに...」'
        break
      default:
        endingTitle = 'バッドエンド'
        endingMessage = '幼馴染が去っていく'
        characterReaction = '「もう来ない...」'
    }

    // エンディングタイトル
    this.add.text(width / 2, height * 0.2, endingTitle, {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5)

    // エンディング内容
    this.add.text(width / 2, height * 0.35, endingMessage, {
      fontSize: '18px',
      color: '#ffeeaa',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: { width: width * 0.8 },
      align: 'center'
    }).setOrigin(0.5)

    // キャラクターの台詞
    this.add.text(width / 2, height * 0.5, characterReaction, {
      fontSize: '20px',
      color: '#ffaaaa',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: { width: width * 0.8 },
      align: 'center'
    }).setOrigin(0.5)

    // 進捗表示
    this.add.text(width / 2, height * 0.65, `進捗更新: Lv.${this.currentProgress}/10`, {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'monospace'
    }).setOrigin(0.5)
  }

  private showScoreResults(width: number, height: number) {
    // スコア表示
    this.add.text(width / 2, height * 0.75, `Final Score: ${this.score}`, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5)

    // プレイ時間
    this.add.text(width / 2, height * 0.8, `Time: ${this.timeSpent}s`, {
      fontSize: '18px',
      color: '#cccccc',
      fontFamily: 'monospace'
    }).setOrigin(0.5)
  }

  private createRetryButton(width: number, height: number) {
    const retryButton = this.add.text(width / 2, height * 0.9, 'もう一度プレイ', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
      backgroundColor: '#333333',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)

    retryButton.setInteractive()
    
    // ホバー効果
    retryButton.on('pointerover', () => {
      retryButton.setScale(1.1)
    })
    
    retryButton.on('pointerout', () => {
      retryButton.setScale(1)
    })
    
    // クリックでタイトルに戻る
    retryButton.on('pointerdown', () => {
      this.scene.start('TitleScene')
    })
  }
}