import type { BombType, GameState } from '../types/GameState'

export interface BombEffect {
  type: BombType
  // ダメージを受けた敵のIDと新HPのマップ
  hitResults: Map<string, number>
}

// 各ボムの当たり判定を計算し、state.enemies の HP 更新と除去を行う
// BombEffect（hitResults）を返す。エフェクト描画は GameScene 側で行う

export function applyBombDamage(state: GameState, type: BombType): BombEffect {
  const result: BombEffect = { type, hitResults: new Map() }
  // 各ボムのダメージ範囲でヒット判定
  switch (type) {
    case 'proton':
      applyProtonDamage(state, result)
      break
    case 'sol':
      applySolDamage(state, result)
      break
    case 'muteki':
      applyMutekiDamage(state, result)
      break
    case 'dainsleif':
      applyDainsleifDamage(state, result)
      break
    case 'jakuhou':
      applyJakuhouDamage(state, result)
      break
    // muddy/sentry/bunshin は GameScene 側でタイミング管理するため空
    default:
      break
  }
  // hitResults に基づいて state.enemies の HP を更新
  for (const enemy of state.enemies) {
    const newHp = result.hitResults.get(enemy.id)
    if (newHp !== undefined) {
      enemy.hp = newHp
    }
  }
  // HP <= 0 の敵を除去
  state.enemies = state.enemies.filter((e) => e.hp > 0)
  return result
}

// proton: 画面全体の敵に1ダメージ
function applyProtonDamage(state: GameState, result: BombEffect) {
  for (const e of state.enemies) {
    result.hitResults.set(e.id, Math.max(0, e.hp - 1))
  }
}

// sol: プレイヤーの家周辺 radius=150 の敵に2ダメージ
function applySolDamage(state: GameState, result: BombEffect) {
  const radius = 150
  for (const e of state.enemies) {
    const dist = Math.sqrt(e.x * e.x + e.y * e.y) // mapLayer 中心からの距離
    if (dist <= radius) {
      result.hitResults.set(e.id, Math.max(0, e.hp - 2))
    }
  }
}

// muteki: ランダム位置5箇所に爆発・各 radius=60 で1ダメージ（ロジック上は全体1ダメージ扱い）
function applyMutekiDamage(state: GameState, result: BombEffect) {
  for (const e of state.enemies) {
    result.hitResults.set(e.id, Math.max(0, e.hp - 1))
  }
}

// dainsleif: 直線（ビーム）上の敵に1ダメージ（簡易: 全体1ダメージ）
function applyDainsleifDamage(state: GameState, result: BombEffect) {
  for (const e of state.enemies) {
    result.hitResults.set(e.id, Math.max(0, e.hp - 1))
  }
}

// jakuhou: 特定座標 radius=80 の爆発（簡易: 全体2ダメージ）
function applyJakuhouDamage(state: GameState, result: BombEffect) {
  for (const e of state.enemies) {
    result.hitResults.set(e.id, Math.max(0, e.hp - 2))
  }
}
