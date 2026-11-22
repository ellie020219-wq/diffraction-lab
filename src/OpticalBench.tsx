import { useId, useMemo } from 'react'
import { apertureRadius, apertureSampler, type Aperture } from './farfield/apertures'

const cells = 96

function apertureSilhouette(aperture: Aperture) {
  const sample = apertureSampler(aperture)
  const step = 2.1 * apertureRadius(aperture) / cells
  const shape: string[] = []
  for (let row = 0; row < cells; row++) {
    const y = (cells / 2 - row - 0.5) * step
    let start = 0
    let inside = false
    for (let column = 0; column <= cells; column++) {
      const open = column < cells && sample((column + 0.5 - cells / 2) * step, y)
      if (open && !inside) start = column
      if (!open && inside) shape.push(`M${start} ${row}h${column - start}v1H${start}z`)
      inside = open
    }
  }
  return shape.join('')
}

function ShapedOpening({ aperture, x, y, width }: { aperture: Aperture; x: number; y: number; width: number }) {
  const { shape, size, angle, spacing } = aperture
  const outline = useMemo(() => apertureSilhouette({ shape, size, angle, spacing }), [shape, size, angle, spacing])
  return <path className="path-opening" d={outline}
    transform={`translate(${x - width / 2} ${y - width / 2}) scale(${width / cells})`}
    data-aperture-outline="true" data-shape={shape} data-size={size * 1e6} data-angle={angle} />
}

export function AperturePlate({ aperture, x, y, width, openingWidth = width * 0.7 }: {
  aperture: Aperture | number; x: number; y: number; width: number; openingWidth?: number
}) {
  const count = typeof aperture === 'number' ? aperture : 0
  const pitch = openingWidth / Math.max(1, count)
  return <g>
    <rect className="path-plate" x={x - width / 2} y={y - width / 2} width={width} height={width} rx={width * .075} />
    {typeof aperture === 'number' ? Array.from({ length: count }, (_, i) => {
      const slitWidth = Math.min(width * .15, pitch * .46)
      return <rect key={i} className="path-opening" data-slit-opening
        x={x + (i - (count - 1) / 2) * pitch - slitWidth / 2} y={y - openingWidth / 2}
        width={slitWidth} height={openingWidth} rx={.55} />
    }) : <ShapedOpening aperture={aperture} x={x} y={y} width={openingWidth} />}
  </g>
}

export function OpticalBench({ aperture, label, position = 85, distanceSymbol = 'z' }: {
  aperture: Aperture | number; label: string; position?: number; distanceSymbol?: 'z' | 'L'
}) {
  const arrow = useId()
  const glow = useId()
  const plateX = 261
  const centerY = 78
  const screenX = 432 + 275 * position / 100
  const waveOrigin = plateX + 48
  const wavefronts = Array.from({ length: 4 }, (_, i) => waveOrigin + (screenX - waveOrigin) * (i + 1) / 5)
  const openingWidth = typeof aperture === 'number' ? 58
    : Math.max(26, Math.min(76, 26 + 17 * Math.log10(apertureRadius(aperture) / 10e-6)))

  return <svg viewBox="0 0 768 171" className="propagation-path-sketch" role="img" aria-label={label}>
    <defs>
      <marker id={arrow} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto-start-reverse">
        <path d="M1 1L5.5 3.5L1 6" fill="none" stroke="#a4c3b6" strokeWidth="1.15" />
      </marker>
      <linearGradient id={glow} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
        <stop stopColor="#fbd894" stopOpacity=".18" />
        <stop offset="1" stopColor="#fbd894" stopOpacity=".07" />
      </linearGradient>
    </defs>
    <path d={`M 38 ${centerY} H ${screenX}`} className="path-axis" />
    <rect x="118" y="51" width="102" height="54" fill={`url(#${glow})`} />
    <path d="M 35 59 H 103 L 117 66 V 90 L 103 97 H 35 Q 29 97 29 91 V 65 Q 29 59 35 59Z" className="path-laser" />
    <path d="M 42 66 H 97 M 42 90 H 97" className="path-housing" />
    <rect x="113" y="65" width="10" height="26" rx="3" className="path-opening" />
    {[150, 177, 204].map(x => <path key={x} className="path-incident" d={`M${x} 51 V 105`} />)}
    <path d="M 142 41 H 210" className="path-direction" markerEnd={`url(#${arrow})`} />
    <AperturePlate aperture={aperture} x={plateX} y={centerY} width={96} openingWidth={openingWidth} />
    {wavefronts.map((x, index) => {
      const spread = 11 + 9 * index
      return <path key={index} className="path-diffracted" opacity={0.89 - index * 0.12}
        d={`M ${x - 8} ${centerY - spread} Q ${x + 12} ${centerY} ${x - 8} ${centerY + spread}`} />
    })}
    <path d={`M ${plateX + 60} 23 H ${screenX - 23}`} className="path-direction" markerEnd={`url(#${arrow})`} />
    <g transform={`translate(${screenX} 0)`} data-screen-position={screenX}>
      <rect x="-4" y="33" width="10" height="91" rx="2" className="path-screen" />
      <path d="M 1 67 V 89" className="path-screen-mark" />
      <path d="M 6 124 L 16 133 H -15 L -4 124" className="path-laser" />
    </g>
    <path d={`M ${plateX} 129 V 154 M ${screenX} 135 V 154`} className="path-measure" />
    <text x={(plateX + screenX) / 2} y="144" className="path-distance-symbol">{distanceSymbol}</text>
    <path d={`M ${plateX + 5} 151 H ${screenX - 5}`} className="path-direction"
      markerStart={`url(#${arrow})`} markerEnd={`url(#${arrow})`} />
  </svg>
}
