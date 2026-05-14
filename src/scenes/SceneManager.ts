import { Container } from 'pixi.js'

export type SceneKey = 'title' | 'game'

export class SceneManager {
  readonly world = new Container()
  private readonly scenes = new Map<SceneKey, Container>()
  private currentKey: SceneKey | null = null

  registerScene(key: SceneKey, scene: Container): void {
    scene.visible = false
    this.scenes.set(key, scene)
    this.world.addChild(scene)
  }

  show(key: SceneKey): void {
    for (const [sceneKey, scene] of this.scenes) {
      scene.visible = sceneKey === key
    }
    this.currentKey = key
  }

  get current(): SceneKey | null {
    return this.currentKey
  }
}
