import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __clearTacojimanStorage,
  clampProgressLevel,
  computeProgressBackground,
  generatePlayerName,
  incrementProgress,
  loadHighScore,
  loadProgress,
  PROGRESS_LEVEL_MAX,
  saveHighScoreIfNew,
  saveProgress,
  shouldUpdateHighScore,
} from './storage'

/**
 * jsdom が無くても通るように、`globalThis.localStorage` を Map ベースの
 * 簡易モックで差し替える。テスト終了時に元へ戻す。
 */
function installLocalStorageMock(): { restore: () => void } {
  const store = new Map<string, string>()
  const mock: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) =>
      store.has(key) ? (store.get(key) as string) : null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
  }
  const original = (globalThis as { localStorage?: Storage }).localStorage
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: mock,
  })
  return {
    restore: () => {
      if (typeof original === 'undefined') {
        delete (globalThis as { localStorage?: Storage }).localStorage
      } else {
        Object.defineProperty(globalThis, 'localStorage', {
          configurable: true,
          value: original,
        })
      }
    },
  }
}

describe('clampProgressLevel', () => {
  it('clamps to 0..10 integer range', () => {
    expect(clampProgressLevel(-5)).toBe(0)
    expect(clampProgressLevel(0)).toBe(0)
    expect(clampProgressLevel(3)).toBe(3)
    expect(clampProgressLevel(10)).toBe(10)
    expect(clampProgressLevel(11)).toBe(10)
    expect(clampProgressLevel(3.9)).toBe(3)
  })

  it('returns 0 for non-finite input', () => {
    expect(clampProgressLevel(Number.NaN)).toBe(0)
    expect(clampProgressLevel(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('shouldUpdateHighScore', () => {
  it('updates when there is no previous record', () => {
    expect(shouldUpdateHighScore(100, null)).toBe(true)
  })

  it('updates only when strictly greater', () => {
    const prev = {
      score: 500,
      achievedAt: '2025-01-01T00:00:00Z',
      playerName: 'a',
    }
    expect(shouldUpdateHighScore(499, prev)).toBe(false)
    expect(shouldUpdateHighScore(500, prev)).toBe(false)
    expect(shouldUpdateHighScore(501, prev)).toBe(true)
  })

  it('rejects non-positive or non-finite scores', () => {
    expect(shouldUpdateHighScore(0, null)).toBe(false)
    expect(shouldUpdateHighScore(-1, null)).toBe(false)
    expect(shouldUpdateHighScore(Number.NaN, null)).toBe(false)
  })
})

describe('computeProgressBackground', () => {
  it('returns night at level 0 and morning at level 10', () => {
    expect(computeProgressBackground(0)).toBe(0x000033)
    expect(computeProgressBackground(10)).toBe(0xff9966)
  })

  it('interpolates linearly between endpoints', () => {
    // Lv 5 はちょうど中間：各成分を線形補間
    const mid = computeProgressBackground(5)
    const r = (mid >> 16) & 0xff
    const g = (mid >> 8) & 0xff
    const b = mid & 0xff
    expect(r).toBe(Math.round((0x00 + 0xff) / 2))
    expect(g).toBe(Math.round((0x00 + 0x99) / 2))
    expect(b).toBe(Math.round((0x33 + 0x66) / 2))
  })

  it('clamps out-of-range input', () => {
    expect(computeProgressBackground(-3)).toBe(computeProgressBackground(0))
    expect(computeProgressBackground(99)).toBe(
      computeProgressBackground(PROGRESS_LEVEL_MAX)
    )
  })
})

describe('storage I/O', () => {
  let restore: () => void

  beforeEach(() => {
    const installed = installLocalStorageMock()
    restore = installed.restore
    __clearTacojimanStorage()
  })

  afterEach(() => {
    restore()
  })

  it('loadProgress returns defaults when nothing is stored', () => {
    expect(loadProgress()).toEqual({ level: 0, totalPlays: 0 })
  })

  it('saveProgress + loadProgress round-trips and clamps level', () => {
    saveProgress({ level: 42, totalPlays: 7 })
    expect(loadProgress()).toEqual({ level: 10, totalPlays: 7 })
  })

  it('incrementProgress bumps level (capped) and totalPlays (uncapped)', () => {
    saveProgress({ level: 9, totalPlays: 100 })
    expect(incrementProgress()).toEqual({ level: 10, totalPlays: 101 })
    expect(incrementProgress()).toEqual({ level: 10, totalPlays: 102 })
  })

  it('loadHighScore returns null when missing', () => {
    expect(loadHighScore()).toBeNull()
  })

  it('saveHighScoreIfNew updates only when score improves', () => {
    const first = saveHighScoreIfNew(1000, 'Tokyo0001')
    expect(first.updated).toBe(true)
    expect(first.current.score).toBe(1000)
    expect(first.current.playerName).toBe('Tokyo0001')

    const lower = saveHighScoreIfNew(500, 'Tokyo0001')
    expect(lower.updated).toBe(false)
    expect(lower.current.score).toBe(1000)

    const higher = saveHighScoreIfNew(1500, 'Osaka0002')
    expect(higher.updated).toBe(true)
    expect(higher.current.score).toBe(1500)
    expect(higher.current.playerName).toBe('Osaka0002')

    const persisted = loadHighScore()
    expect(persisted?.score).toBe(1500)
  })

  it('generatePlayerName persists across calls', () => {
    const rand = vi
      .fn<() => number>()
      .mockReturnValueOnce(0) // city index 0 → 東京
      .mockReturnValueOnce(0.0) // number = 0*9999+1 = 1
    const first = generatePlayerName(rand)
    expect(first).toBe('東京0001')

    // 2 回目以降は保存済み値を返すので rand は呼ばれない
    const rand2 = vi.fn<() => number>().mockReturnValue(0.99)
    expect(generatePlayerName(rand2)).toBe('東京0001')
    expect(rand2).not.toHaveBeenCalled()
  })

  it('loadProgress tolerates corrupt JSON', () => {
    localStorage.setItem('tacojiman_progress', '{not json')
    expect(loadProgress()).toEqual({ level: 0, totalPlays: 0 })
  })

  it('loadHighScore rejects payload missing required fields', () => {
    localStorage.setItem('tacojiman_high_score', JSON.stringify({ score: 100 }))
    expect(loadHighScore()).toBeNull()
  })
})
