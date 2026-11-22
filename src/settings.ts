import { positionFromSin, type Optics, type Ratio } from './optics'

export type Mode = 'single' | 'double' | 'grating'

export interface Settings {
  wavelengthNm: number
  widthUm: number
  pitchUm: number
  distanceM: number
  count: number
  density: number | null
}

export const defaults: Settings = {
  wavelengthNm: 632.8,
  widthUm: 40,
  pitchUm: 160,
  distanceM: 2,
  count: 5,
  density: null,
}

export const greenGrating: Settings = {
  wavelengthNm: 532,
  widthUm: 0.5,
  pitchUm: 1000 / 600,
  distanceM: 1,
  count: 8,
  density: 600,
}

// Use the entered decimal exactly for coincidence tests. SI geometry remains
// floating-point, including a pitch derived from an exact groove density.
function decimalRatio(value: number): Ratio {
  const [mantissa, exponent = '0'] = String(value).split('e')
  const [whole, fraction = ''] = mantissa.split('.')
  const power = Number(exponent) - fraction.length
  const integer = BigInt(whole + fraction)
  return power >= 0
    ? { numerator: integer * 10n ** BigInt(power), denominator: 1n }
    : { numerator: integer, denominator: 10n ** BigInt(-power) }
}

export function toModel(mode: Mode, settings: Settings): { optics: Optics; widthToPitch: Ratio } {
  const width = decimalRatio(settings.widthUm)
  const pitch = settings.density === null
    ? decimalRatio(settings.pitchUm)
    : { numerator: 1000n, denominator: BigInt(settings.density) }

  return {
    optics: {
      wavelength: settings.wavelengthNm * 1e-9,
      slitWidth: settings.widthUm * 1e-6,
      slitPitch: settings.density === null ? settings.pitchUm * 1e-6 : 1 / (settings.density * 1000),
      distance: settings.distanceM,
      slitCount: mode === 'single' ? 1 : mode === 'double' ? 2 : settings.count,
    },
    widthToPitch: {
      numerator: width.numerator * pitch.denominator,
      denominator: width.denominator * pitch.numerator,
    },
  }
}

export function automaticHalfWidth(model: Optics) {
  const envelope = 1.22 * model.wavelength / model.slitWidth
  const orders = model.slitCount > 1 ? 4.5 * model.wavelength / model.slitPitch : 0
  // Show the main envelope when possible and keep closely spaced fringes
  // legible when a very wide envelope contains many orders.
  const readable = model.slitCount > 1 ? 14 * model.wavelength / model.slitPitch : 1
  const u = Math.min(0.97, readable, Math.max(envelope, orders))
  const halfWidth = positionFromSin(u, model.distance)!
  const step = 10 ** (Math.floor(Math.log10(halfWidth)) - 1)
  return Math.ceil(halfWidth / step) * step
}
