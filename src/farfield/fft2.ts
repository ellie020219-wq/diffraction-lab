import { fftPlan } from '../fftPlan'
import { apertureGrid, type Aperture } from './apertures'

export type FftSide = 1024 | 2048
export interface Spectrum {
  // The crop is centered on DC. Rows increase with mathematical y.
  side: number
  step: number
  apertureSize: number
  fftSide: FftSide
  values: Float32Array
  real: Float32Array
  imag: Float32Array
}

export class FarFieldFft {
  private readonly plans = new Map<number, ReturnType<typeof fftPlan>>()
  private rowReal = new Float64Array(0)
  private rowImag = new Float64Array(0)
  private columnReal = new Float64Array(0)
  private columnImag = new Float64Array(0)

  private plan(side: number) {
    let plan = this.plans.get(side)
    if (!plan) {
      plan = fftPlan(side)
      this.plans.set(side, plan)
    }
    return plan
  }

  calculate(aperture: Aperture, fftSide: FftSide): Spectrum {
    const grid = apertureGrid(aperture)
    if (grid.count === 0) throw new Error('孔徑沒有透光取樣點，請檢查尺寸。')

    // Keep only the 512 horizontal transforms that can contain light. Zero
    // rows are implicit; all rows of each vertical FFT still have fftSide slots.
    const rowLength = grid.side * fftSide
    if (this.rowReal.length < rowLength) {
      this.rowReal = new Float64Array(rowLength)
      this.rowImag = new Float64Array(rowLength)
      this.columnReal = new Float64Array(fftSide)
      this.columnImag = new Float64Array(fftSide)
    }
    const real = this.rowReal
    const imag = this.rowImag
    real.fill(0, 0, rowLength)
    imag.fill(0, 0, rowLength)
    const transform = this.plan(fftSide)
    const pad = (fftSide - grid.side) / 2
    for (let row = 0; row < grid.side; row++) {
      real.set(grid.mask.subarray(row * grid.side, (row + 1) * grid.side), row * fftSide + pad)
      transform(real, imag, row * fftSide)
    }

    const step = 1 / (fftSide * grid.step)
    // The UI samples up to 14 cycles per aperture size. Keep margin for
    // interpolation, and calculate only columns inside this physical ROI.
    // FFT2 is separable, so dropping unused columns has no influence on it.
    const half = Math.min(fftSide / 2 - 1, Math.ceil(15 / (step * aperture.size)))
    const side = 2 * half + 1
    const values = new Float32Array(side * side)
    const fieldReal = new Float32Array(side * side)
    const fieldImag = new Float32Array(side * side)
    const norm = grid.count ** 2
    const columnReal = this.columnReal
    const columnImag = this.columnImag

    for (let x = -half; x <= half; x++) {
      const column = (x + fftSide) % fftSide
      columnReal.fill(0, 0, fftSide)
      columnImag.fill(0, 0, fftSide)
      for (let row = 0; row < grid.side; row++) {
        const index = row * fftSide + column
        columnReal[row + pad] = real[index]
        columnImag[row + pad] = imag[index]
      }
      transform(columnReal, columnImag)
      for (let y = -half; y <= half; y++) {
        // Signed indices select the central crop of the fftshifted spectrum.
        const bin = (y + fftSide) % fftSide
        const index = (y + half) * side + x + half
        const re = columnReal[bin]
        const im = columnImag[bin]
        values[index] = (re ** 2 + im ** 2) / norm
        // Remove the transform's origin shift, including the half-cell in the mask.
        // Interpolating the centered complex field preserves destructive interference.
        const phase = -Math.PI * (x + y) / fftSide
        const sign = (x + y) % 2 === 0 ? 1 : -1
        const c = sign * Math.cos(phase) / grid.count
        const s = sign * Math.sin(phase) / grid.count
        fieldReal[index] = c * re - s * im
        fieldImag[index] = s * re + c * im
      }
    }
    return { side, step, apertureSize: aperture.size, fftSide, values, real: fieldReal, imag: fieldImag }
  }

  // The central row of FFT2 is the FFT of the aperture summed over y.
  // A 16384-bin slice resolves the actual first local minimum independently
  // of canvas interpolation or the interactive FFT crop.
  horizontalProfile(aperture: Aperture, side = 16384) {
    const grid = apertureGrid(aperture)
    const real = new Float64Array(side)
    const imag = new Float64Array(side)
    const offset = (side - grid.side) / 2
    for (let index = 0; index < grid.mask.length; index++) real[offset + index % grid.side] += grid.mask[index]
    this.plan(side)(real, imag)
    const values = real.slice(0, side / 2).map((re, index) => (re ** 2 + imag[index] ** 2) / grid.count ** 2)
    return { values, step: 1 / (side * grid.step) }
  }
}
