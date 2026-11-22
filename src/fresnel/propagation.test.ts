import { describe, expect, it } from 'vitest'
import { apertureGrid, apertureRadius, shapes, type Aperture } from '../farfield/apertures'
import { FarFieldFft } from '../farfield/fft2'
import { intensityAt, interpolatedPower } from '../farfield/intensity'
import {
  comparisonWindow, detailGrid, distanceAt, distanceBounds, distancePosition, FresnelPropagation,
  fresnelNumber, normalizeScreen, previewGrid,
} from './propagation'
import { comparisonFactors, explainObservation } from './observation'
import { makeQuestion } from '../farfield/FarFieldQuiz'

const rectangle: Aperture = { shape: 'rectangle', size: 600e-6, angle: 0, spacing: 1.2e-3 }
const circle: Aperture = { ...rectangle, shape: 'circle' }
const wavelength = 632.8e-9
const atFresnel = (aperture: Aperture, number: number) => ({
  wavelength, distance: apertureRadius(aperture) ** 2 / (wavelength * number),
})
const rms = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let difference = 0
  for (let index = 0; index < a.length; index++) difference += (a[index] - b[index]) ** 2
  return Math.sqrt(difference / a.length)
}

function axisIntegralPower(width: number, coordinate: number, product: number) {
  const count = 4096
  const step = width / count
  let real = 0
  let imag = 0
  for (let index = 0; index <= count; index++) {
    const phase = Math.PI * (index * step - width / 2 - coordinate) ** 2 / product
    const weight = index === 0 || index === count ? 1 : index % 2 === 0 ? 2 : 4
    real += weight * Math.cos(phase)
    imag += weight * Math.sin(phase)
  }
  return (step / 3) ** 2 * (real ** 2 + imag ** 2)
}

describe('Fresnel 傍軸傳播', () => {
  it('對照獨立連續積分的長方孔原始強度及 SI 座標', () => {
    const propagator = new FresnelPropagation()
    const light = atFresnel(rectangle, 2)
    const product = light.wavelength * light.distance
    const field = propagator.calculate(rectangle, light, 0.55e-3)
    const expected = []
    const actual = []
    for (const [x, y] of [[0, 0], [0.09e-3, 0.06e-3], [0.12e-3, -0.19e-3], [0.24e-3, 0], [0.49e-3, -0.35e-3]]) {
      expected.push(axisIntegralPower(rectangle.size, x, product) * axisIntegralPower(rectangle.size / 2, y, product) / product ** 2)
      actual.push(interpolatedPower(field, x / field.step, y / field.step))
    }
    expect(field.step).toBeCloseTo(product / (detailGrid.padded * apertureGrid(rectangle, detailGrid.samples).step), 14)
    console.info('長方孔 Fresnel 絕對強度 RMS = ' + rms(expected, actual).toExponential(4))
    expect(rms(expected, actual)).toBeLessThan(0.015)
  })

  it('圓孔在 N_F = 2 有中央暗點，各圖仍正規化至 1', () => {
    const light = atFresnel(circle, 2)
    const { halfWidth } = comparisonWindow(circle, light, true)
    const propagator = new FresnelPropagation()
    const { near, far } = propagator.compare(circle, light, halfWidth)
    const center = (near.length - 1) / 2
    console.info('圓孔 N_F = 2 正規化中央強度 = ' + near[center].toExponential(5))
    expect(near[center]).toBeLessThan(0.0001)
    expect(far[center]).toBe(1)
    for (const field of [near, far]) {
      expect(Math.max(...field)).toBe(1)
      expect(field.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true)
    }
  })

  it('共同基準保留單位入射振幅下的強度比例', () => {
    const light = atFresnel(circle, 2)
    const halfWidth = comparisonWindow(circle, light, true).halfWidth
    const { peaks } = new FresnelPropagation().compare(circle, light, halfWidth)
    const { count, step } = apertureGrid(circle)
    const expectedFarPeak = (count * step ** 2 / (light.wavelength * light.distance)) ** 2
    expect(peaks.far).toBeCloseTo(expectedFarPeak, 9)
    expect(peaks.near).toBeGreaterThan(0)
    expect(comparisonFactors(peaks, 'individual')).toEqual({ near: 1, far: 1 })
    const shared = comparisonFactors(peaks, 'shared')
    expect(shared.far).toBe(1)
    expect(shared.near).toBeCloseTo(peaks.near / expectedFarPeak, 9)
    expect(peaks.near / peaks.far).toBeLessThan(1)
  })

  it('即時說明隨距離、波長與孔徑改變，顯示對應的三種教學區間', () => {
    const close = atFresnel(circle, 2)
    const initial = explainObservation(circle, close)
    const changedWavelength = explainObservation(circle, { ...close, wavelength: 2 * close.wavelength })
    expect(changedWavelength.number).toBeCloseTo(initial.number / 2, 12)
    expect(changedWavelength.spatialFeature).not.toBe(initial.spatialFeature)
    expect(initial.regime).toBe('近場特徵較明顯')
    expect(explainObservation(circle, atFresnel(circle, 0.5)).regime).toBe('過渡區')
    expect(explainObservation(circle, atFresnel(circle, 0.05)).regime).toBe('接近遠場條件')
    const large = explainObservation({ ...circle, size: 2 * circle.size }, close)
    expect(large.number).toBeCloseTo(4 * initial.number, 12)
    expect(large.cause).not.toBe(initial.cause)
  })

  it('距離增大後，兩種傳播在共同視野逐漸收斂', () => {
    const solver = new FresnelPropagation()
    const close = atFresnel(circle, 2)
    const distant = atFresnel(circle, 0.04)
    const near = solver.compare(circle, close, comparisonWindow(circle, close, false).halfWidth)
    const far = solver.compare(circle, distant, comparisonWindow(circle, distant, false).halfWidth)
    const transition = rms(near.near, near.far)
    const convergence = rms(far.near, far.far)
    console.info('比較圖正規化 RMS，N_F = 2 / 0.04：' + transition.toExponential(4) + ' / ' + convergence.toExponential(4))
    expect(transition).toBeGreaterThan(0.08)
    expect(convergence).toBeLessThan(0.006)
  })

  it('加密孔徑網格與補零後，共同區域和邊界樣點一致', () => {
    const propagator = new FresnelPropagation()
    const aperture = { ...rectangle, angle: 29 }
    const light = atFresnel(aperture, 4)
    const { halfWidth } = comparisonWindow(aperture, light, true)
    const draft = propagator.calculate(aperture, light, halfWidth, previewGrid)
    const detail = propagator.calculate(aperture, light, halfWidth)
    const cropped = propagator.calculate(aperture, light, halfWidth / 2)
    const points = Array.from({ length: 25 ** 2 }, (_, index) => [
      (index % 25 - 12) / 12 * halfWidth, (Math.floor(index / 25) - 12) / 12 * halfWidth,
    ])
    const get = (result: typeof draft, x: number, y: number) => interpolatedPower(result, x / result.step, y / result.step)
    const differences = rms(points.map(([x, y]) => get(draft, x, y)), points.map(([x, y]) => get(detail, x, y)))
    console.info('Fresnel 取樣加密 256/1024 → 512/4096 RMS = ' + differences.toExponential(4))
    expect(differences).toBeLessThan(0.036)
    for (const [x, y] of points.filter(([x, y]) => Math.abs(x) <= halfWidth / 2 && Math.abs(y) <= halfWidth / 2)) {
      expect(get(detail, x, y)).toBeCloseTo(get(cropped, x, y), 8)
    }
  })

  it('共同視野內的積分能量符合有限裁切的入射能量上限', () => {
    const light = atFresnel(circle, 2)
    const { halfWidth } = comparisonWindow(circle, light, true)
    const field = new FresnelPropagation().calculate(circle, light, halfWidth)
    const { side, step, real, imag } = field
    const grid = apertureGrid(circle, detailGrid.samples)
    const center = (side - 1) / 2
    let power = 0
    for (let i = 0; i < real.length; i++) {
      if (Math.abs((i % side) - center) * step > halfWidth || Math.abs(Math.floor(i / side) - center) * step > halfWidth) continue
      power += real[i] ** 2 + imag[i] ** 2
    }
    const ratio = power * step ** 2 / (grid.count * grid.step ** 2)
    console.info('圓孔有效視野能量比例 = ' + ratio.toFixed(5))
    expect(ratio).toBeGreaterThan(0.85)
    expect(ratio).toBeLessThan(1.005)
  })

  it('拒絕無效距離、空白正規化及可能有頻率環繞的視野', () => {
    const solver = new FresnelPropagation()
    expect(() => solver.calculate(circle, { wavelength, distance: 0 }, 1e-3)).toThrow('有效')
    expect(() => solver.calculate(circle, { wavelength, distance: 1e-8 }, 1e-3)).toThrow('相位取樣不足')
    expect(() => normalizeScreen(Float32Array.of(0, 0))).toThrow('強度')
    expect(() => normalizeScreen(Float32Array.of(NaN, Infinity))).toThrow('數值')
    expect([...normalizeScreen(Float32Array.of(0, 9, 3))]).toEqual([0, 1, Math.fround(1 / 3)])
  })

  it('所有孔徑及尺寸邊界都有正值距離及取樣有效的共用視野', () => {
    for (const shape of shapes) {
      for (const size of [20e-6, 2e-3]) {
        const aperture = { shape, size, spacing: size * 5, angle: 17 }
        for (const wavelength of [380e-9, 780e-9]) {
          const { min, max, initial } = distanceBounds(aperture, wavelength)
          expect(min).toBeGreaterThan(0)
          expect(max).toBeGreaterThan(initial)
          expect(initial).toBeGreaterThanOrEqual(min)
          expect(distanceAt(distancePosition(initial, min, max), min, max)).toBeCloseTo(initial, 12)
          expect(fresnelNumber(aperture, { wavelength, distance: max })).toBeCloseTo(0.04, 12)
          for (const distance of [min, initial, max]) {
            const view = comparisonWindow(aperture, { wavelength, distance }, false)
            expect(view.adequate).toBe(true)
          }
        }
      }
    }
  })
})

describe('新增孔徑', () => {
  it.each([
    { shape: 'rectangle', area: 0.5 },
    { shape: 'ellipse', area: Math.PI / 8 },
    { shape: 'cross', area: 5 / 9 },
  ] as const)('$shape 的面積與遠場中心對稱符合幾何', ({ shape, area }) => {
    const aperture = { ...rectangle, shape, angle: 30 }
    const grid = apertureGrid(aperture)
    expect(Math.abs(grid.count * grid.step ** 2 / (aperture.size ** 2 * area) - 1)).toBeLessThan(0.008)
    const field = new FarFieldFft().calculate(aperture, 2048)
    expect(field.values.every((value, index) => Number.isFinite(value)
      && Math.abs(value - field.values[field.values.length - 1 - index]) < 1e-6)).toBe(true)
  })

  it('長方形及橢圓形的短軸亮斑展寬符合解析零點', () => {
    const solver = new FarFieldFft()
    for (const [shape, first] of [['rectangle', 1], ['ellipse', 1.21967]] as const) {
      const spectrum = solver.calculate({ ...rectangle, shape }, 2048)
      function firstMinimum(axis: 'x' | 'y') {
        const step = spectrum.step * rectangle.size
        let a = 1
        let b = 1
        for (let i = 1; i < 550; i++) {
          const q = (i / 100) / step
          const c = intensityAt(spectrum, axis === 'x' ? q : 0, axis === 'y' ? q : 0)
          if (b < a && b < c) return (i - 1) / 100
          a = b
          b = c
        }
        return 0
      }
      expect(Math.abs(firstMinimum('x') - first)).toBeLessThan(0.025)
      expect(Math.abs(firstMinimum('y') - 2 * first)).toBeLessThan(0.025)
    }
  })

  it('九種孔徑都可被抽為猜猜看的正確答案', () => {
    const candidates = new Set<string>()
    let state = 15
    const random = () => (state = (Math.imul(48271, state) >>> 0)) / 2 ** 32
    for (let index = 0; index < 160; index++) candidates.add(makeQuestion(undefined, random).correct)
    expect(candidates).toEqual(new Set(shapes))
  })
})
