/**
 * #39: Nostalgic Ranking への自動送信クライアント。
 *
 * 仕様の出典:
 * - `~/repos/2025/nostalgic/docs/user-guide/services/ranking.md`
 * - submit は GET `/api/ranking?action=submit&id={ID}&name={NAME}&score={SCORE}`
 * - GET は GET `/api/ranking?action=get&id={ID}&limit={LIMIT}`
 *
 * 設計方針:
 * - ネットワーク障害・404・タイムアウトは **握りつぶす**（return null / false）。
 *   ゲーム進行をブロックしない（旧版踏襲、CLAUDE.md 内のオフライン対応）。
 * - サーバー側ランキング ID (`tacojiman-xxxxxxxx`) はまだ確定していないので、
 *   `VITE_NOSTALGIC_RANKING_ID` 環境変数で差し替え可能。未設定なら自動送信スキップ。
 * - エンドポイントはデフォルトで `https://api.nostalgic.llll-ll.com` を使う。
 */

// TODO: nostalgic で `/nostalgic create ranking https://tacojiman.llll-ll.com` を
// 実行して得た公開 ID を、ビルド時に `VITE_NOSTALGIC_RANKING_ID` で注入する。
const DEFAULT_API_BASE = 'https://api.nostalgic.llll-ll.com'

export interface RankingEntry {
  rank: number
  name: string
  score: number
  displayScore?: string
  createdAt?: string
}

export interface RankingClientOptions {
  apiBase?: string
  rankingId?: string | null
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

function resolveEnv(name: string): string | null {
  try {
    const env = (
      import.meta as unknown as { env?: Record<string, string | undefined> }
    ).env
    if (env && typeof env[name] === 'string' && env[name]!.length > 0) {
      return env[name] as string
    }
  } catch {
    // ignore
  }
  return null
}

function defaultRankingId(): string | null {
  return resolveEnv('VITE_NOSTALGIC_RANKING_ID')
}

function defaultApiBase(): string {
  return resolveEnv('VITE_NOSTALGIC_API_BASE') ?? DEFAULT_API_BASE
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number
): Promise<Response | null> {
  // AbortController が無い環境では timeout 無しで実行する
  if (typeof AbortController === 'undefined') {
    try {
      return await fetchImpl(url)
    } catch {
      return null
    }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { signal: controller.signal })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export class RankingClient {
  private readonly apiBase: string
  private readonly rankingId: string | null
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(options: RankingClientOptions = {}) {
    this.apiBase = options.apiBase ?? defaultApiBase()
    this.rankingId =
      options.rankingId === undefined ? defaultRankingId() : options.rankingId
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? 5_000
  }

  isConfigured(): boolean {
    return (
      this.rankingId !== null &&
      this.rankingId.length > 0 &&
      typeof this.fetchImpl === 'function'
    )
  }

  /**
   * スコアを送信する。
   * 設定不足 / ネットワーク失敗 / 非 2xx の場合は false を返す。
   * 例外は内部で握りつぶす。
   */
  async submit(name: string, score: number): Promise<boolean> {
    if (!this.isConfigured()) return false
    if (!Number.isFinite(score) || score < 0) return false
    const url =
      `${this.apiBase}/ranking?action=submit` +
      `&id=${encodeURIComponent(this.rankingId as string)}` +
      `&name=${encodeURIComponent(name)}` +
      `&score=${encodeURIComponent(Math.floor(score).toString())}`
    const response = await fetchWithTimeout(this.fetchImpl, url, this.timeoutMs)
    if (response === null) return false
    return response.ok
  }

  /**
   * 上位エントリを取得する。失敗時 null。
   */
  async fetchTop(limit = 10): Promise<RankingEntry[] | null> {
    if (!this.isConfigured()) return null
    const url =
      `${this.apiBase}/ranking?action=get` +
      `&id=${encodeURIComponent(this.rankingId as string)}` +
      `&limit=${encodeURIComponent(Math.max(1, Math.floor(limit)).toString())}`
    const response = await fetchWithTimeout(this.fetchImpl, url, this.timeoutMs)
    if (response === null || !response.ok) return null
    try {
      const json = (await response.json()) as {
        success?: boolean
        data?: { entries?: RankingEntry[] }
      }
      if (json.success !== true) return null
      return json.data?.entries ?? []
    } catch {
      return null
    }
  }
}

/**
 * モジュール単位のシングルトン。GameScene 等から手軽に呼べる。
 */
export const rankingClient = new RankingClient()
