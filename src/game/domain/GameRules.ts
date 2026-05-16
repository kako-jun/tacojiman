/**
 * #43: ゲームスポーンルール・難易度上昇定数の純粋モジュール（PixiJS 非依存）。
 * 既存 EnemyManager 内の定数を切り出してテスト容易性を上げる。
 */

import type { EnemyType } from '../../types/GameState'

/** 敵タイプ → 出現重み（合計 1.0、takokong は対象外）。 */
export const ENEMY_SPAWN_WEIGHTS: Record<Exclude<EnemyType, 'takokong'>, number> = {
  ground: 0.5,
  water: 0.25,
  air: 0.15,
  underground: 0.1,
}

/** スポーン間隔を再評価する周期（ms） */
export const SPAWN_RATE_UPGRADE_INTERVAL_MS = 15_000
/** スポーン間隔の減衰係数（小さくなる方向）。 */
export const SPAWN_RATE_DECAY = 0.8
/** スポーン間隔の下限（ms） */
export const SPAWN_INTERVAL_MIN_MS = 200

/** 最大敵数を再評価する周期（ms） */
export const MAX_ENEMIES_UPGRADE_INTERVAL_MS = 15_000
/** 1 段階あたりの最大敵数増加分 */
export const MAX_ENEMIES_INCREMENT = 5
/** 最大敵数の上限 */
export const MAX_ENEMIES_CAP = 70

/** 初期 3 体の地上タコのスポーン間隔（ms） */
export const INITIAL_GROUND_SPAWN_INTERVAL_MS = 200
