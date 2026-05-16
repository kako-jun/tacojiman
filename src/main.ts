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

  gameScene.onEnding = (score) => {
    endingScene.show(score)
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
