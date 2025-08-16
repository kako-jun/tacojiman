import Phaser from 'phaser'

export class CameraController {
  private scene: Phaser.Scene
  private camera: Phaser.Cameras.Scene2D.Camera
  private isZoomedIn: boolean = false
  private zoomLevel: number = 1
  private zoomTarget: { x: number; y: number } | null = null
  private homeX: number
  private homeY: number

  constructor(scene: Phaser.Scene, homeX: number, homeY: number) {
    this.scene = scene
    this.camera = scene.cameras.main
    this.homeX = homeX
    this.homeY = homeY
    
    // カメラの初期設定
    this.camera.setZoom(1)
    this.camera.centerOn(homeX, homeY)
  }

  public startZoomIn(targetX: number, targetY: number, zoomLevel: number = 2) {
    if (this.isZoomedIn) return

    this.isZoomedIn = true
    this.zoomLevel = zoomLevel
    this.zoomTarget = { x: targetX, y: targetY }

    // ズームインアニメーション
    this.scene.tweens.add({
      targets: this.camera,
      zoom: zoomLevel,
      duration: 300,
      ease: 'Power2'
    })

    // カメラ移動アニメーション
    this.scene.tweens.add({
      targets: this.camera,
      scrollX: targetX - this.camera.width / 2 / zoomLevel,
      scrollY: targetY - this.camera.height / 2 / zoomLevel,
      duration: 300,
      ease: 'Power2'
    })
  }

  public zoomOut() {
    if (!this.isZoomedIn) return

    this.isZoomedIn = false
    this.zoomTarget = null

    // ホーム位置に戻るアニメーション
    this.scene.tweens.add({
      targets: this.camera,
      zoom: 1,
      duration: 400,
      ease: 'Power2'
    })

    this.scene.tweens.add({
      targets: this.camera,
      scrollX: this.homeX - this.camera.width / 2,
      scrollY: this.homeY - this.camera.height / 2,
      duration: 400,
      ease: 'Power2'
    })
  }

  public updateZoomTarget(targetX: number, targetY: number) {
    if (!this.isZoomedIn) return

    this.zoomTarget = { x: targetX, y: targetY }

    // スムーズにカメラ移動
    this.scene.tweens.add({
      targets: this.camera,
      scrollX: targetX - this.camera.width / 2 / this.zoomLevel,
      scrollY: targetY - this.camera.height / 2 / this.zoomLevel,
      duration: 200,
      ease: 'Power1'
    })
  }

  public getIsZoomedIn(): boolean {
    return this.isZoomedIn
  }

  public getCurrentZoom(): number {
    return this.camera.zoom
  }

  public getZoomTarget(): { x: number; y: number } | null {
    return this.zoomTarget
  }

  public shakeCamera(intensity: number = 5, duration: number = 100) {
    this.camera.shake(duration, intensity)
  }

  public flashCamera(color: number = 0xffffff, duration: number = 100) {
    this.camera.flash(duration, color >> 16, (color >> 8) & 0xff, color & 0xff)
  }

  public fadeIn(duration: number = 500) {
    this.camera.fadeIn(duration)
  }

  public fadeOut(duration: number = 500) {
    this.camera.fadeOut(duration)
  }

  public setRotation(angle: number, duration: number = 1000) {
    // F-ZERO風の回転システム
    this.scene.tweens.add({
      targets: this.camera,
      rotation: angle,
      duration: duration,
      ease: 'Linear'
    })
  }

  public getWorldPoint(screenX: number, screenY: number): { x: number; y: number } {
    const worldPoint = this.camera.getWorldPoint(screenX, screenY)
    return { x: worldPoint.x, y: worldPoint.y }
  }

  public destroy() {
    this.scene.tweens.killTweensOf(this.camera)
  }
}