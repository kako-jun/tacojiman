import { describe, expect, it } from 'vitest'
import { computeHomeReachPenalty } from './HomeReachPenalty'

describe('computeHomeReachPenalty (#28 #29)', () => {
  it('ground 敵: score -1 / hp -1', () => {
    const r = computeHomeReachPenalty('ground', 10, 3)
    expect(r.scoreLoss).toBe(1)
    expect(r.hpLoss).toBe(1)
    expect(r.newScore).toBe(9)
    expect(r.newPlayerHp).toBe(2)
    expect(r.gameOver).toBe(false)
  })

  it('water 敵: score -2 / hp -1', () => {
    const r = computeHomeReachPenalty('water', 10, 3)
    expect(r.scoreLoss).toBe(2)
    expect(r.hpLoss).toBe(1)
    expect(r.newScore).toBe(8)
    expect(r.newPlayerHp).toBe(2)
    expect(r.gameOver).toBe(false)
  })

  it('air 敵: score -3 / hp -1', () => {
    const r = computeHomeReachPenalty('air', 10, 3)
    expect(r.scoreLoss).toBe(3)
    expect(r.hpLoss).toBe(1)
    expect(r.newScore).toBe(7)
    expect(r.newPlayerHp).toBe(2)
    expect(r.gameOver).toBe(false)
  })

  it('underground 敵: score -4 / hp -1', () => {
    const r = computeHomeReachPenalty('underground', 10, 3)
    expect(r.scoreLoss).toBe(4)
    expect(r.hpLoss).toBe(1)
    expect(r.newScore).toBe(6)
    expect(r.newPlayerHp).toBe(2)
    expect(r.gameOver).toBe(false)
  })

  it('takokong: score -10 / hp -3、初手到達でも gameOver', () => {
    const r = computeHomeReachPenalty('takokong', 100, 3)
    expect(r.scoreLoss).toBe(10)
    expect(r.hpLoss).toBe(3)
    expect(r.newScore).toBe(90)
    expect(r.newPlayerHp).toBe(0)
    expect(r.gameOver).toBe(true)
  })

  it('HP は 0 未満にならない', () => {
    const r = computeHomeReachPenalty('takokong', 0, 1)
    expect(r.newPlayerHp).toBe(0)
    expect(r.gameOver).toBe(true)
  })

  it('通常敵 3 体到達で gameOver になる', () => {
    let hp = 3
    let score = 100
    for (let i = 0; i < 3; i++) {
      const r = computeHomeReachPenalty('ground', score, hp)
      hp = r.newPlayerHp
      score = r.newScore
      if (i < 2) {
        expect(r.gameOver).toBe(false)
      } else {
        expect(r.gameOver).toBe(true)
      }
    }
    expect(hp).toBe(0)
  })

  it('currentScore < scoreLoss でも score は 0 で止まる', () => {
    const r = computeHomeReachPenalty('takokong', 3, 3)
    expect(r.newScore).toBe(0)
    expect(r.scoreLoss).toBe(10)
  })

  it('score=0 ground 到達でも 0 のまま', () => {
    const r = computeHomeReachPenalty('ground', 0, 3)
    expect(r.newScore).toBe(0)
    expect(r.newPlayerHp).toBe(2)
  })

  it('playerHp=1 で通常敵到達はちょうど gameOver（境界値）', () => {
    const r = computeHomeReachPenalty('ground', 100, 1)
    expect(r.newPlayerHp).toBe(0)
    expect(r.gameOver).toBe(true)
  })
})
