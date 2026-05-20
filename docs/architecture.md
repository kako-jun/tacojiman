# tacojiman Architecture

## PixiJS Architecture

tacojiman runs on PixiJS v8. Migration from the original Phaser implementation
is complete; the legacy tree was removed (see `git show e656fd6:` for history).
The layering follows the same separation used in amanuma:

- `src/types/` defines serializable game state.
- `src/game/` contains PixiJS-independent game logic.
- `src/game/domain/` contains pure domain rules (spawn weights, scoring,
  time conversion, damage math, rotation config) that have no PixiJS imports.
- `src/scenes/` contains PixiJS `Container` based rendering.
- `src/constants/` contains shared display constants.

## GameState Contract

`GameState` must stay a plain object. It should not contain PixiJS display
objects, DOM nodes, timers, functions, or class instances. Scene code receives a
state snapshot and renders from that state.

`GameScene.initWithState(state)` is the entry point for starting from an
arbitrary game situation. Future features such as enemies, camera, bomb jutsu,
UI, and ending transitions should preserve this contract so tests and debug
screens can recreate any state directly.

## Current Scope

The PixiJS port now covers the full gameplay loop:

- App bootstrapping with `PIXI.Application`.
- Title / game / ending scene flow with high score & progress level persistence.
- Serializable initial state generation and `initWithState` entry point.
- Map / enemy / clock / score / minimap / HP / bomb selection rendering.
- Pointer input (short tap / long press zoom / repeat-tap attack / house tap bomb).
- Enemy spawn rules, A* routing for ground / water, takokong (boss) flow.
- 8 bomb jutsu effects and trap-style bombs (mines / sentries / decoys / multi-hit).
- Map rotation, screenshots, pause phase, sound (Howler.js).
- 262 tests across 15 files covering domain rules, scene helpers, and storage.

## Enemy Spawn System (#31)

Enemy spawning is driven by `spawnEnemies(state, deltaMS, randomSource?)` in
`src/game/EnemyManager.ts`. The function is pure aside from mutating the
following `GameState` fields (kept on `GameState` so save/restore works):

- `spawnTimer` — accumulated milliseconds since game start (for interval crossings).
- `initialEnemiesSpawned` / `initialEnemiesRemaining` / `initialEnemiesNextDelayMs` —
  the legacy 3-ground intro: one ground enemy per frame, 200 ms apart.
- `spawnIntervalMs` / `spawnRateUpgradeAccumMs` — base interval starts at 500 ms,
  decays by 0.8 every 15 s, floored at 200 ms.
- `maxEnemies` / `maxEnemiesUpgradeAccumMs` — starts at 40, grows by 5 every 15 s,
  capped at 70. `takokong` is excluded from this cap.
- `takokongSpawned` — boss flag, set once `elapsedMs + deltaMS >= 170_000`.

`randomSource` defaults to `Math.random` and is threaded into every per-type
spawn helper for test determinism.

## Takokong Boss State (#37)

The boss fight is governed by `TakokongState` on `GameState`. Spawn is forced
once `elapsedMs >= 170_000` and the state captures `hp` (42) / `maxHp`,
`barrierActive`, `barrierExpiresAt`, and `active`. While `active`, the camera
is locked to `scale = 1` and zoom input is ignored, the HP bar is drawn in the
upper UI, and a 10 s countdown text appears at center. Barrier ticking lives in
the pure helper `tickTakokongBarrier`, and a separate `tickTakokongCountdown`
exposes remaining seconds independent of whether the boss is alive yet. Once
the takokong is removed (defeat or reaching the house) the scene resets zoom,
stops the boss BGM, and clears the boss UI.

## Trap-Style Bombs (#38)

In addition to the 8 instant bomb jutsu effects, four bomb types persist on the
field as `GameState` arrays:

- `mines` — Muddy lays a triggered explosion. `triggerMineIfHit` decides if any
  enemy entered the trigger radius; on hit, `applyCircularDamage` resolves
  range damage and the mine is removed.
- `sentries` — A stationary turret that picks the nearest enemy in range via
  `pickSentryTarget` and fires every `fireCooldownMs`, decaying `remainingMs`
  to expire after its lifetime.
- `decoys` — Bunshin spawns lures; `pickDecoyTarget` flags enemies inside
  `lureRange`, and `advanceEnemies` overrides the route so the enemy walks
  toward the decoy instead of the house.
- `multiHitBombs` — Dainsleif chains multiple AoE hits via `tickMultiHitBomb`,
  which both fires the current pulse and produces the next pending state.

All four are advanced once per frame in `GameScene.tickBombEntities`.

## Storage Layer (#39)

`src/game/storage.ts` persists three keys on `localStorage`: `tacojiman_progress`
(progress level 0–10 and total plays), `tacojiman_high_score`, and
`tacojiman_player_name`. JSON parse failures are demoted to `console.warn` and
the default value is returned. Missing `localStorage` (SSR / non-jsdom test
env) is treated as read-default / write-noop. `computeProgressBackground`
linearly interpolates the title scene background from night to dawn based on
the progress level.

`src/game/RankingClient.ts` sends scores to Nostalgic Ranking via plain GET
requests. Network failures, 404s, and timeouts are intentionally swallowed
(return `null` / `false`) so gameplay is never blocked. The endpoint is taken
from `VITE_NOSTALGIC_RANKING_ID`; when unset, submission is skipped.

## Screenshot Manager (#42)

`src/game/ScreenshotManager.ts` is a pure module of three helpers
(`shouldTakeScreenshot`, `computeNextScreenshotAt`, `isScreenshotLimitReached`)
plus the constants `SCREENSHOT_INTERVAL_MS = 60_000` and `SCREENSHOT_MAX_COUNT
= 3`. The actual canvas capture is injected by `main.ts` via
`GameScene.setCaptureCallback`, which keeps the scene free of direct
`PIXI.Application` references and lets the module remain trivially testable.

## Domain Layer (#43)

`src/game/domain/` extracts pure rules out of scenes and managers:

- `GameRules.ts` — spawn weights, interval / max-enemy decay constants, and
  `createRotationConfig` (random direction + 2–3 min/rotation speed for #41).
- `DamageCalculator.ts` / `ScoreCalculator.ts` — bomb damage and per-defeat
  score lookups.
- `TimeManager.ts` — `elapsedMs` → in-game clock conversion.
- `HomeReachPenalty.ts` (#28 / #29) — when an enemy reaches `player_house`,
  computes `scoreLoss` (ground=1 / water=2 / air=3 / underground=4 /
  takokong=10), `hpLoss` (takokong=3, others=1), and a `gameOver` flag
  (`newPlayerHp <= 0`). `score` and `playerHp` are both clamped at 0.
  `GameScene.onEnemyReachedHome` consumes this result, mutates
  `state.score` / `state.playerHp`, and forces `phase = 'ending'` +
  `onEnding(...)` when `gameOver` is true (one-shot guarded by the
  existing `phase !== 'ending'` check).

These modules import nothing from PixiJS and are covered by dedicated tests.

## Map Intro Animation (#53 #57)

`drawMap` in `src/scenes/GameScene.ts` paints the map in two stacked layers
inside `mapLayer`:

- **`mapGraphics`** — a single Graphics holding only the background fill,
  drawn as a **circle** (`circle(0, 0, MAP_RADIUS_PX)`) rather than a rect
  (#57). The earlier "rect sized to cover the view diagonal" approach was
  rolled back: padding-only background expansion created a visual region
  with no underlying tile data, forcing spawn / walkability logic to
  special-case the padded area. The circular approach keeps the data and
  view consistent: tiles exist or don't.
- **`tilesContainer`** + **`tileGraphicsList: Graphics[]`** — one Graphics per
  map panel (#53). Each tile draws in its own local coordinate system (origin
  at tile center), with `g.x` / `g.y` placed at the tile's world-center
  (relative to `mapLayer`). This lets `scale` animate around the tile center
  without needing pivot manipulation. Tiles whose center lies outside
  `MAP_RADIUS_PX` are skipped in the draw loop (`cx² + cy² > r²`), giving
  the map a stepped circular silhouette against the black backdrop.

### Circular map geometry (#57)

The view is 400×600 px, so the half-diagonal is `sqrt(200² + 300²) ≈ 360.6`
px. Any rotation of `mapLayer` exposes up to that much radius at the four
corners. To keep the background painted over the whole view at every
rotation, the map needs a radius of at least ≈ 361 px.

The chosen geometry:

| constant         | value | derivation                              |
| ---------------- | ----- | --------------------------------------- |
| `MAP_COLS`       | 27    | wraps the inner 19×25 playable area     |
| `MAP_ROWS`       | 27    | square map so radius is consistent      |
| `TILE_SIZE`      | 28 px | unchanged                               |
| `MAP_RADIUS_TILES` | 13.5 | half of `MAP_COLS` / `MAP_ROWS`         |
| `MAP_RADIUS_PX`  | 378   | `13.5 × 28`; comfortably covers 360.6 px |

`createInitialGameState` now calls `generateMap(27, 27)` and sets
`player.panelX = player.panelY = 13` (= `floor(MAP_COLS / 2)`). The center
`(13, 13)` is the `player_house` tile and, in `mapLayer` local coords, sits
exactly at `(0, 0)` because `drawMap` subtracts `width/2, height/2`.

### Playable area layout (#57)

`getPanelType` was rewritten so that `path` / `rail` / `station` /
`player_house` **and** `other_house` / `water` / `river` are all expressed
relative to `centerX` / `centerY` rather than to the absolute `cols` /
`rows` borders. With this change, calling `generateMap(19, 25)` produces
exactly the same playable layout as before (so existing direct-call tests
still pass), and calling `generateMap(27, 27)` produces the same layout
re-centered inside the larger array with a ring of `rice_field` around it.
That outer ring is partially drawn (the parts inside the circle) and
partially hidden (the parts beyond `MAP_RADIUS_PX`).

### Enemy spawn / path implications (#57)

- **ground** — `findPathEdgePosition` only considers `path` tiles. New
  outer ring is `rice_field`, so spawn candidates stay on the same `path`
  network as before. Edge spawn for the canonical map is `(0, centerY)`
  (= `(0, 13)` in 27×27), which is well inside the circle.
- **water** — `findWaterGoalPanel` and water-network discovery only walk
  `water` / `river` tiles. Both types live entirely inside the inner
  playable area, so the outer ring is irrelevant.
- **underground** — spawn is constrained to `UNDERGROUND_HOUSE_RADIUS = 3`
  tiles around the player house. That always lies inside the circle, so
  off-screen spawns are not possible from this path.
- **air** — samples a uniform angle in `[0, 2π)` and places the enemy at
  `(cos θ, sin θ) * (MAP_RADIUS_PX + AIR_SPAWN_MARGIN)`, i.e. just outside
  the circular map edge. The enemy then flies in a straight line toward
  `(0, 0)` (existing `advanceEnemies` path). This matches the circular
  silhouette so air enemies appear to break in from the edge of the
  visible map rather than materializing in a corner of the underlying
  rectangular grid.

`playMapIntroAnimation()` runs once per `GameScene` instance, gated by an
`introPlayed: boolean` flag (re-`init` calls during the same scene do not
replay the intro to avoid flicker). For each tile it computes the radial
distance from the home (`0,0`):

```
d = sqrt(g.x^2 + g.y^2)
delay = (d / TILE_SIZE) * 0.05  // 50 ms per tile of distance
```

Then `gsap.to` tweens `scale 0→1` (`back.out(2)`) and `alpha 0→1`
(`power2.out`) with `duration: 0.4`. Tiles closer to the home pop in first;
the wavefront expands outward.

Rotation is **not** paused during the intro — the dramatic effect of tiles
materializing while the map already spins is intentional. `tilesContainer` is
a child of `mapLayer`, so each tile's `scale` is local and unaffected by the
rotation transform of the parent.

## Tap Feedback Effects (post-#46)

`src/scenes/EffectManager.ts` is a child container of `mapLayer` (so its
contents inherit map rotation and translation), with three visual feedback
families layered on top of the rendering loop:

- `showAttackRange(x, y, radius)` — translucent red disc + stroke that pops
  from 0.6× to 1.0× in 0.18 s and fades over 0.45 s. Called from
  `GameScene.attackAt` on every short tap with `ATTACK_RANGE` (the same fixed
  mapLayer-local distance used by `checkAttackHit`; zoom does **not** widen
  the hit area per CLAUDE.md, so the ring matches the actual hit circle).
  Graphics are symmetric, so they ride with the map rotation and stay pinned
  to the world tap point — this is correct behavior since enemies also ride
  the map.
- `showEnemyBurst(x, y, isTakokong?)` — central flash + expanding ring + 8
  radial particles per defeat. Takokong defeats render with 1.8× scale, 14
  particles, and pink palette to distinguish boss kills. Same symmetric-on-
  rotation rationale as the attack ring.
- Floating texts (`showScoreGain`, `showMiss`, `showMultiHit`,
  `showScoreLoss`, `showPerfectPierce`) are placed inside a per-label
  `Container` wrapper. The wrapper position lives in mapLayer-local coords
  (so it sticks to the world target), but each frame
  `effectManager.update(mapLayer.rotation)` sets
  `wrapper.rotation = -parentRotation`. Because the rise tween (`y -= riseBy`)
  runs in the wrapper's local frame, both the text orientation AND the
  rise direction stay aligned with screen-up regardless of map rotation.
  The `MULTI HIT` aggregate label uses `x{count}` (ASCII) instead of `× {count}`
  to avoid text-renderer fallback splits, with `wordWrap: false` enforced.

`AttackHitResult` now carries `defeatedDetails: DefeatedEnemyDetail[]` (id /
x / y / type / score, score includes the zoom multiplier and any takokong
bonus). `GameScene.attackAt` iterates these and emits `score-gain` plus
`showEnemyBurst` per defeated enemy at the enemy position (rather than once
at the tap position). The aggregate `MULTI HIT` label is placed at the
centroid of the defeated enemies, offset by `-24` in mapLayer-local y (the
wrapper re-orients it to true screen-up).

Bomb / mine / sentry / multi-hit-bomb score-gain emits still fire once at
the explosion epicenter rather than per defeated enemy — those effects
already have loud area visuals, and `applyBombDamage` does not currently
surface per-enemy positions. Aligning them is a follow-up if needed.

`LONG_PRESS_THRESHOLD_MS` was reduced from 300 → 180 ms in
`src/game/PointerInput.ts` so zoom engages faster on touch while staying
above the typical short-tap duration to avoid false long-press triggers.

## Pause Phase (#45)

`GameState.phase` is extended with `'paused'`. `togglePausePhase` flips between
`'playing'` and `'paused'`, and the `KeyboardManager` exposes
`consumePauseToggle()` so `GameScene.update` reacts to a single SPACE press
per tick. While paused the scene early-returns from gameplay updates and shows
the central "PAUSE" overlay text.
