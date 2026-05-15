import { Howl, Howler } from 'howler'

export class SoundManager {
  private enabled = true
  private sounds: Map<string, Howl> = new Map()

  constructor() {
    this.register('ambient_bird', ['/sounds/ambient_bird.ogg'])
    this.register('ambient_wind', ['/sounds/ambient_wind.ogg'])
    this.register('se_bomb', ['/sounds/se_bomb.ogg'])
    this.register('se_damage', ['/sounds/se_damage.ogg'])
    this.register('se_score', ['/sounds/se_score.ogg'])
    this.register('bgm_takokong', ['/sounds/bgm_takokong.ogg'])
  }

  private register(key: string, src: string[]): void {
    try {
      const howl = new Howl({
        src,
        preload: true,
        onloaderror: () => {
          // 音声ファイルが存在しない場合はサイレントに無視
        },
      })
      this.sounds.set(key, howl)
    } catch {
      // Howl 初期化失敗もサイレントに無視
    }
  }

  startAmbient(): void {
    if (!this.enabled) return
    const bird = this.sounds.get('ambient_bird')
    const wind = this.sounds.get('ambient_wind')
    if (bird) {
      bird.loop(true)
      bird.volume(0.2)
      bird.play()
    }
    if (wind) {
      wind.loop(true)
      wind.volume(0.2)
      wind.play()
    }
  }

  stopAmbient(): void {
    this.sounds.get('ambient_bird')?.stop()
    this.sounds.get('ambient_wind')?.stop()
  }

  playSe(key: string): void {
    if (!this.enabled) return
    const howl = this.sounds.get(key)
    if (!howl) return
    try {
      howl.volume(0.3)
      howl.play()
    } catch {
      // ファイルがなければ無音
    }
  }

  playTakokongBgm(): void {
    if (!this.enabled) return
    const howl = this.sounds.get('bgm_takokong')
    if (!howl) return
    try {
      howl.loop(false)
      howl.volume(0.4)
      howl.play()
      // 10秒後に自動停止
      setTimeout(() => {
        howl.stop()
      }, 10000)
    } catch {
      // ファイルがなければ無音
    }
  }

  stopAll(): void {
    Howler.stop()
  }

  toggleMute(): boolean {
    this.enabled = !this.enabled
    if (this.enabled) {
      Howler.mute(false)
    } else {
      Howler.mute(true)
    }
    return this.enabled
  }
}
