import { apertureRadius, samplingCheck, type Aperture } from './apertures'
import type { Spectrum } from './fft2'

export type IntensityScale = 'linear' | 'log'
export const logFloor = 1e-6

export interface Illumination {
  wavelength: number
  distance: number
}

export function screenStep(spectrum: Spectrum, apertureSize: number, light: Illumination) {
  return light.wavelength * light.distance * spectrum.step * spectrum.apertureSize / apertureSize
}

export function intensityAt(spectrum: Spectrum, xBins: number, yBins: number) {
  return Math.min(1, interpolatedPower(spectrum, xBins, yBins))
}

export function interpolatedPower({ side, real, imag }: Pick<Spectrum, 'side' | 'real' | 'imag'>, xBins: number, yBins: number) {
  const center = (side - 1) / 2
  const x = center + xBins
  const y = center + yBins
  if (Math.abs(xBins) > center || Math.abs(yBins) > center) return 0
  const left = Math.floor(x)
  const bottom = Math.floor(y)
  const right = Math.min(left + 1, side - 1)
  const top = Math.min(bottom + 1, side - 1)
  const lowerLeft = bottom * side + left
  const lowerRight = bottom * side + right
  const upperLeft = top * side + left
  const upperRight = top * side + right
  const tx = x - left
  const ty = y - bottom
  const w00 = (1 - tx) * (1 - ty)
  const w10 = tx * (1 - ty)
  const w01 = (1 - tx) * ty
  const w11 = tx * ty
  const re = w00 * real[lowerLeft] + w10 * real[lowerRight] + w01 * real[upperLeft] + w11 * real[upperRight]
  const im = w00 * imag[lowerLeft] + w10 * imag[lowerRight] + w01 * imag[upperLeft] + w11 * imag[upperRight]
  return re ** 2 + im ** 2
}

export function screenLimits(aperture: Aperture, light: Illumination, fixed: number | null = null) {
  const { adequate, step } = samplingCheck(aperture)
  const scale = light.wavelength * light.distance / aperture.size
  const desired = fixed ?? 6 * scale
  const nyquist = light.wavelength * light.distance / (2 * step)
  const acquired = 14 * scale
  const paraxial = 0.1 * light.distance / Math.SQRT2
  const halfWidth = Math.min(desired, nyquist * 0.98, acquired, paraxial)
  const fresnel = apertureRadius(aperture) ** 2 / (light.wavelength * light.distance)
  return { halfWidth, fresnel, samplingAdequate: adequate, clipped: halfWidth < desired * (1 - 1e-12) }
}

const colorStops = [
  [4, 15, 19],
  [17, 42, 55],
  [23, 94, 111],
  [57, 155, 152],
  [167, 213, 169],
  [255, 234, 168],
]

export function intensityColor(intensity: number, scale: IntensityScale) {
  const clipped = Math.max(0, Math.min(1, intensity))
  const amount = scale === 'linear' ? clipped : 1 + Math.log10(Math.max(logFloor, clipped)) / 6
  const index = amount * (colorStops.length - 1)
  const start = colorStops[Math.floor(index)]
  const end = colorStops[Math.min(Math.floor(index) + 1, colorStops.length - 1)]
  const weight = index % 1
  return start.map((channel, channelIndex) => Math.round(channel + weight * (end[channelIndex] - channel)))
}
