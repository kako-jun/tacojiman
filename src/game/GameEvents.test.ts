import { describe, it, expect, vi } from 'vitest'
import { GameEventEmitter } from './GameEvents'

describe('GameEventEmitter', () => {
  it('on + emit でハンドラが呼ばれる', () => {
    const emitter = new GameEventEmitter()
    const handler = vi.fn()
    emitter.on('score-gain', handler)
    emitter.emit('score-gain', { x: 0, y: 0, score: 10, combo: 1 })
    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({ x: 0, y: 0, score: 10, combo: 1 })
  })

  it('off でハンドラが削除される', () => {
    const emitter = new GameEventEmitter()
    const handler = vi.fn()
    emitter.on('score-gain', handler)
    emitter.off('score-gain', handler)
    emitter.emit('score-gain', { x: 0, y: 0, score: 10, combo: 1 })
    expect(handler).not.toHaveBeenCalled()
  })

  it('未登録イベントを emit してもクラッシュしない', () => {
    const emitter = new GameEventEmitter()
    expect(() => {
      emitter.emit('game-over', undefined as void)
    }).not.toThrow()
  })

  it('clear 後は何も呼ばれない', () => {
    const emitter = new GameEventEmitter()
    const handler = vi.fn()
    emitter.on('score-gain', handler)
    emitter.clear()
    emitter.emit('score-gain', { x: 0, y: 0, score: 10, combo: 1 })
    expect(handler).not.toHaveBeenCalled()
  })

  it('複数ハンドラが登録されているとき全て呼ばれる', () => {
    const emitter = new GameEventEmitter()
    const h1 = vi.fn()
    const h2 = vi.fn()
    const h3 = vi.fn()
    emitter.on('score-gain', h1)
    emitter.on('score-gain', h2)
    emitter.on('score-gain', h3)
    emitter.emit('score-gain', { x: 1, y: 2, score: 5, combo: 2 })
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
    expect(h3).toHaveBeenCalledOnce()
  })
})
