import { describe, expect, it, vi } from 'vitest'
import { RankingClient } from './RankingClient'

function makeResponse(init: { ok: boolean; json?: () => Promise<unknown> }): Response {
  return {
    ok: init.ok,
    status: init.ok ? 200 : 500,
    json: init.json ?? (() => Promise.resolve({})),
  } as unknown as Response
}

describe('RankingClient.submit', () => {
  it('returns false when no rankingId is configured', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const client = new RankingClient({ rankingId: null, fetchImpl })
    expect(await client.submit('Tokyo0001', 1234)).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('builds the submit URL and returns true on 2xx', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(makeResponse({ ok: true }))
    const client = new RankingClient({
      apiBase: 'https://example.test',
      rankingId: 'tacojiman-deadbeef',
      fetchImpl,
    })
    const ok = await client.submit('東京0001', 4242)
    expect(ok).toBe(true)
    const calledUrl = fetchImpl.mock.calls[0][0] as string
    expect(calledUrl).toContain('https://example.test/ranking?action=submit')
    expect(calledUrl).toContain('id=tacojiman-deadbeef')
    expect(calledUrl).toContain(`name=${encodeURIComponent('東京0001')}`)
    expect(calledUrl).toContain('score=4242')
  })

  it('swallows fetch rejection and returns false', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network down'))
    const client = new RankingClient({
      rankingId: 'tacojiman-deadbeef',
      fetchImpl,
    })
    expect(await client.submit('foo', 100)).toBe(false)
  })

  it('returns false on non-2xx response', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(makeResponse({ ok: false }))
    const client = new RankingClient({
      rankingId: 'tacojiman-deadbeef',
      fetchImpl,
    })
    expect(await client.submit('foo', 100)).toBe(false)
  })
})

describe('RankingClient.fetchTop', () => {
  it('returns entries on success', async () => {
    const entries = [{ rank: 1, name: 'a', score: 999 }]
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      makeResponse({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { entries } }),
      })
    )
    const client = new RankingClient({
      rankingId: 'tacojiman-deadbeef',
      fetchImpl,
    })
    expect(await client.fetchTop(5)).toEqual(entries)
  })

  it('returns null on malformed payload', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      makeResponse({
        ok: true,
        json: () => Promise.resolve({ success: false }),
      })
    )
    const client = new RankingClient({
      rankingId: 'tacojiman-deadbeef',
      fetchImpl,
    })
    expect(await client.fetchTop()).toBeNull()
  })
})
