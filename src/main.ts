import Phaser from 'phaser'
import { DEFAULT_GAME_CONFIG } from '@/utils/config'

// シーンのインポート
import { TitleScene } from './scenes/TitleScene'
import { GameScene } from './scenes/GameScene'
import { EndingScene } from './scenes/EndingScene'

class Game extends Phaser.Game {
  constructor() {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: DEFAULT_GAME_CONFIG.width,
      height: DEFAULT_GAME_CONFIG.height,
      parent: 'game-container',
      backgroundColor: '#000000',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: Phaser.Scale.PORTRAIT
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: import.meta.env.DEV
        }
      },
      scene: [
        TitleScene,
        GameScene,
        EndingScene
      ],
      input: {
        touch: true
      },
      render: {
        pixelArt: true,
        antialias: false
      }
    }

    super(config)
    
    // 開発用のデバッグ情報
    if (import.meta.env.DEV) {
      console.log('🎮 tacojiman ゲーム開始')
      console.log('設定:', DEFAULT_GAME_CONFIG)
    }
  }
}

// DOM読み込み完了後にゲーム開始
document.addEventListener('DOMContentLoaded', () => {
  // ローディング画面を隠す
  const loadingElement = document.getElementById('loading')
  if (loadingElement) {
    loadingElement.style.display = 'none'
  }

  // ゲーム開始
  new Game()
})

export default Game