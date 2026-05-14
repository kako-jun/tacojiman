/**
 * ダメージ計算に関する純粋関数群
 * 攻撃範囲、ダメージ量、当たり判定などの計算
 */

export interface Position {
  readonly x: number
  readonly y: number
}

export interface DamageResult {
  readonly damage: number
  readonly isDestroyed: boolean
  readonly score: number
}

export interface CollisionResult {
  readonly hit: boolean
  readonly distance: number
}

/**
 * 2点間の距離を計算
 */
export function calculateDistance(pos1: Position, pos2: Position): number {
  return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2)
}

/**
 * 円形の当たり判定
 */
export function checkCircularCollision(
  centerPos: Position,
  targetPos: Position,
  radius: number
): CollisionResult {
  const distance = calculateDistance(centerPos, targetPos)
  return {
    hit: distance <= radius,
    distance
  }
}

/**
 * 矩形の当たり判定
 */
export function checkRectangularCollision(
  centerPos: Position,
  targetPos: Position,
  width: number,
  height: number
): CollisionResult {
  const halfWidth = width / 2
  const halfHeight = height / 2
  
  const hit = Math.abs(targetPos.x - centerPos.x) <= halfWidth &&
               Math.abs(targetPos.y - centerPos.y) <= halfHeight
  
  const distance = calculateDistance(centerPos, targetPos)
  
  return { hit, distance }
}

/**
 * 敵のHPとダメージから結果を計算
 */
export function calculateDamageResult(
  currentHP: number,
  damage: number,
  baseScore: number,
  zoomMultiplier: number = 1
): DamageResult {
  const newHP = Math.max(0, currentHP - damage)
  const isDestroyed = newHP <= 0
  
  // 撃破時のみスコア獲得
  const score = isDestroyed ? Math.floor(baseScore * zoomMultiplier) : 0
  
  return {
    damage,
    isDestroyed,
    score
  }
}

/**
 * ボム攻撃の範囲ダメージ計算
 */
export function calculateBombDamage(
  bombPos: Position,
  targetPos: Position,
  bombRadius: number,
  maxDamage: number,
  falloffRate: number = 0.5
): number {
  const collision = checkCircularCollision(bombPos, targetPos, bombRadius)
  
  if (!collision.hit) return 0
  
  // 距離に応じてダメージ減衰
  const damageRatio = 1 - (collision.distance / bombRadius) * falloffRate
  return Math.max(1, Math.floor(maxDamage * damageRatio))
}

/**
 * 多段ヒット攻撃の累積ダメージ計算
 */
export function calculateMultiHitDamage(
  hitCount: number,
  baseDamage: number,
  multiplierPerHit: number = 0.1
): number {
  return Math.floor(baseDamage * (1 + hitCount * multiplierPerHit))
}

/**
 * 攻撃エリア内の複数ターゲット処理
 */
export function findTargetsInArea<T extends Position>(
  attackPos: Position,
  targets: T[],
  radius: number,
  filterFn?: (target: T) => boolean
): T[] {
  return targets.filter(target => {
    // フィルター条件をチェック
    if (filterFn && !filterFn(target)) return false
    
    // 攻撃範囲内かチェック
    const collision = checkCircularCollision(attackPos, target, radius)
    return collision.hit
  })
}