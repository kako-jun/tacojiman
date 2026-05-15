import type { Direction } from '../types/GameState'

export class KeyboardManager {
  private readonly keys = new Set<string>()

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.key)
    if (
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight'
    ) {
      e.preventDefault()
    }
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
