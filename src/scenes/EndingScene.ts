import Phaser from 'phaser'

interface EndingData {
  score: number
  timeSpent: number
  screenshots?: string[]
}

export class EndingScene extends Phaser.Scene {
  private score: number = 0
  private timeSpent: number = 0
  private endingLevel: number = 0
  private currentProgress: number = 0
  private screenshots: string[] = []

  constructor() {
    super({ key: 'EndingScene' })
  }

  init(data: EndingData) {
    this.score = data.score || 0
    this.timeSpent = data.timeSpent || 0
    this.screenshots = data.screenshots || []
    
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
    
    // スクリーンショット表示
    this.showScreenshots(width, height)
    
    // 画面全体タップでリプレイ
    this.setupReplayInput()
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
    // スコア表示（位置を少し上に調整）
    this.add.text(width / 2, height * 0.68, `Final Score: ${this.score}`, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5)

    // プレイ時間
    this.add.text(width / 2, height * 0.72, `Time: ${this.timeSpent}s`, {
      fontSize: '18px',
      color: '#cccccc',
      fontFamily: 'monospace'
    }).setOrigin(0.5)
  }

  private showScreenshots(width: number, height: number) {
    if (this.screenshots.length === 0) {
      // スクリーンショットがない場合のメッセージ
      this.add.text(width / 2, height * 0.82, 'No screenshots captured', {
        fontSize: '14px',
        color: '#666666',
        fontFamily: 'monospace'
      }).setOrigin(0.5)
      return
    }

    // スクリーンショット表示エリアのタイトル
    this.add.text(width / 2, height * 0.76, `Screenshots (${this.screenshots.length}/3)`, {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'monospace'
    }).setOrigin(0.5)

    // スクリーンショットを小さなサムネイルとして横並びで表示
    const thumbnailWidth = 80
    const thumbnailHeight = 60
    const spacing = 90
    const startX = width / 2 - (this.screenshots.length - 1) * spacing / 2

    this.screenshots.forEach((screenshotData, index) => {
      const x = startX + index * spacing
      const y = height * 0.84

      try {
        // base64データからテクスチャを作成
        const texture = this.textures.addBase64(`screenshot_${index}`, screenshotData)
        if (texture) {
          const thumbnail = this.add.image(x, y, `screenshot_${index}`)
          thumbnail.setDisplaySize(thumbnailWidth, thumbnailHeight)
          
          // 枠線を追加
          const border = this.add.rectangle(x, y, thumbnailWidth + 4, thumbnailHeight + 4)
          border.setStrokeStyle(2, 0xffffff, 0.8)
          border.setDepth(thumbnail.depth - 1)
        }
      } catch (error) {
        console.warn(`スクリーンショット ${index} の表示に失敗:`, error)
        // エラー時は灰色の矩形を表示
        const placeholder = this.add.rectangle(x, y, thumbnailWidth, thumbnailHeight, 0x444444)
        placeholder.setStrokeStyle(2, 0x666666)
      }
    })
  }

  private setupReplayInput() {
    // 画面全体をタップ可能エリアに設定
    this.input.once('pointerdown', () => {
      this.scene.start('TitleScene')
    })
    
    // タップ可能であることを示すテキスト
    const { width, height } = this.scale
    this.add.text(width / 2, height * 0.9, 'タップでタイトルへ', {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
      alpha: 0.7
    }).setOrigin(0.5)
  }
}