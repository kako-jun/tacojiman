import Phaser from 'phaser'

export class CameraController {
  private scene: Phaser.Scene
  private camera: Phaser.Cameras.Scene2D.Camera
  private isZoomedIn: boolean = false
  private zoomLevel: number = 1
  private zoomTarget: { x: number; y: number } | null = null
  private homeX: number
  private homeY: number
  private isZooming: boolean = false
  private zoomTween: Phaser.Tweens.Tween | null = null
  private isZoomingOut: boolean = false

  constructor(scene: Phaser.Scene, homeX: number, homeY: number) {
    this.scene = scene
    this.camera = scene.cameras.main
    this.homeX = homeX
    this.homeY = homeY
    
    // カメラの初期設定
    this.camera.setZoom(1)
    this.camera.scrollX = homeX - this.camera.width / 2
    this.camera.scrollY = homeY - this.camera.height / 2
  }

  public startZoomIn(targetX: number, targetY: number, zoomLevel: number = 3) {
    if (this.isZooming) return

    this.isZooming = true
    this.isZoomedIn = true
    this.zoomLevel = zoomLevel
    this.zoomTarget = { x: targetX, y: targetY }

    // 家中心から開始して、1秒後にタップ位置が中心になるズームイン
    this.zoomTween = this.scene.tweens.add({
      targets: this.camera,
      zoom: zoomLevel,
      duration: 1000, // 1秒かけて3倍ズーム
      ease: 'Linear',
      onUpdate: () => {
        // ズーム進行度（0→1）
        const progress = (this.camera.zoom - 1) / (zoomLevel - 1)
        
        // 家の位置からタップ位置へ中心を補間
        const currentCenterX = this.homeX + (targetX - this.homeX) * progress
        const currentCenterY = this.homeY + (targetY - this.homeY) * progress
        
        // centerOnの代わりにscrollX/Yを直接設定
        this.camera.scrollX = currentCenterX - this.camera.width / 2
        this.camera.scrollY = currentCenterY - this.camera.height / 2
      }
    })
  }

  public stopZoomIn() {
    if (this.zoomTween) {
      this.zoomTween.stop()
      this.zoomTween = null
    }
    this.isZooming = false
  }

  public zoomOut() {
    this.stopZoomIn() // ズーム中のアニメーションを停止
    
    if (!this.isZoomedIn) return

    this.isZoomingOut = true
    this.isZoomedIn = false
    
    // ズームアウト開始時点の中心位置を記録
    const startCenterX = this.camera.scrollX + this.camera.width / 2
    const startCenterY = this.camera.scrollY + this.camera.height / 2

    // ズームアウト（半分の速度 = 2秒）
    this.scene.tweens.add({
      targets: this.camera,
      zoom: 1,
      duration: 2000, // ズームインの半分の速度（2秒）
      ease: 'Linear',
      onUpdate: () => {
        // ズーム進行度（3倍→1倍への進行度）
        const progress = (this.zoomLevel - this.camera.zoom) / (this.zoomLevel - 1)
        
        // 現在の中心位置から家の位置へ線形補間
        const currentCenterX = startCenterX + (this.homeX - startCenterX) * progress
        const currentCenterY = startCenterY + (this.homeY - startCenterY) * progress
        
        // centerOnの代わりにscrollX/Yを直接設定
        this.camera.scrollX = currentCenterX - this.camera.width / 2
        this.camera.scrollY = currentCenterY - this.camera.height / 2
      },
      onComplete: () => {
        this.zoomTarget = null
        this.isZoomingOut = false
      }
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

  public getIsZoomingOut(): boolean {
    return this.isZoomingOut
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
    this.isZooming = false
    this.isZoomingOut = false
    this.zoomTween = null
  }
}