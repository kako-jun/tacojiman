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
