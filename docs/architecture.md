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

These modules import nothing from PixiJS and are covered by dedicated tests.

## Pause Phase (#45)

`GameState.phase` is extended with `'paused'`. `togglePausePhase` flips between
`'playing'` and `'paused'`, and the `KeyboardManager` exposes
`consumePauseToggle()` so `GameScene.update` reacts to a single SPACE press
per tick. While paused the scene early-returns from gameplay updates and shows
the central "PAUSE" overlay text.
