import Phaser from 'phaser'

export class TitleScene extends Phaser.Scene {
  private backgroundGraphics!: Phaser.GameObjects.Graphics
  private titleText!: Phaser.GameObjects.Text
  private subtitleText!: Phaser.GameObjects.Text
  private startPromptText!: Phaser.GameObjects.Text
  private progressLevel: number = 0

  constructor() {
    super({ key: 'TitleScene' })
  }

  init() {
    // ローカルストレージから進捗レベルを読み込み
    this.progressLevel = parseInt(localStorage.getItem('tacojiman_progress') || '0')
  }

  create() {
    // 画面サイズ取得
    const { width, height } = this.scale

    // 進捗に応じた背景作成
    this.createProgressBackground(width, height)
    
    // タイトルテキスト
    this.titleText = this.add.text(width / 2, height / 3, 'tacojiman', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5)

    // サブタイトル
    this.subtitleText = this.add.text(width / 2, height / 2, '起こしに来た幼馴染が多すぎる', {
      fontSize: '20px',
      color: '#ddccaa', // より落ち着いた色に変更
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5)

    // スタートプロンプト
    this.startPromptText = this.add.text(width / 2, height * 0.7, 'タップしてスタート', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5)

    // 進捗表示
    if (this.progressLevel > 0) {
      this.add.text(width / 2, height * 0.8, `進捗: Lv.${this.progressLevel}/10`, {
        fontSize: '16px',
        color: '#aaaaaa',
        fontFamily: 'monospace'
      }).setOrigin(0.5)
    }

    // ストーリーボタン（小さく画面下部）
    const storyButton = this.add.text(width / 2, height * 0.9, 'ストーリーを読む', {
      fontSize: '14px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0.5)

    // 点滅エフェクト
    this.tweens.add({
      targets: this.startPromptText,
      alpha: 0.3,
      duration: 1000,
      yoyo: true,
      repeat: -1
    })

    // タップでゲーム開始
    this.input.on('pointerdown', () => {
      this.scene.start('GameScene')
    })

    // ストーリーボタンのクリックで外部サイトへ
    storyButton.setInteractive()
    storyButton.on('pointerdown', (event: Phaser.Input.Pointer) => {
      event.stopPropagation()
      window.open('https://kako-jun.github.io/tacojiman', '_blank')
    })
  }

  private createProgressBackground(width: number, height: number) {
    this.backgroundGraphics = this.add.graphics()
    
    // 進捗に応じて背景の明るさを変化
    const darkness = Math.max(0, 10 - this.progressLevel) * 25 // 250 -> 0
    const bgColor = Phaser.Display.Color.GetColor(darkness, darkness, darkness + 20)
    
    this.backgroundGraphics.fillStyle(bgColor)
    this.backgroundGraphics.fillRect(0, 0, width, height)

    // 朝の光の表現（進捗が高いほど明るく）
    if (this.progressLevel > 3) {
      const lightAlpha = (this.progressLevel - 3) / 7 * 0.15 // アルファ値を半分に
      // 優しいオレンジ色の朝焼け
      this.backgroundGraphics.fillStyle(0xff8844, lightAlpha) 
      this.backgroundGraphics.fillCircle(width * 0.8, height * 0.2, 120)
      
      // さらに柔らかい外側の光
      this.backgroundGraphics.fillStyle(0xffaa66, lightAlpha * 0.5)
      this.backgroundGraphics.fillCircle(width * 0.8, height * 0.2, 180)
    }
  }
}