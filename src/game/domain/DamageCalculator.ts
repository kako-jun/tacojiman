/**
 * #43: ダメージ計算に関する純粋関数群（PixiJS / GameState に依存しない）
 * 距離計算、当たり判定、距離減衰ダメージなど。
 */

export interface Position {
  readonly x: number
  readonly y: number
}

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** 2 点間のユークリッド距離 */
export function calculateDistance(a: Position, b: Position): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 円形当たり判定。center から target までの距離が radius 以下なら true。
 * 境界 (== radius) は hit とみなす。
 */
export function checkCircularCollision(
  center: Position,
  target: Position,
  radius: number
): boolean {
  const dx = target.x - center.x
  const dy = target.y - center.y
  return dx * dx + dy * dy <= radius * radius
}

/**
 * 矩形当たり判定。AABB 包含。
 * rect は左上座標 (x, y) と幅・高 (w, h)。target が rect 内なら true。
 */
export function checkRectangularCollision(
  rect: Rect,
  target: Position
): boolean {
  return (
    target.x >= rect.x &&
    target.x <= rect.x + rect.w &&
    target.y >= rect.y &&
    target.y <= rect.y + rect.h
  )
}

/**
 * ボム距離減衰ダメージ。
 * - 距離が range を超えていれば 0
 * - range 内なら baseDamage * (1 - distance / range) を切り上げ
 * - 範囲内なら最低 1
 */
export function calculateBombDamage(
  baseDamage: number,
  distance: number,
  range: number
): number {
  if (range <= 0) return 0
  if (distance > range) return 0
  const ratio = 1 - distance / range
  const damage = Math.ceil(baseDamage * ratio)
  return Math.max(1, damage)
}
