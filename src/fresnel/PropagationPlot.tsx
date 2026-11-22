import { useLayoutEffect, useRef } from 'react'
import { formatMm, formatWavelength } from '../format'
import { intensityColor, logFloor, type IntensityScale } from '../farfield/intensity'

import type { Normalization } from './observation'

const paletteSize = 1024
const paletteFor = (scale: IntensityScale) => Array.from({ length: paletteSize + 1 }, (_, index) =>
  intensityColor(scale === 'linear' ? index / paletteSize : 10 ** (-6 + 6 * index / paletteSize), scale))
const palettes = { linear: paletteFor('linear'), log: paletteFor('log') }

function ComparisonCanvas({ field, side, halfWidth, distance, title, scale, intensityFactor }: {
  field: Float32Array
  side: number
  halfWidth: number
  distance: number
  title: string
  scale: IntensityScale
  intensityFactor: number
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const ctx = canvas.current?.getContext('2d', { alpha: false })
    if (!ctx) return
    const image = ctx.createImageData(side, side)
    for (let row = 0; row < side; row++) {
      for (let column = 0; column < side; column++) {
        const value = field[(side - 1 - row) * side + column] * intensityFactor
        const shade = scale === 'linear' ? value : 1 + Math.log10(Math.max(logFloor, value)) / 6
        const color = palettes[scale][Math.round(shade * paletteSize)]
        const i = 4 * (row * side + column)
        image.data[i] = color[0]
        image.data[i + 1] = color[1]
        image.data[i + 2] = color[2]
        image.data[i + 3] = 255
      }
    }
    ctx.putImageData(image, 0, 0)
  }, [field, intensityFactor, scale, side])

  return <canvas ref={canvas} width={side} height={side} role="img" aria-label={title + '強度圖'}
    data-screen-half-width={halfWidth} data-distance={distance} data-intensity-scale={scale} data-intensity-factor={intensityFactor} />
}

export function PropagationPlot({ title, field, side, halfWidth, distance, scale, status, warning, apertureLimit,
  normalization, intensityFactor, apertureLabel, wavelength }: {
  title: string
  field?: Float32Array
  side: number
  halfWidth: number
  distance: number
  scale: IntensityScale
  status: string
  warning?: string
  apertureLimit: boolean
  normalization: Normalization
  intensityFactor: number
  apertureLabel: string
  wavelength: number
}) {
  const tick = halfWidth > 0 ? formatMm(halfWidth) : '—'
  const colorTicks = scale === 'log' ? ['1', '10⁻²', '10⁻⁴', '10⁻⁶'] : ['1', '0.75', '0.5', '0.25', '0']
  return <section className="visual-card propagation-figure" aria-label={title}>
    <h2>{title}</h2>
    <p className="propagation-figure-parameters">λ = {formatWavelength(wavelength)} nm · {apertureLabel} · z = {formatMm(distance)} mm</p>
    <p className="propagation-figure-note">{normalization === 'individual' ? '各圖自身峰值' : '共同基準'}{warning && ` · ${warning}`}</p>
    <div className="ff-screen-plot">
      <div className="ff-heat-layout">
        <div className="ff-y-axis" aria-hidden="true"><span>+{tick}</span><span>0</span><span>−{tick}</span></div>
        <div className="ff-heat-frame">
          {field
            ? <ComparisonCanvas field={field} side={side} halfWidth={halfWidth} distance={distance} title={title} scale={scale} intensityFactor={intensityFactor} />
            : <div className="ff-pending">{status}</div>}
          <span className="ff-crosshair" aria-hidden="true" />
        </div>
        <div className="ff-legend" aria-label={scale === 'linear' ? '線性強度色階' : '對數強度色階'}>
          <i aria-hidden="true" />
          <div>{colorTicks.map((label) => <span key={label}>{label}</span>)}</div>
        </div>
        <div className="ff-x-axis" aria-hidden="true"><span>−{tick}</span><span>0</span><span>+{tick}</span></div>
        <p className="ff-x-caption">x (mm)</p>
        <p className="ff-y-caption">y (mm)</p>
      </div>
      {halfWidth > 0 && <p className="ff-probe">共同視野 ±{tick} mm{apertureLimit && '（已依有效取樣縮小）'}</p>}
    </div>
  </section>
}
