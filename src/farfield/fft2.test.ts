import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { apertureGrid, apertureRadius, limits, referenceShapes, shapes, spacingRatio, type Aperture, type Shape } from './apertures'
import { FarFieldFft, type Spectrum } from './fft2'
import { intensityAt, intensityColor, screenLimits, screenStep } from './intensity'

const benchmark = { size: 0.001, spacing: 0.002, angle: 0 }
const light = { wavelength: 632.8e-9, distance: 10 }
const transformer = new FarFieldFft()
const reference = JSON.parse(readFileSync(new URL('../../reference/generated/profiles.json', import.meta.url), 'utf8')) as {
  dimension: number; halfWidthQ: number; intensity: Record<Shape, number[]>
}
const results = new Map<Shape, Spectrum>()
const field = (shape: Shape) => results.get(shape)!
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length

function atQ(spectrum: Spectrum, qx: number, qy: number) {
  const delta = spectrum.step * spectrum.apertureSize
  return intensityAt(spectrum, qx / delta, qy / delta)
}

function localMinimum(values: Float64Array, start: number, end: number) {
  for (let i = Math.max(1, start); i < Math.min(values.length - 1, end); i++) {
    const [a, b, c] = [values[i - 1], values[i], values[i + 1]]
    if (a > b && c > b) return i + 0.5 * (a - c) / (a - 2 * b + c)
  }
  throw new Error('未能定位局部極小值')
}

beforeAll(() => {
  for (const shape of referenceShapes) results.set(shape, transformer.calculate({ ...benchmark, shape }, 2048))
})

describe('二維 Fraunhofer FFT', () => {
  it('使用二值 512² 遮罩、逐軸補零、移頻與 SI 頻率座標', () => {
    const aperture = { ...benchmark, shape: 'circle' } as const
    const grid = apertureGrid(aperture)
    expect(grid.side).toBe(512)
    expect(grid.mask.every((value) => value === 0 || value === 1)).toBe(true)
    expect(grid.count * grid.step ** 2).toBeCloseTo(Math.PI * apertureRadius(aperture) ** 2, 8)
    const padded = transformer.calculate(aperture, 1024)
    expect(padded.fftSide).toBe(1024)
    expect(padded.step).toBeCloseTo(1 / (grid.step * 1024), 10)
    expect(field('circle').step).toBeCloseTo(padded.step / 2, 10)
    expect(screenStep(padded, aperture.size, light)).toBeCloseTo(632.8e-9 * 10 * padded.step, 14)
    expect(intensityAt(padded, 0, 0)).toBe(1)
  })

  it.each(referenceShapes)('%s 與獨立連續孔徑基準相符，且具有中心對稱性', (shape) => {
    const spectrum = field(shape)
    const { side, values } = spectrum
    expect(values[(side ** 2 - 1) / 2]).toBe(1)
    let symmetryError = 0
    for (let i = 0; i < values.length; i++) {
      symmetryError = Math.max(symmetryError, Math.abs(values[i] - values[values.length - 1 - i]))
    }
    expect(symmetryError).toBeLessThan(1e-6)

    const errors = reference.intensity[shape].map((expected, index) => {
      const q = (bin: number) => (2 * bin / (reference.dimension - 1) - 1) * reference.halfWidthQ
      return atQ(spectrum, q(index % reference.dimension), q(Math.floor(index / reference.dimension))) - expected
    })
    const rms = Math.sqrt(mean(errors.map((error) => error ** 2)))
    console.info(shape + ' 數值基準 RMS = ' + rms.toExponential(3))
    expect(rms).toBeLessThan(0.003)
    expect(Math.max(...errors.map(Math.abs))).toBeLessThan(0.06)
  })

  it('用 16384 點中心 FFT 剖面與插值定位 7.72 mm 圓孔第一暗環', () => {
    const { values, step } = transformer.horizontalProfile({ ...benchmark, shape: 'circle' })
    const first = localMinimum(values, 1, 100)
    const mm = first * step * light.wavelength * light.distance * 1000
    console.info('圓孔第一暗環 = ' + mm.toFixed(5) + ' mm')
    expect(Math.abs(mm / 7.7180710719 - 1)).toBeLessThan(0.01)
    expect(step * benchmark.size).toBeLessThan(0.027)
  })

  it('方孔第一零點及十字形能量符合 sinc² 預測', () => {
    const aperture = { ...benchmark, shape: 'square' } as const
    const axis = transformer.horizontalProfile(aperture)
    const q = localMinimum(axis.values, 1, 100) * axis.step * aperture.size
    expect(Math.abs(q - 1)).toBeLessThan(0.007)
    const axisEnergy = [1.35, 1.5, 1.65, 2.5, 3.5].map((radius) => atQ(field('square'), radius, 0))
    const diagonals = [1.35, 1.5, 1.65, 2.5, 3.5].map((radius) => atQ(field('square'), radius / Math.SQRT2, radius / Math.SQRT2))
    expect(mean(axisEnergy)).toBeGreaterThan(6 * mean(diagonals))
  })

  it.each([{ shape: 'triangle', offset: 30 }, { shape: 'hexagon', offset: 0 }] as const)('$shape 有六個邊法線亮紋方向', ({ shape, offset }) => {
    const radii = [3.3, 3.7, 4.2, 4.6, 5.1, 5.5, 6.1, 6.6, 7.1, 7.6, 8.1]
    function angularEnergy(angle: number) {
      const radians = angle * Math.PI / 180
      return mean(radii.map((r) => atQ(field(shape), r * Math.cos(radians), r * Math.sin(radians))))
    }
    const angles = Array.from({ length: 6 }, (_, index) => offset + 60 * index)
    const measured = angles.map((center) => {
      const candidates = Array.from({ length: 41 }, (_, index) => center + index - 20)
      return candidates.reduce((best, angle) => angularEnergy(angle) > angularEnergy(best) ? angle : best, center)
    })
    console.info(shape + ' 亮紋方向：' + measured.join('°, ') + '°')
    measured.forEach((angle, index) => {
      expect(Math.abs(angle - angles[index])).toBeLessThanOrEqual(3)
      expect(angularEnergy(angle)).toBeGreaterThan(2 * angularEnergy(angles[index] + 30))
    })
  })

  it('體育場形在短軸方向的中央峰半高全寬較大', () => {
    const width = (axis: 'x' | 'y') => {
      for (let q = 0; q < 1; q += 0.001) {
        if (atQ(field('stadium'), axis === 'x' ? q : 0, axis === 'y' ? q : 0) <= 0.5) return 2 * q
      }
      return 0
    }
    const x = width('x')
    const y = width('y')
    console.info('體育場形 x/y 半高全寬 = ' + x.toFixed(3) + ' / ' + y.toFixed(3) + ' (fD)')
    expect(x).toBeGreaterThan(0)
    expect(y).toBeGreaterThan(1.6 * x)
  })

  it('孔徑逆時針轉 30°，總強度對應逆時針轉 30°', () => {
    const baseline = field('stadium')
    const rotated = transformer.calculate({ ...benchmark, shape: 'stadium', angle: 30 }, 2048)
    const points = Array.from({ length: 31 ** 2 }, (_, i) => [(i % 31 - 15) / 6, (Math.floor(i / 31) - 15) / 6])
    function rms(angle: number) {
      const c = Math.cos(angle * Math.PI / 180)
      const s = Math.sin(angle * Math.PI / 180)
      return Math.sqrt(mean(points.map(([x, y]) => (atQ(baseline, x, y) - atQ(rotated, c * x - s * y, s * x + c * y)) ** 2)))
    }
    const measured = Array.from({ length: 41 }, (_, i) => i + 10)
      .map((angle) => ({ angle, error: rms(angle) })).sort((a, b) => a.error - b.error)[0]
    console.info('旋轉反比對 = ' + measured.angle + '°，RMS = ' + measured.error.toExponential(3))
    expect(Math.abs(measured.angle - 30)).toBeLessThanOrEqual(2)
    expect(measured.error).toBeLessThan(0.006)
    expect(rms(-30)).toBeGreaterThan(5 * measured.error)
  })

  it('孔徑放大使屏幕特徵縮小，雙孔間距加倍使條紋間距減半', () => {
    const firstDark = (aperture: Aperture) => {
      const { values, step } = transformer.horizontalProfile(aperture)
      return localMinimum(values, 1, 200) * step * light.wavelength * light.distance * 1000
    }
    const circle = { ...benchmark, shape: 'circle' } as const
    expect(firstDark(circle) / firstDark({ ...circle, size: 2 * circle.size })).toBeCloseTo(2, 8)
    expect(screenStep(field('circle'), 2 * circle.size, light)).toBeCloseTo(screenStep(field('circle'), circle.size, light) / 2, 12)
    const two = { shape: 'double-circle', size: 0.25e-3, angle: 0, spacing: 0.5e-3 } as const
    const spacings = [two, { ...two, spacing: 1e-3 }].map((model) => 2 * firstDark(model))
    console.info('雙圓孔條紋間距 = ' + spacings.map((v) => v.toFixed(5)).join(' / ') + ' mm')
    expect(Math.abs(spacings[0] / 12.656 - 1)).toBeLessThan(0.01)
    expect(Math.abs(spacings[1] / 6.328 - 1)).toBeLessThan(0.01)
  })

  it('邊界與固定種子的有效參數均產生有限圖樣與安全的屏幕座標', () => {
    let seed = 1729
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296)
    const between = (min: number, max: number) => min + random() * (max - min)
    for (const shape of shapes) {
      for (const caseId of [0, 1, 2, 3]) {
        const size = (caseId === 0 ? limits.size.min : caseId === 1 ? limits.size.max : between(limits.size.min, limits.size.max)) * 1e-6
        const ratio = caseId === 0 ? spacingRatio.max : caseId === 1 ? spacingRatio.min : between(spacingRatio.min, spacingRatio.max)
        const aperture = { shape, size, angle: caseId === 0 ? 180 : between(0, 180), spacing: size * ratio }
        const currentLight = { wavelength: (caseId < 2 ? [780, 380][caseId] : between(380, 780)) * 1e-9,
          distance: (caseId < 2 ? [100, 30000][caseId] : between(100, 30000)) * 1e-3 }
        const spectrum = transformer.calculate(aperture, 1024)
        const screen = screenLimits(aperture, currentLight, caseId === 1 ? 25 : null)
        expect(spectrum.values.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true)
        expect(spectrum.real.every(Number.isFinite) && spectrum.imag.every(Number.isFinite)).toBe(true)
        expect(screen.samplingAdequate).toBe(true)
        expect(Number.isFinite(screen.halfWidth) && screen.halfWidth > 0).toBe(true)
        expect(intensityAt(spectrum, 0, 0)).toBe(1)
        const edge = screen.halfWidth / screenStep(spectrum, size, currentLight)
        const sampled = intensityAt(spectrum, edge * 0.31, -edge * 0.49)
        expect(Number.isFinite(sampled)).toBe(true)
        expect(intensityColor(sampled, 'log').every(Number.isFinite)).toBe(true)
      }
    }
    expect(intensityColor(0, 'log')).toEqual([4, 15, 19])
  })
})
