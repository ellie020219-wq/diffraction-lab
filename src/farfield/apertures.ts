export const referenceShapes = ['circle', 'square', 'triangle', 'hexagon', 'stadium', 'double-circle'] as const
export const shapes = [...referenceShapes, 'rectangle', 'ellipse', 'cross'] as const
export type Shape = typeof shapes[number]

export interface Aperture {
  shape: Shape
  size: number
  angle: number
  spacing: number
}

export const samplesPerAxis = 512
export const spacingRatio = { min: 1.05, max: 5 }
export const limits = {
  size: { min: 20, max: 2000 },
  wavelength: { min: 380, max: 780 },
  distance: { min: 100, max: 30000 },
  angle: { min: 0, max: 180 },
}

const vertices = {
  triangle: regularVertices(3),
  hexagon: regularVertices(6),
}

function regularVertices(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = Math.PI / 2 + index * 2 * Math.PI / count
    return [Math.cos(angle) / 2, Math.sin(angle) / 2] as const
  })
}

export function apertureRadius(aperture: Aperture) {
  switch (aperture.shape) {
    case 'square': return aperture.size / Math.SQRT2
    case 'rectangle': return Math.hypot(0.5, 0.25) * aperture.size
    case 'cross': return Math.hypot(0.5, 1 / 6) * aperture.size
    case 'stadium': return aperture.size
    case 'double-circle': return (aperture.size + aperture.spacing) / 2
    default: return aperture.size / 2
  }
}

export function apertureKey(aperture: Aperture) {
  const angle = aperture.shape === 'circle' ? 0 : aperture.angle
  const ratio = aperture.shape === 'double-circle' ? aperture.spacing / aperture.size : 0
  return [aperture.shape, angle, ratio.toPrecision(14)].join(':')
}

export function apertureSampler(aperture: Aperture) {
  const cosine = Math.cos(aperture.angle * Math.PI / 180)
  const sine = Math.sin(aperture.angle * Math.PI / 180)
  const offset = aperture.spacing / (2 * aperture.size)

  return (xMeters: number, yMeters: number) => {
    const x = (cosine * xMeters + sine * yMeters) / aperture.size
    const y = (-sine * xMeters + cosine * yMeters) / aperture.size
    switch (aperture.shape) {
      case 'circle': return x * x + y * y <= 0.25
      case 'square': return Math.abs(x) <= 0.5 && Math.abs(y) <= 0.5
      case 'rectangle': return Math.abs(x) <= 0.5 && Math.abs(y) <= 0.25
      case 'ellipse': return x * x + 4 * y * y <= 0.25
      case 'cross': return Math.max(Math.abs(x), Math.abs(y)) <= 0.5 && Math.min(Math.abs(x), Math.abs(y)) <= 1 / 6
      case 'stadium': return Math.max(0, Math.abs(x) - 0.5) ** 2 + y * y <= 0.25
      case 'double-circle': return (Math.abs(x) - offset) ** 2 + y * y <= 0.25
      case 'triangle':
      case 'hexagon': {
        const polygon = vertices[aperture.shape]
        for (let index = 0; index < polygon.length; index++) {
          const [x0, y0] = polygon[index]
          const [x1, y1] = polygon[(index + 1) % polygon.length]
          if ((x1 - x0) * (y - y0) - (y1 - y0) * (x - x0) < 0) return false
        }
        return true
      }
    }
  }
}

export function apertureGrid(aperture: Aperture, side = samplesPerAxis) {
  const step = 2.4 * apertureRadius(aperture) / side
  const sample = apertureSampler(aperture)
  const mask = new Uint8Array(side * side)
  let count = 0
  for (let row = 0; row < side; row++) {
    for (let column = 0; column < side; column++) {
      if (sample((column - side / 2 + 0.5) * step, (row - side / 2 + 0.5) * step)) {
        mask[row * side + column] = 1
        count++
      }
    }
  }
  return { mask, side, step, count }
}

export function samplingCheck(aperture: Aperture) {
  const step = 2.4 * apertureRadius(aperture) / samplesPerAxis
  const shortest = aperture.shape === 'double-circle'
    ? Math.min(aperture.size, aperture.spacing - aperture.size)
    : aperture.shape === 'triangle' ? 0.75 * aperture.size
      : aperture.shape === 'rectangle' || aperture.shape === 'ellipse' ? aperture.size / 2
      : aperture.shape === 'cross' ? aperture.size / 3 : aperture.size
  return { adequate: shortest / step >= 8, step }
}
