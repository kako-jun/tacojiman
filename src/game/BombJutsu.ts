import type { BombType, GameState } from '../types/GameState'
import {
  computeTakokongDamage,
  DAINSLEIF_DAMAGE,
  DAINSLEIF_HIT_COUNT,
  DAINSLEIF_HIT_INTERVAL_MS,
  DAINSLEIF_RANGE,
  DECOY_DISTANCE,
  DECOY_LIFETIME_MS,
  DECOY_LURE_RANGE,
  MINE_DAMAGE,
  MINE_EXPLOSION_RANGE,
  MINE_TRIGGER_RANGE,
  PROTON_BEAM_LENGTH,
  PROTON_BEAM_WIDTH,
  PROTON_DAMAGE,
  SENTRY_DAMAGE,
  SENTRY_FIRE_INTERVAL_MS,
  SENTRY_LIFETIME_MS,
  SENTRY_RANGE,
  TAKOKONG_DEFEAT_BONUS,
} from '../types/GameState'

export interface BombEffect {
  type: BombType
  // ダメージを受けた敵のIDと新HPのマップ
  hitResults: Map<string, number>
  // タココング撃破時に加算するボーナススコア（撃破していなければ 0）
  takokongBonus: number
}

// 各ボムの当たり判定を計算し、state.enemies の HP 更新と除去を行う
// BombEffect（hitResults）を返す。エフェクト描画は GameScene 側で行う

/**
 * #38: 全ボム共通の呼び出し口。
 * - 即時ダメージ系（proton/sol/muteki/jakuhou/dainsleif 初段）は hitResults を埋める
 * - 仕掛け系（muddy/sentry/bunshin）は state.mines/sentries/decoys に追加するだけで
 *   hitResults は空のまま
 * - dainsleif は初段ダメージを即時に与え、残り 2 段を state.multiHitBombs に登録する
 */
export function applyBombDamage(state: GameState, type: BombType): BombEffect {
  const result: BombEffect = { type, hitResults: new Map(), takokongBonus: 0 }
  const px = 0
  const py = 0
  switch (type) {
    case 'proton':
      applyProton(state, result, px, py)
      break
    case 'sol':
      applySol(state, result, px, py)
      break
    case 'muteki':
      applyMuteki(state, result)
      break
    case 'jakuhou':
      applyJakuhou(state, result, px, py)
      break
    case 'dainsleif':
      applyDainsleif(state, result, px, py)
      break
    case 'muddy':
      applyMuddy(state, px, py)
      break
    case 'sentry':
      applySentry(state, px, py)
      break
    case 'bunshin':
      applyBunshin(state, px, py)
      break
    default:
      break
  }
  applyHitResults(state, result)
  return result
}

/**
 * #38: hitResults を state.enemies に反映する。
 * takokong はバリア軽減・撃破ボーナスを通す（共通処理）。
 */
export function applyHitResults(state: GameState, result: BombEffect): void {
  for (const enemy of state.enemies) {
    const newHp = result.hitResults.get(enemy.id)
    if (newHp === undefined) continue
    if (enemy.type === 'takokong' && state.takokongState !== null) {
      const tk = state.takokongState
      const damage = enemy.hp - newHp
      const actualDamage = computeTakokongDamage(tk.barrierActive, damage)
      tk.hp = Math.max(0, tk.hp - actualDamage)
      enemy.hp = tk.hp
      if (tk.hp <= 0 && !tk.defeated) {
        tk.defeated = true
        tk.active = false
        result.takokongBonus += TAKOKONG_DEFEAT_BONUS
      }
    } else {
      enemy.hp = newHp
    }
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0)
}

/**
 * #38: 円形範囲ダメージ（共通ヘルパ）。proton は別途線分判定なので使わない。
 * 既存テストとの互換のため hitResults を破壊的に更新する。
 */
export function applyCircularDamage(
  state: GameState,
  result: BombEffect,
  cx: number,
  cy: number,
  range: number,
  damage: number
): void {
  const r2 = range * range
  for (const e of state.enemies) {
    const dx = e.x - cx
    const dy = e.y - cy
    if (dx * dx + dy * dy <= r2) {
      result.hitResults.set(e.id, Math.max(0, e.hp - damage))
    }
  }
}

/**
 * #38: 線分（矩形）ダメージ。proton 専用。
 * (cx, cy) から角度 0（水平、+x 方向）に長さ `length`、幅 `width` の矩形を作り、
 * その内側の敵に damage を与える。簡易のため軸沿いの矩形のみサポート。
 */
function applyLineDamage(
  state: GameState,
  result: BombEffect,
  cx: number,
  cy: number,
  length: number,
  width: number,
  damage: number
): void {
  const halfW = width / 2
  for (const e of state.enemies) {
    const dx = e.x - cx
    const dy = e.y - cy
    // 水平方向ビーム: |dy| <= halfW かつ |dx| <= length
    if (Math.abs(dy) <= halfW && Math.abs(dx) <= length) {
      result.hitResults.set(e.id, Math.max(0, e.hp - damage))
    }
  }
}

// ─── 即時ダメージ系 ──────────────────────────────────────

// proton: 直線（水平方向ビーム）上の全敵に 1 ダメージ
function applyProton(
  state: GameState,
  result: BombEffect,
  cx: number,
  cy: number
): void {
  applyLineDamage(
    state,
    result,
    cx,
    cy,
    PROTON_BEAM_LENGTH,
    PROTON_BEAM_WIDTH,
    PROTON_DAMAGE
  )
}

// sol: プレイヤー周辺 radius=150 の敵に 2 ダメージ
function applySol(
  state: GameState,
  result: BombEffect,
  cx: number,
  cy: number
): void {
  applyCircularDamage(state, result, cx, cy, 150, 2)
}

// muteki: 全敵に 1 ダメージ（無敵砲台想定の簡易実装）
function applyMuteki(state: GameState, result: BombEffect): void {
  for (const e of state.enemies) {
    result.hitResults.set(e.id, Math.max(0, e.hp - 1))
  }
}

// jakuhou: 全敵に 2 ダメージ（巨大爆発）
function applyJakuhou(
  state: GameState,
  result: BombEffect,
  _cx: number,
  _cy: number
): void {
  void _cx
  void _cy
  for (const e of state.enemies) {
    result.hitResults.set(e.id, Math.max(0, e.hp - 2))
  }
}

// dainsleif: 多段ヒット。初段は即時、残り 2 段は state.multiHitBombs で管理
function applyDainsleif(
  state: GameState,
  result: BombEffect,
  cx: number,
  cy: number
): void {
  // 初段は即時適用
  applyCircularDamage(state, result, cx, cy, DAINSLEIF_RANGE, DAINSLEIF_DAMAGE)
  // 残りヒットを multiHitBombs に登録
  const remainingHits = DAINSLEIF_HIT_COUNT - 1
  if (remainingHits > 0) {
    state.multiHitBombs.push({
      id: `dainsleif-${globalThis.crypto.randomUUID()}`,
      x: cx,
      y: cy,
      range: DAINSLEIF_RANGE,
      damage: DAINSLEIF_DAMAGE,
      remainingHits,
      nextHitInMs: DAINSLEIF_HIT_INTERVAL_MS,
      hitIntervalMs: DAINSLEIF_HIT_INTERVAL_MS,
    })
  }
}

// ─── 仕掛け系（state に設置するだけ） ──────────────────────

// muddy: 地雷を 1 個設置する
function applyMuddy(state: GameState, cx: number, cy: number): void {
  state.mines.push({
    id: `mine-${globalThis.crypto.randomUUID()}`,
    x: cx,
    y: cy,
    triggerRange: MINE_TRIGGER_RANGE,
    explosionRange: MINE_EXPLOSION_RANGE,
    damage: MINE_DAMAGE,
  })
}

// sentry: 自動砲台を 1 基設置する
function applySentry(state: GameState, cx: number, cy: number): void {
  state.sentries.push({
    id: `sentry-${globalThis.crypto.randomUUID()}`,
    x: cx,
    y: cy,
    remainingMs: SENTRY_LIFETIME_MS,
    fireCooldownMs: SENTRY_FIRE_INTERVAL_MS,
    range: SENTRY_RANGE,
    damage: SENTRY_DAMAGE,
  })
}

// bunshin: 分身（囮）を 2 つ設置する
function applyBunshin(state: GameState, cx: number, cy: number): void {
  const offsets: Array<{ dx: number; dy: number }> = [
    { dx: -DECOY_DISTANCE, dy: -DECOY_DISTANCE },
    { dx: DECOY_DISTANCE, dy: DECOY_DISTANCE },
  ]
  for (const o of offsets) {
    state.decoys.push({
      id: `decoy-${globalThis.crypto.randomUUID()}`,
      x: cx + o.dx,
      y: cy + o.dy,
      remainingMs: DECOY_LIFETIME_MS,
      lureRange: DECOY_LURE_RANGE,
    })
  }
}
