import { fftPlan } from '../fftPlan'
import { apertureGrid, apertureKey, apertureRadius, samplingCheck, type Aperture } from '../farfield/apertures'
import { FarFieldFft, type Spectrum } from '../farfield/fft2'
import { intensityAt, interpolatedPower, screenLimits, screenStep, type Illumination } from '../farfield/intensity'

export type Grid = { samples: number; padded: number }
export const previewGrid: Grid = { samples: 256, padded: 1024 }
export const detailGrid: Grid = { samples: 512, padded: 4096 }
export const rasterSide = 241

export function fresnelNumber(aperture: Aperture, light: Illumination) {
  return apertureRadius(aperture) ** 2 / (light.wavelength * light.distance)
}

export function distanceBounds(aperture: Aperture, wavelength: number) {
  const radius = apertureRadius(aperture)
  return {
    min: Math.max(radius * 25, radius ** 2 / (6 * wavelength)),
    max: radius ** 2 / (0.04 * wavelength),
    initial: Math.max(radius * 25, radius ** 2 / (2 * wavelength)),
  }
}

export function distanceAt(position: number, min: number, max: number) {
  return min * (max / min) ** (position / 100)
}

export function distancePosition(distance: number, min: number, max: number) {
  return 100 * Math.log(distance / min) / Math.log(max / min)
}

export function comparisonWindow(aperture: Aperture, light: Illumination, fixed: boolean) {
  const radius = apertureRadius(aperture)
  const product = light.wavelength * light.distance
  const desired = fixed ? 2 * radius : Math.max(1.3 * radius, 4 * product / aperture.size)
  const far = screenLimits(aperture, light, desired).halfWidth
  const step = 2.4 * radius / previewGrid.samples
  // Bound the phase change of the full Fresnel integrand, including the
  // largest source-to-screen displacement at a corner of the requested crop.
  const sampling = (0.4 * product / step - radius) / Math.SQRT2
  const paraxial = (Math.pow(0.4 * light.wavelength * light.distance ** 3 / Math.PI, 0.25) - radius) / Math.SQRT2
  const halfWidth = Math.min(far, sampling, paraxial)
  return {
    halfWidth,
    limited: halfWidth < desired * 0.999,
    adequate: samplingCheck(aperture).adequate && Number.isFinite(halfWidth) && halfWidth > 0,
  }
}

// Output quadratic phase and common phase are removed. The stored field
// retains the physical intensity for unit incident amplitude.
export interface FresnelField {
  side: number
  step: number
  real: Float32Array
  imag: Float32Array
}

export interface Comparison {
  side: number
  halfWidth: number
  near: Float32Array
  far: Float32Array
  peaks: { near: number; far: number }
}

function checkGrid(grid: Grid) {
  if (!Number.isInteger(grid.samples) || grid.samples < 8 || grid.samples > 512 || grid.samples % 2
    || ![256, 512, 1024, 2048, 4096].includes(grid.padded) || grid.padded < 2 * grid.samples) {
    throw new Error('孔徑取樣與 FFT 補零尺寸無效。')
  }
}

function normalizeAndReadPeak(values: Float32Array) {
  let peak = 0
  for (const value of values) {
    if (!Number.isFinite(value) || value < 0) throw new Error('繞射強度超出數值範圍。')
    peak = Math.max(peak, value)
  }
  if (peak <= 0) throw new Error('可見視野內沒有可正規化的強度，請調整距離或視野。')
  for (let index = 0; index < values.length; index++) values[index] /= peak
  return peak
}

export function normalizeScreen(values: Float32Array) {
  normalizeAndReadPeak(values)
  return values
}

export class FresnelPropagation {
  private readonly plans = new Map<number, ReturnType<typeof fftPlan>>()
  private rowReal = new Float64Array(0)
  private rowImag = new Float64Array(0)
  private columnReal = new Float64Array(0)
  private columnImag = new Float64Array(0)
  private mask?: { key: string; grid: ReturnType<typeof apertureGrid> }
  private readonly farFft = new FarFieldFft()
  private far?: { key: string; spectrum: Spectrum; areaPerSizeSquared: number }

  calculate(aperture: Aperture, light: Illumination, halfWidth: number, grid = detailGrid): FresnelField {
    checkGrid(grid)
    const product = light.wavelength * light.distance
    const radius = apertureRadius(aperture)
    if (!Number.isFinite(product) || product <= 0 || !Number.isFinite(radius) || radius <= 0
      || !Number.isFinite(halfWidth) || halfWidth <= 0) throw new Error('請輸入有效的孔徑、波長、距離和視野。')

    const maskKey = [apertureKey(aperture), aperture.size, grid.samples].join(':')
    if (this.mask?.key !== maskKey) this.mask = { key: maskKey, grid: apertureGrid(aperture, grid.samples) }
    const { mask, step, count } = this.mask.grid
    if (count === 0) throw new Error('孔徑取樣不足，請加大孔徑特徵。')

    const { samples, padded } = grid
    const screenStep = product / (padded * step)
    const half = Math.ceil(halfWidth / screenStep) + 1
    if (half >= padded / 2 || step * (radius + Math.SQRT2 * halfWidth) > 0.45 * product) {
      throw new Error('相位取樣不足，請縮小屏幕視野或增加傳播距離。')
    }
    const displacement = radius + Math.SQRT2 * halfWidth
    const phaseError = Math.PI * displacement ** 4 / (4 * product * light.distance ** 2)
    if (!Number.isFinite(phaseError) || phaseError > 0.101) {
      throw new Error('目前視野的高階相位誤差超出傍軸範圍，請增加距離或縮小視野。')
    }

    let transform = this.plans.get(padded)
    if (!transform) {
      transform = fftPlan(padded)
      this.plans.set(padded, transform)
    }
    const length = samples * padded
    if (this.rowReal.length < length) {
      this.rowReal = new Float64Array(length)
      this.rowImag = new Float64Array(length)
    }
    if (this.columnReal.length < padded) {
      this.columnReal = new Float64Array(padded)
      this.columnImag = new Float64Array(padded)
    }
    const real = this.rowReal
    const imag = this.rowImag
    real.fill(0, 0, length)
    imag.fill(0, 0, length)

    const pad = (padded - samples) / 2
    const phase = Float64Array.from({ length: samples }, (_, i) =>
      Math.PI * ((i - samples / 2 + 0.5) * step) ** 2 / product)

    // Scaled single-FFT Fresnel integral. Padded rows/columns represent
    // zero illumination outside the aperture. The output quadratic phase
    // has unit modulus and is omitted when computing intensity.
    for (let row = 0; row < samples; row++) {
      for (let column = 0; column < samples; column++) {
        if (!mask[row * samples + column]) continue
        const inputPhase = phase[row] + phase[column]
        real[row * padded + column + pad] = Math.cos(inputPhase)
        imag[row * padded + column + pad] = Math.sin(inputPhase)
      }
      transform(real, imag, row * padded)
    }

    const side = 2 * half + 1
    const outputReal = new Float32Array(side * side)
    const outputImag = new Float32Array(side * side)
    const columnReal = this.columnReal
    const columnImag = this.columnImag
    const prefactor = step ** 2 / product
    for (let x = -half; x <= half; x++) {
      const column = (x + padded) % padded
      columnReal.fill(0, 0, padded)
      columnImag.fill(0, 0, padded)
      for (let row = 0; row < samples; row++) {
        columnReal[row + pad] = real[row * padded + column]
        columnImag[row + pad] = imag[row * padded + column]
      }
      transform(columnReal, columnImag)
      for (let y = -half; y <= half; y++) {
        const bin = (y + padded) % padded
        const index = (y + half) * side + x + half
        // Remove the centered half-cell phase before complex interpolation.
        const phase = -Math.PI * (x + y) / padded
        const sign = (x + y) % 2 === 0 ? 1 : -1
        const c = Math.cos(phase) * sign * prefactor
        const s = Math.sin(phase) * sign * prefactor
        outputReal[index] = c * columnReal[bin] - s * columnImag[bin]
        outputImag[index] = s * columnReal[bin] + c * columnImag[bin]
      }
    }
    return { side, step: screenStep, real: outputReal, imag: outputImag }
  }

  compare(aperture: Aperture, light: Illumination, halfWidth: number, draft = false): Comparison {
    const nearField = this.calculate(aperture, light, halfWidth, draft ? previewGrid : detailGrid)
    const key = apertureKey(aperture)
    if (this.far?.key !== key) {
      const { count, step } = apertureGrid(aperture)
      this.far = { key, spectrum: this.farFft.calculate(aperture, 2048), areaPerSizeSquared: count * (step / aperture.size) ** 2 }
    }
    const farField = this.far.spectrum
    const farStep = screenStep(farField, aperture.size, light)
    const near = new Float32Array(rasterSide ** 2)
    const far = new Float32Array(rasterSide ** 2)
    const center = (rasterSide - 1) / 2
    for (let row = 0; row < rasterSide; row++) {
      const y = (row - center) * halfWidth / center
      for (let column = 0; column < rasterSide; column++) {
        const x = (column - center) * halfWidth / center
        const index = row * rasterSide + column
        near[index] = interpolatedPower(nearField, x / nearField.step, y / nearField.step)
        far[index] = intensityAt(farField, x / farStep, y / farStep)
      }
    }
    // The unchanged Fraunhofer engine supplies intensity relative to its
    // DC intensity. Recover that factor for a unit-amplitude incident wave.
    const area = this.far.areaPerSizeSquared * aperture.size ** 2
    const farDc = (area / (light.wavelength * light.distance)) ** 2
    const peaks = { near: normalizeAndReadPeak(near), far: normalizeAndReadPeak(far) * farDc }
    return { side: rasterSide, halfWidth, near, far, peaks }
  }
}
