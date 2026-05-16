import type { Direction } from '../types/GameState'

export class KeyboardManager {
  private readonly keys = new Set<string>()
  // #45: SPACE 押下を「1 回だけ」拾うためのエッジ検出フラグ
  private pausePressed = false

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === ' '
    ) {
      e.preventDefault()
    }
    // #45: SPACE はリピート抑止して 1 押下 = 1 エッジに
    if (e.key === ' ' && !e.repeat && !this.keys.has(' ')) {
      this.pausePressed = true
    }
    this.keys.add(e.key)
  }

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key)
  }

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  isPressed(key: string): boolean {
    return this.keys.has(key)
  }

  getBombKey(): boolean {
    // #45: SPACE は pause 専用に移行したので bomb トリガから外す
    return this.isPressed('b') || this.isPressed('B')
  }

  /**
   * #45: SPACE のエッジ検出。直前フレームで押された場合のみ true を返し、
   * フラグはクリアする（リピート抑止）。
   */
  consumePauseToggle(): boolean {
    if (!this.pausePressed) return false
    this.pausePressed = false
    return true
  }

  getDirection(): Direction | null {
    if (this.isPressed('ArrowUp') || this.isPressed('w') || this.isPressed('W'))
      return 'north'
    if (
      this.isPressed('ArrowDown') ||
      this.isPressed('s') ||
      this.isPressed('S')
    )
      return 'south'
    if (
      this.isPressed('ArrowLeft') ||
      this.isPressed('a') ||
      this.isPressed('A')
    )
      return 'west'
    if (
      this.isPressed('ArrowRight') ||
      this.isPressed('d') ||
      this.isPressed('D')
    )
      return 'east'
    return null
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
  }
}
