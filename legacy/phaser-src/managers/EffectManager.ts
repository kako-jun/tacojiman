/**
 * エフェクト表示を一元管理するクラス
 * Phaserのシーンに依存するが、エフェクトロジックは分離
 */

import Phaser from 'phaser'
import { getZoomScoreColor, getZoomScoreFontSize, getDamageDisplayStyle } from '@/utils/domain/ScoreCalculator'
import { GAME_CONFIG } from '@/utils/GameConfig'

export interface EffectDisplayOptions {
  fontSize?: string
  color?: string
  duration?: number
  moveDistance?: number
  scale?: number
  alpha?: number
}

export class EffectManager {
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * スコア獲得エフェクトを表示
   */
  showScoreGain(
    x: number,
    y: number,
    baseScore: number,
    zoomMultiplier: number
  ): void {
    const config = GAME_CONFIG.EFFECTS.SCORE_DISPLAY
    const scoreText = `${baseScore} × ${zoomMultiplier.toFixed(1)}`
    const color = getZoomScoreColor(zoomMultiplier)
    const fontSize = getZoomScoreFontSize(zoomMultiplier)
    
    const scoreDisplay = this.scene.add.text(x, y + config.OFFSET_Y, scoreText, {
      fontSize: fontSize,
      color: color,
      fontFamily: GAME_CONFIG.UI.FONT_SETTINGS.FAMILY,
      fontStyle: 'bold',
      stroke: GAME_CONFIG.UI.FONT_SETTINGS.STROKE_COLOR,
      strokeThickness: GAME_CONFIG.UI.FONT_SETTINGS.SCORE_STROKE_THICKNESS,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: '#000000',
        blur: 2,
        fill: true
      }
    }).setOrigin(0.5)
    
    // 枠を追加
    const frame = this.createTextFrame(scoreDisplay, color, config.PADDING)
    
    // 画面中心方向への移動ベクトルを計算
    const { width, height } = this.scene.scale
    const screenCenterX = width / 2
    const screenCenterY = height / 2
    
    // 現在位置から画面中心への方向ベクトル
    const directionX = screenCenterX - x
    const directionY = screenCenterY - y
    const distance = Math.sqrt(directionX * directionX + directionY * directionY)
    
    // 正規化して移動距離分のベクトルを計算
    const moveDistance = Math.abs(config.MOVE_DISTANCE)
    const normalizedX = distance > 0 ? (directionX / distance) * moveDistance : 0
    const normalizedY = distance > 0 ? (directionY / distance) * moveDistance : config.MOVE_DISTANCE // フォールバック
    
    // アニメーション（画面中心方向に移動）
    this.scene.tweens.add({
      targets: [scoreDisplay, frame],
      x: x + normalizedX,
      y: y + normalizedY,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0,
      duration: GAME_CONFIG.UI.EFFECT_DURATIONS.SCORE_GAIN,
      ease: 'Power2',
      onComplete: () => {
        scoreDisplay.destroy()
        frame.destroy()
      }
    })
  }

  /**
   * スコア減少エフェクトを表示
   */
  showScoreLoss(x: number, y: number, damage: number): void {
    const config = GAME_CONFIG.EFFECTS.DAMAGE_DISPLAY
    const scoreText = `-${damage}`
    const style = getDamageDisplayStyle(damage)
    
    const scoreDisplay = this.scene.add.text(x, y + config.OFFSET_Y, scoreText, {
      fontSize: style.fontSize,
      color: style.color,
      fontFamily: GAME_CONFIG.UI.FONT_SETTINGS.FAMILY,
      fontStyle: 'bold',
      stroke: GAME_CONFIG.UI.FONT_SETTINGS.STROKE_COLOR,
      strokeThickness: GAME_CONFIG.UI.FONT_SETTINGS.SCORE_STROKE_THICKNESS,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: '#000000',
        blur: 2,
        fill: true
      }
    }).setOrigin(0.5)
    
    // 枠を追加
    const frame = this.createTextFrame(scoreDisplay, style.color, config.PADDING)
    
    // 下方向アニメーション
    this.scene.tweens.add({
      targets: [scoreDisplay, frame],
      y: y + config.MOVE_DISTANCE,
      scaleX: 1.1,
      scaleY: 1.1,
      alpha: 0,
      duration: GAME_CONFIG.UI.EFFECT_DURATIONS.SCORE_LOSS,
      ease: 'Power2',
      onComplete: () => {
        scoreDisplay.destroy()
        frame.destroy()
      }
    })
  }

  /**
   * 攻撃エフェクトを表示
   */
  showAttackEffect(x: number, y: number, hit: boolean, radius: number = 40): void {
    const config = GAME_CONFIG.EFFECTS.ATTACK_EFFECT
    const color = hit ? config.HIT_COLOR : config.MISS_COLOR
    const effect = this.scene.add.circle(x, y, radius, color, config.ALPHA)
    
    this.scene.tweens.add({
      targets: effect,
      alpha: 0,
      duration: GAME_CONFIG.UI.EFFECT_DURATIONS.ATTACK_EFFECT,
      onComplete: () => effect.destroy()
    })
  }

  /**
   * 多段ヒットエフェクトを表示
   */
  showMultiHitEffect(x: number, y: number, step: number): void {
    // ヒット回数に応じたエフェクトの変化
    const color = step <= 3 ? 0xffffff : (step <= 6 ? 0xffff00 : 0xff0000)
    const hitEffect = this.scene.add.circle(x, y, 12, color, 0.9)
    
    this.scene.tweens.add({
      targets: hitEffect,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: GAME_CONFIG.UI.EFFECT_DURATIONS.MULTI_HIT,
      onComplete: () => hitEffect.destroy()
    })
    
    // ヒット数表示
    const hitText = this.scene.add.text(x, y - 20, `${step}HIT!`, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: GAME_CONFIG.UI.FONT_SETTINGS.FAMILY,
      stroke: GAME_CONFIG.UI.FONT_SETTINGS.STROKE_COLOR,
      strokeThickness: 1
    }).setOrigin(0.5)
    
    this.scene.tweens.add({
      targets: hitText,
      y: y - 40,
      alpha: 0,
      duration: 400,
      onComplete: () => hitText.destroy()
    })
  }

  /**
   * 連続ヒットエフェクトを表示
   */
  showContinuousHitEffect(x: number, y: number): void {
    const continuousEffect = this.scene.add.circle(x, y, 8, 0x8800ff, 0.7)
    
    this.scene.tweens.add({
      targets: continuousEffect,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 0,
      duration: GAME_CONFIG.UI.EFFECT_DURATIONS.CONTINUOUS_HIT,
      onComplete: () => continuousEffect.destroy()
    })
  }

  /**
   * 家の被ダメージ点滅エフェクト
   */
  showHouseDamageEffect(houseObject: Phaser.GameObjects.GameObject): void {
    this.scene.tweens.add({
      targets: houseObject,
      alpha: 0.5,
      duration: GAME_CONFIG.UI.EFFECT_DURATIONS.HOUSE_DAMAGE_BLINK,
      yoyo: true,
      repeat: 2
    })
  }

  /**
   * ボム爆発エフェクトを表示
   */
  showBombExplosion(x: number, y: number, radius: number): void {
    const effect = this.scene.add.circle(x, y, radius, 0xff4444, 0.6)
    
    this.scene.tweens.add({
      targets: effect,
      alpha: 0,
      duration: GAME_CONFIG.UI.EFFECT_DURATIONS.BOMB_EFFECT,
      onComplete: () => effect.destroy()
    })
  }

  /**
   * MISS表示エフェクト
   */
  showMissedEffect(): void {
    const { width, height } = this.scene.scale
    
    const missText = this.scene.add.text(width / 2, height / 2, 'MISS!', {
      fontSize: '48px',
      color: '#ff0000',
      fontFamily: GAME_CONFIG.UI.FONT_SETTINGS.FAMILY,
      stroke: GAME_CONFIG.UI.FONT_SETTINGS.STROKE_COLOR,
      strokeThickness: 4
    }).setOrigin(0.5)
    
    const wasteText = this.scene.add.text(width / 2, height / 2 + 60, '完全に無駄!', {
      fontSize: '24px',
      color: '#ff4444',
      fontFamily: GAME_CONFIG.UI.FONT_SETTINGS.FAMILY,
      stroke: GAME_CONFIG.UI.FONT_SETTINGS.STROKE_COLOR,
      strokeThickness: 2
    }).setOrigin(0.5)
    
    this.scene.tweens.add({
      targets: [missText, wasteText],
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => {
        missText.destroy()
        wasteText.destroy()
      }
    })
  }

  /**
   * 多段ヒットボーナス表示
   */
  showMultiHitBonus(hitCount: number): void {
    const { width, height } = this.scene.scale
    
    let bonusText = ''
    let bonusColor = '#ffffff'
    
    if (hitCount >= 10) {
      bonusText = 'PERFECT PIERCE!'
      bonusColor = '#ff0000'
    } else if (hitCount >= 5) {
      bonusText = 'MULTI HIT!'
      bonusColor = '#ffff00'
    } else {
      bonusText = `${hitCount} HIT`
      bonusColor = '#ffffff'
    }
    
    const bonusDisplay = this.scene.add.text(width / 2, height / 2 - 50, bonusText, {
      fontSize: '32px',
      color: bonusColor,
      fontFamily: GAME_CONFIG.UI.FONT_SETTINGS.FAMILY,
      stroke: GAME_CONFIG.UI.FONT_SETTINGS.STROKE_COLOR,
      strokeThickness: 3
    }).setOrigin(0.5)
    
    this.scene.tweens.add({
      targets: bonusDisplay,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => bonusDisplay.destroy()
    })
  }

  /**
   * テキスト用の枠を作成
   */
  private createTextFrame(
    textObject: Phaser.GameObjects.Text,
    color: string,
    padding: number = 8
  ): Phaser.GameObjects.Rectangle {
    const bounds = textObject.getBounds()
    const frame = this.scene.add.rectangle(
      bounds.centerX,
      bounds.centerY,
      bounds.width + padding * 2,
      bounds.height + padding * 2,
      0x000000,
      GAME_CONFIG.EFFECTS.SCORE_DISPLAY.FRAME_ALPHA
    )
    frame.setStrokeStyle(3, parseInt(color.replace('#', '0x')))
    frame.setDepth(textObject.depth - 1)
    
    return frame
  }

  /**
   * シンプルなテキストエフェクト（カスタマイズ可能）
   */
  showCustomTextEffect(
    x: number,
    y: number,
    text: string,
    options: EffectDisplayOptions = {}
  ): void {
    const textObject = this.scene.add.text(x, y, text, {
      fontSize: options.fontSize || '24px',
      color: options.color || '#ffffff',
      fontFamily: GAME_CONFIG.UI.FONT_SETTINGS.FAMILY,
      stroke: GAME_CONFIG.UI.FONT_SETTINGS.STROKE_COLOR,
      strokeThickness: GAME_CONFIG.UI.FONT_SETTINGS.DEFAULT_STROKE_THICKNESS
    }).setOrigin(0.5)
    
    this.scene.tweens.add({
      targets: textObject,
      y: y + (options.moveDistance || -60),
      scaleX: options.scale || 1.2,
      scaleY: options.scale || 1.2,
      alpha: options.alpha || 0,
      duration: options.duration || 1000,
      ease: 'Power2',
      onComplete: () => textObject.destroy()
    })
  }
}