import { describe, expect, it } from 'vitest'
import { formatAngle, formatFresnel, formatMm, formatSize, formatWavelength } from '../format'
import type { Aperture } from '../farfield/apertures'
import { comparisonWindow, distanceBounds, FresnelPropagation, fresnelNumber, type Comparison } from './propagation'
import { teachingPresets, type TeachingPreset } from './teachingPresets'

const solver = new FresnelPropagation()

function experiment(preset: TeachingPreset) {
  const size = preset.sizeUm * 1e-6
  const aperture: Aperture = { shape: preset.shape, size, angle: preset.angle, spacing: 2 * size }
  const light = { wavelength: preset.wavelengthNm * 1e-9, distance: preset.distanceM }
  const view = comparisonWindow(aperture, light, false)
  const unit = light.wavelength * light.distance / size
  expect(view.adequate).toBe(true)
  expect(view.limited).toBe(false)
  return { aperture, light, unit, view }
}

function sample(pair: Comparison, unit: number, x: number, y: number) {
  const center = (pair.side - 1) / 2
  const index = (position: number) => Math.round(center * (1 + position * unit / pair.halfWidth))
  return pair.far[index(y) * pair.side + index(x)]
}

describe('教學預設的實際繞射', () => {
  it('A 從近場中央暗點延伸到 Airy 圖樣收斂', () => {
    const { aperture, light, unit, view } = experiment(teachingPresets[0])
    const { min, max } = distanceBounds(aperture, light.wavelength)
    const initial = solver.compare(aperture, light, view.halfWidth)
    expect(light.distance).toBeGreaterThan(min)
    expect(fresnelNumber(aperture, light)).toBeCloseTo(2, 12)
    expect(initial.near[(initial.near.length - 1) / 2]).toBeLessThan(1e-5)
    expect(sample(initial, unit, 1.22, 0)).toBeLessThan(0.001)
    expect(sample(initial, unit, 1.65, 0)).toBeGreaterThan(0.01)
    const distant = { ...light, distance: max }
    expect(fresnelNumber(aperture, distant)).toBeCloseTo(0.04, 12)
    const far = solver.compare(aperture, distant, comparisonWindow(aperture, distant, false).halfWidth)
    const rms = Math.sqrt(far.near.reduce((sum, value, i) => sum + (value - far.far[i]) ** 2, 0) / far.near.length)
    expect(rms).toBeLessThan(0.006)
  })

  it('B 在實際視野展示軸向側瓣以及較暗的對角線', () => {
    const { aperture, light, unit, view } = experiment(teachingPresets[1])
    const field = solver.compare(aperture, light, view.halfWidth)
    const diagonal = 1.45 / Math.SQRT2
    const x = sample(field, unit, 1.45, 0)
    expect(x).toBeGreaterThan(0.04)
    expect(sample(field, unit, 0, 1.45)).toBeCloseTo(x, 5)
    expect(x / sample(field, unit, diagonal, diagonal)).toBeGreaterThan(10)
  })

  it('C 自動視野顯示六道方向，先前固定視野只涵蓋中心', () => {
    const { aperture, light, unit, view } = experiment(teachingPresets[2])
    const field = solver.compare(aperture, light, view.halfWidth)
    const radii = [2.65, 2.9, 3.15, 3.4, 3.65, 3.85]
    function profile(angle: number) {
      const radians = angle * Math.PI / 180
      return radii.reduce((sum, q) => sum + sample(field, unit, q * Math.cos(radians), q * Math.sin(radians)), 0)
    }
    for (let i = 0; i < 6; i++) expect(profile(30 + 60 * i) / profile(60 + 60 * i)).toBeGreaterThan(10)
    expect(profile(30)).toBeCloseTo(profile(210), 6)
    const oldView = comparisonWindow(aperture, light, true)
    const fixed = solver.compare(aperture, light, oldView.halfWidth)
    expect(oldView.halfWidth / unit).toBeLessThan(0.5)
    expect(Math.min(...fixed.far)).toBeGreaterThan(0.5)
  })

  it('固定的是屏幕公尺座標，改變孔徑或距離仍使用同一值', () => {
    const { aperture, light, view } = experiment(teachingPresets[2])
    const changed = { ...aperture, size: aperture.size * 1.1 }
    expect(comparisonWindow(changed, { ...light, distance: light.distance * 1.3 }, view.halfWidth).halfWidth).toBe(view.halfWidth)
    const clipped = comparisonWindow(aperture, light, view.halfWidth * 1000)
    expect(clipped.limited).toBe(true)
    expect(clipped.limitReason.length).toBeGreaterThan(0)
  })
})

it('物理數值以指定小數位或有效位數顯示', () => {
  expect(formatWavelength(632.8)).toBe('632.8')
  expect(formatWavelength(626.355572695719)).toBe('626.4')
  expect(formatSize(454.76762872019)).toBe('454.77')
  expect(formatAngle(24.1010477598509)).toBe('24.1')
  expect(formatMm(0.0711125158)).toBe('71.11')
  expect(formatMm(3.55562579)).toBe('3556')
  expect(formatFresnel(0.04)).toBe('0.04000')
  expect(formatFresnel(2)).toBe('2.000')
})
