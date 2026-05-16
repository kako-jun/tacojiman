# tacojiman Architecture

## PixiJS Migration Baseline

tacojiman is being migrated from Phaser to PixiJS. The current baseline follows
the same separation used in amanuma:

- `src/types/` defines serializable game state.
- `src/game/` contains PixiJS-independent game logic.
- `src/scenes/` contains PixiJS `Container` based rendering.
- `src/constants/` contains shared display constants.
- `legacy/phaser-src/` keeps the previous Phaser implementation for migration
  reference only.

## GameState Contract

`GameState` must stay a plain object. It should not contain PixiJS display
objects, DOM nodes, timers, functions, or class instances. Scene code receives a
state snapshot and renders from that state.

`GameScene.initWithState(state)` is the entry point for starting from an
arbitrary game situation. Future features such as enemies, camera, bomb jutsu,
UI, and ending transitions should preserve this contract so tests and debug
screens can recreate any state directly.

## Current Scope

The current PixiJS baseline covers:

- App bootstrapping with `PIXI.Application`.
- Title and game scene switching.
- Serializable initial state generation.
- Placeholder map, enemy, clock, and score rendering.
- Minimal tests for map generation and `GameState` serialization.

The migrated Phaser code has not been deleted outright; it is retained in
`legacy/phaser-src/` until each gameplay feature is ported and checked.

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
