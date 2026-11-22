import { describe, expect, it } from 'vitest'
import {
  envelopeAt, farFieldRatio, intensityAt, isMissingOrder, localMaxima, positionFromSin,
  samplePattern, sinFromPosition, theory,
} from './optics'
import { automaticHalfWidth, defaults, greenGrating, toModel } from './settings'

const reference = { ...defaults, wavelengthNm: 600, widthUm: 20, pitchUm: 60, distanceM: 2 }
const degree = (sin: number) => Math.asin(sin) * 180 / Math.PI

describe('Fraunhofer 物理模型', () => {
  it('以 SI 單位和完整幾何關係互換屏幕位置與 sin θ', () => {
    expect(sinFromPosition(3, 4)).toBe(0.6)
    expect(positionFromSin(-0.6, 4)).toBeCloseTo(-3, 14)
    expect(positionFromSin(1, 4)).toBeNull()
    expect(positionFromSin(-1.01, 4)).toBeNull()
    const { optics } = toModel('grating', greenGrating)
    expect(optics.wavelength).toBeCloseTo(532e-9, 15)
    expect(optics.slitPitch).toBeCloseTo(1 / 600_000, 15)
  })

  it('三種模式的中央強度為一，強度分布左右對稱', () => {
    for (const mode of ['single', 'double', 'grating'] as const) {
      const { optics } = toModel(mode, reference)
      expect(intensityAt(optics, 0)).toBe(1)
      expect(intensityAt(optics, -0.034)).toBeCloseTo(intensityAt(optics, 0.034), 14)
    }
  })

  it('單縫暗紋遵循 a sin θ = pλ', () => {
    const { optics, widthToPitch } = toModel('single', reference)
    const points = theory(optics, widthToPitch, 0.04)
    expect(points.map(({ order }) => order)).toEqual([-1, 1])
    expect(points[1].u).toBeCloseTo(0.03, 14)
    expect(intensityAt(optics, points[1].u)).toBeLessThan(1e-28)
  })

  it('以 N=2 的統一公式計算雙縫，保留理論級次的可去奇點', () => {
    const { optics } = toModel('double', reference)
    for (const u of [0, 0.004, 0.01, 0.010000000000001, 0.055, 0.203, -0.137]) {
      const phase = Math.PI * optics.slitPitch * u / optics.wavelength
      expect(intensityAt(optics, u)).toBeCloseTo(envelopeAt(optics, u) * Math.cos(phase) ** 2, 14)
    }
    const grating = { ...optics, slitCount: 24 }
    expect(intensityAt(grating, 0.01)).toBeCloseTo(envelopeAt(grating, 0.01), 14)
  })

  it('重算參考案例的屏幕位置與相對強度，標出正負缺級', () => {
    const { optics, widthToPitch } = toModel('grating', reference)
    const points = theory(optics, widthToPitch, 0.07)
    const first = points.find(({ order }) => order === 1)!
    const third = points.find(({ order }) => order === 3)!
    expect(first.x).toBeCloseTo(0.020001000075, 10)
    expect(first.intensity).toBeCloseTo(27 / (4 * Math.PI ** 2), 13)
    expect(third.x).toBeCloseTo(0.060027018239, 10)
    expect(third.intensity).toBe(0)
    expect(points.filter(({ missing }) => missing).map(({ order }) => order)).toEqual([-6, -3, 3, 6])
    expect(farFieldRatio(optics)).toBeCloseTo(0.0563333333, 10)
  })

  it('使用精確比例判定缺級，近平行重合仍為有級次', () => {
    const close = toModel('double', { ...reference, widthUm: 20.0000001 })
    expect(isMissingOrder(3, close.widthToPitch)).toBe(false)
    expect(theory(close.optics, close.widthToPitch, 0.04).find(({ order }) => order === 3)!.intensity).toBeGreaterThan(0)

    const decimal = toModel('grating', { ...reference, widthUm: 0.3, pitchUm: 0.9 })
    expect(isMissingOrder(3, decimal.widthToPitch)).toBe(true)
    expect(isMissingOrder(0, decimal.widthToPitch)).toBe(false)
  })

  it('用 532 nm 及 600 lines/mm 計算前三級，第四級超出傳播範圍', () => {
    const { optics, widthToPitch } = toModel('grating', greenGrating)
    const points = theory(optics, widthToPitch)
    const nonnegative = points.filter(({ order }) => order >= 0)
    expect(nonnegative.map(({ order }) => order)).toEqual([0, 1, 2, 3])
    expect(degree(nonnegative[1].u)).toBeCloseTo(18.61455118, 7)
    expect(degree(nonnegative[2].u)).toBeCloseTo(39.67261473, 7)
    expect(degree(nonnegative[3].u)).toBeCloseTo(73.25569465, 7)
    expect(4 * optics.wavelength / optics.slitPitch).toBeCloseTo(1.2768, 12)
  })

  it('保留掠射級次，且無有限屏幕座標', () => {
    const { optics, widthToPitch } = toModel('double', {
      ...reference, wavelengthNm: 400, widthUm: 0.2, pitchUm: 0.4,
    })
    const points = theory(optics, widthToPitch)
    expect(points.map(({ order, u, x }) => [order, u, x])).toEqual([
      [-1, -1, null], [0, 0, 0], [1, 1, null],
    ])
  })

  it('改變屏幕距離時只縮放同一角度的屏幕座標', () => {
    const { optics, widthToPitch } = toModel('grating', reference)
    const firstOrder = (distance: number) => theory({ ...optics, distance }, widthToPitch, 0.02)
      .find(({ order }) => order === 1)!
    const first = firstOrder(1)
    const second = firstOrder(3)
    expect(second.x).toBeCloseTo(3 * first.x!, 12)
    expect(second.u).toBe(first.u)
    expect(second.intensity).toBe(first.intensity)
  })

  it('從總強度尋找每個波瓣的實際峰值，將峰值與理論級次分開', () => {
    const { optics, widthToPitch } = toModel('double', reference)
    const firstOrder = theory(optics, widthToPitch, 0.015).find(({ order }) => order === 1)!
    const points = localMaxima(optics, 0.015)
    expect(points).toHaveLength(3)
    const peak = points[2]
    expect(peak.u).toBeLessThan(firstOrder.u)
    expect(firstOrder.u - peak.u).toBeGreaterThan(0.0001)
    expect(peak.intensity).toBeGreaterThan(firstOrder.intensity)
    expect(peak.intensity).toBeGreaterThan(intensityAt(optics, peak.u - 0.00001))
    expect(peak.intensity).toBeGreaterThan(intensityAt(optics, peak.u + 0.00001))
    expect(localMaxima(optics, 0.007)).toHaveLength(1)
  })

  it('取樣保留窄峰、理論級次與零點', () => {
    const { optics, widthToPitch } = toModel('grating', { ...reference, count: 24 })
    const halfWidth = automaticHalfWidth(optics)
    const maxU = sinFromPosition(halfWidth, optics.distance)
    const points = theory(optics, widthToPitch, maxU)
    const peaks = localMaxima(optics, maxU)
    const samples = samplePattern(optics, halfWidth, peaks, points)
    expect(samples.some(({ x, intensity }) => x === peaks.at(-1)!.x && intensity === peaks.at(-1)!.intensity)).toBe(true)
    expect(samples.some(({ x, intensity }) => x === points.at(-1)!.x && intensity > 0)).toBe(true)
    const firstZero = positionFromSin(optics.wavelength / (optics.slitCount * optics.slitPitch), optics.distance)
    expect(samples.some(({ x, intensity }) => x === firstZero && intensity < 1e-24)).toBe(true)
  })
})
