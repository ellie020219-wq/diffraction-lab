// All lengths in this module are in meters. Angles are in radians.
export interface Optics {
  wavelength: number
  slitWidth: number
  slitPitch: number
  distance: number
  slitCount: number
}

export interface Ratio {
  numerator: bigint
  denominator: bigint
}

export interface PatternPoint {
  u: number
  x: number
  intensity: number
}

export interface TheoreticalPoint {
  order: number
  u: number
  x: number | null
  intensity: number
  missing: boolean
}

function sinc(value: number) {
  return value === 0 ? 1 : Math.sin(value) / value
}

export function sinFromPosition(x: number, distance: number) {
  return x / Math.hypot(x, distance)
}

export function positionFromSin(u: number, distance: number) {
  return Math.abs(u) < 1 ? distance * u / Math.sqrt((1 - u) * (1 + u)) : null
}

export function envelopeAt(model: Optics, u: number) {
  return sinc(Math.PI * model.slitWidth * u / model.wavelength) ** 2
}

export function intensityAt(model: Optics, u: number) {
  const envelope = envelopeAt(model, u)
  if (model.slitCount === 1) return envelope

  // Reducing the phase modulo π removes the removable singularities.
  // The sign introduced by the reduction disappears when squared.
  const cycles = model.slitPitch * u / model.wavelength
  const phase = Math.PI * (cycles - Math.round(cycles))
  const interference = sinc(model.slitCount * phase) / sinc(phase)
  return envelope * interference ** 2
}

export function farFieldRatio(model: Optics) {
  const aperture = model.slitWidth + (model.slitCount - 1) * model.slitPitch
  return aperture ** 2 / (model.wavelength * model.distance)
}

export function isMissingOrder(order: number, widthToPitch: Ratio) {
  return order !== 0
    && (BigInt(order) * widthToPitch.numerator) % widthToPitch.denominator === 0n
}

const HORIZON_TOLERANCE = 8 * Number.EPSILON

function greatestOrder(scale: number, maxU: number) {
  const bound = scale * maxU
  return Math.floor(bound + HORIZON_TOLERANCE * Math.max(1, bound))
}

function orderSin(u: number) {
  return Math.abs(Math.abs(u) - 1) <= HORIZON_TOLERANCE ? Math.sign(u) : u
}

export function theory(
  model: Optics,
  widthToPitch: Ratio,
  maxU = 1,
): TheoreticalPoint[] {
  const pitch = model.slitCount === 1 ? model.slitWidth : model.slitPitch
  const maxOrder = greatestOrder(pitch / model.wavelength, maxU)
  const points: TheoreticalPoint[] = []

  for (let order = -maxOrder; order <= maxOrder; order++) {
    if (model.slitCount === 1 && order === 0) continue
    const u = order === 0 ? 0 : orderSin(order * model.wavelength / pitch)
    const missing = model.slitCount > 1 && isMissingOrder(order, widthToPitch)
    points.push({
      order: order === 0 ? 0 : order,
      u,
      x: positionFromSin(u, model.distance),
      intensity: model.slitCount === 1 || missing ? 0 : envelopeAt(model, u),
      missing,
    })
  }

  return points
}

function positiveZeros(model: Optics, maxU: number) {
  const zeros: number[] = []
  const envelopePeriod = model.wavelength / model.slitWidth

  for (let n = 1; n * envelopePeriod < maxU; n++) {
    zeros.push(n * envelopePeriod)
  }

  if (model.slitCount > 1) {
    const interferencePeriod = model.wavelength / (model.slitCount * model.slitPitch)
    for (let n = 1; n * interferencePeriod < maxU; n++) {
      if (n % model.slitCount !== 0) zeros.push(n * interferencePeriod)
    }
  }

  return zeros.sort((a, b) => a - b).filter((u, index, sorted) =>
    index === 0 || u - sorted[index - 1] > HORIZON_TOLERANCE)
}

export function localMaxima(model: Optics, maxU: number): PatternPoint[] {
  const positive: PatternPoint[] = []
  const boundaries = [...positiveZeros(model, maxU), maxU]

  // Between consecutive zeros, both log-intensity factors are concave in u.
  // The first lobe has its peak at the center. Search each remaining lobe
  // independently so that narrow peaks and weak side lobes are retained.
  for (let index = 1; index < boundaries.length; index++) {
    const start = boundaries[index - 1]
    const end = boundaries[index]
    let left = start
    let right = end
    for (let iteration = 0; iteration < 64; iteration++) {
      const third = (right - left) / 3
      if (intensityAt(model, left + third) < intensityAt(model, right - third)) {
        left += third
      } else {
        right -= third
      }
    }
    const u = (left + right) / 2
    const x = positionFromSin(u, model.distance)
    const atBoundary = Math.min(u - start, end - u) <= (end - start) * 1e-8
    if (x !== null && !atBoundary) positive.push({ u, x, intensity: intensityAt(model, u) })
  }

  return [
    ...positive.slice().reverse().map(({ u, x, intensity }) => ({ u: -u, x: -x, intensity })),
    { u: 0, x: 0, intensity: 1 },
    ...positive,
  ]
}

export function samplePattern(
  model: Optics,
  halfWidth: number,
  maxima: PatternPoint[],
  theoretical: TheoreticalPoint[],
) {
  const maxU = sinFromPosition(halfWidth, model.distance)
  const length = Math.max(model.slitWidth, model.slitCount > 1 ? model.slitPitch * model.slitCount : 0)
  const intervals = Math.max(320, Math.ceil(maxU * length / model.wavelength * 18))
  const positive = positiveZeros(model, maxU)
  const samples = [
    ...Array.from({ length: 2 * intervals + 1 }, (_, index) => (index - intervals) * maxU / intervals),
    // Also sample in screen coordinates to resolve the stretched outer angles.
    ...Array.from({ length: 321 }, (_, index) => sinFromPosition((index - 160) * halfWidth / 160, model.distance)),
    ...positive.map((u) => -u),
    ...positive,
    ...maxima.map(({ u }) => u),
    ...theoretical.map(({ u }) => u).filter((u) => Math.abs(u) <= maxU),
  ]

  return samples.sort((a, b) => a - b).map((u) => ({
    x: positionFromSin(u, model.distance) ?? Math.sign(u) * halfWidth,
    intensity: intensityAt(model, u),
    envelope: envelopeAt(model, u),
  }))
}
