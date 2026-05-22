import { Application } from 'pixi.js'
import {
  createInitialGameState,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from './types/GameState'
import { COLORS } from './constants/colors'
import { GameScene } from './scenes/GameScene'
import { SceneManager } from './scenes/SceneManager'
import { TitleScene } from './scenes/TitleScene'
import { EndingScene } from './scenes/EndingScene'
import './index.css'

const VIEW_ASPECT = VIEW_WIDTH / VIEW_HEIGHT

async function bootstrap(): Promise<void> {
  const root = document.getElementById('root')
  if (root === null) {
    throw new Error('Mount element #root not found in index.html')
  }

  const app = new Application()
  await app.init({
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    background: COLORS.background,
    resolution: window.devicePixelRatio,
    autoDensity: true,
    antialias: false,
  })
  root.appendChild(app.canvas)
  const resizeCanvas = (): void => {
    const windowAspect = window.innerWidth / window.innerHeight
    const displayH =
      windowAspect > VIEW_ASPECT
        ? Math.floor(window.innerHeight)
        : Math.floor(window.innerWidth / VIEW_ASPECT)
    const displayW = Math.floor(displayH * VIEW_ASPECT)
    app.renderer.resize(displayW, displayH)
    app.stage.scale.set(displayW / VIEW_WIDTH)
    app.canvas.style.width = `${displayW}px`
    app.canvas.style.height = `${displayH}px`
  }
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)

  const sceneManager = new SceneManager()
  app.stage.addChild(sceneManager.world)

  const gameScene = new GameScene()

  const titleScene = new TitleScene(() => {
    gameScene.initWithState(createInitialGameState())
    sceneManager.show('game')
  })

  const endingScene = new EndingScene(() => {
    gameScene.initWithState(createInitialGameState())
    titleScene.refresh()
    sceneManager.show('title')
  })

  // #42: スクリーンショット取得関数を GameScene に注入
  gameScene.setCaptureCallback(() => {
    try {
      const canvas = app.renderer.extract.canvas(app.stage) as HTMLCanvasElement
      if (typeof canvas.toDataURL !== 'function') return null
      return canvas.toDataURL('image/png')
    } catch {
      return null
    }
  })

  gameScene.onEnding = (score, screenshots) => {
    endingScene.show(score, screenshots)
    sceneManager.show('ending')
  }

  sceneManager.registerScene('title', titleScene)
  sceneManager.registerScene('game', gameScene)
  sceneManager.registerScene('ending', endingScene)
  sceneManager.show('title')

  app.ticker.add((ticker) => {
    gameScene.update(ticker)
  })
}

void bootstrap()
