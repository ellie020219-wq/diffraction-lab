import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { apertureRadius, apertureSampler, type Aperture } from './apertures'
import type { Spectrum } from './fft2'
import { intensityAt, intensityColor, screenStep, type Illumination, type IntensityScale } from './intensity'

const aperturePixels = 221
const fieldPixels = 353

interface AperturePlotProps {
  aperture: Aperture
  label: string
  showScale?: boolean
}

export function AperturePlot({ aperture, label, showScale }: AperturePlotProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { shape, size, angle, spacing } = aperture
  useEffect(() => {
    const context = ref.current?.getContext('2d')
    if (!context) return
    const model = { shape, size, angle, spacing }
    const half = apertureRadius(model) * 1.21
    const contains = apertureSampler(model)
    const image = context.createImageData(aperturePixels, aperturePixels)
    const center = (aperturePixels - 1) / 2
    for (let row = 0; row < aperturePixels; row++) {
      for (let column = 0; column < aperturePixels; column++) {
        if (!contains((column - center) * half / center, (center - row) * half / center)) continue
        const index = 4 * (row * aperturePixels + column)
        image.data[index] = 251
        image.data[index + 1] = 216
        image.data[index + 2] = 148
        image.data[index + 3] = 255
      }
    }
    context.putImageData(image, 0, 0)
  }, [shape, size, angle, spacing])
  const plot = (
    <div className="ff-aperture-plot">
      <canvas ref={ref} width={aperturePixels} height={aperturePixels} role="img" aria-label={label} />
      {!showScale && <>
        <span className="ff-coordinate-x" aria-hidden="true">x</span>
        <span className="ff-coordinate-y" aria-hidden="true">y</span>
      </>}
      <i className="ff-aperture-center" aria-hidden="true" />
    </div>
  )
  if (!showScale) return plot
  const half = apertureRadius(aperture) * 1.21
  const unit = half < 1e-3 ? 'μm' : 'mm'
  const tick = Number((half * (unit === 'μm' ? 1e6 : 1e3)).toPrecision(4))
  return <div className="ff-aperture-scale" role="group" aria-label={`孔徑 x、y 視野均為 ±${tick} ${unit}`}>
    <div className="ff-aperture-y" aria-hidden="true"><span>+{tick}</span><span>0</span><span>−{tick}</span></div>
    {plot}
    <p className="ff-aperture-y-unit">y ({unit})</p>
    <div className="ff-aperture-x" aria-hidden="true"><span>−{tick}</span><span>0</span><span>+{tick}</span></div>
    <p className="ff-aperture-x-unit">x ({unit})</p>
  </div>
}

interface FieldImageProps {
  spectrum: Spectrum
  size: number
  light: Illumination
  halfWidth: number
  scale: IntensityScale
  label: string
  compact?: boolean
  onProbe?: (value: { x: number; y: number; intensity: number } | null) => void
}

export function FieldImage({ spectrum, size, light, halfWidth, scale, label, compact, onProbe }: FieldImageProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const step = screenStep(spectrum, size, light)
  const pixels = compact ? 177 : fieldPixels

  useEffect(() => {
    const context = ref.current?.getContext('2d', { alpha: false })
    if (!context) return
    const image = context.createImageData(pixels, pixels)
    const center = (pixels - 1) / 2
    const binsPerPixel = halfWidth / (step * center)
    // A small palette lookup table keeps changing the screen bounds responsive.
    const palette = Array.from({ length: 2049 }, (_, index) =>
      intensityColor(scale === 'linear' ? index / 2048 : 10 ** (-6 + 6 * index / 2048), scale))
    for (let row = 0; row < pixels; row++) {
      const y = (center - row) * binsPerPixel
      for (let column = 0; column < pixels; column++) {
        const value = intensityAt(spectrum, (column - center) * binsPerPixel, y)
        const shade = scale === 'linear' ? value : 1 + Math.log10(Math.max(1e-6, value)) / 6
        const color = palette[Math.min(2048, Math.max(0, Math.round(shade * 2048)))]
        const index = 4 * (row * pixels + column)
        image.data[index] = color[0]
        image.data[index + 1] = color[1]
        image.data[index + 2] = color[2]
        image.data[index + 3] = 255
      }
    }
    context.putImageData(image, 0, 0)
  }, [halfWidth, pixels, scale, spectrum, step])

  function probe(event: PointerEvent<HTMLCanvasElement>) {
    if (!onProbe) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(-1, Math.min(1, 2 * (event.clientX - rect.left) / rect.width - 1)) * halfWidth
    const y = Math.max(-1, Math.min(1, 1 - 2 * (event.clientY - rect.top) / rect.height)) * halfWidth
    onProbe({ x, y, intensity: intensityAt(spectrum, x / step, y / step) })
  }

  return <canvas ref={ref} width={pixels} height={pixels} role="img" aria-label={label}
    data-fft={spectrum.fftSide} data-screen-half-width={halfWidth}
    onPointerMove={onProbe ? probe : undefined} onPointerLeave={onProbe ? () => onProbe(null) : undefined} />
}

export function formatMm(meters: number) {
  return new Intl.NumberFormat('zh-TW', { maximumSignificantDigits: 4, useGrouping: false }).format(1000 * meters)
}

interface FarFieldPlotProps {
  aperture: Aperture
  light: Illumination
  halfWidth: number
  spectrum?: Spectrum
  scale: IntensityScale
  error?: string
}

export function FarFieldPlot({ aperture, light, halfWidth, spectrum, scale, error }: FarFieldPlotProps) {
  const [sample, setSample] = useState<{ field: Spectrum; x: number; y: number; intensity: number } | null>(null)
  const cursor = sample?.field === spectrum ? sample : null
  const tick = formatMm(halfWidth)
  return (
    <div className="ff-screen-plot">
      <div className="ff-heat-layout">
        <div className="ff-y-axis" aria-hidden="true"><span>+{tick}</span><span>0</span><span>−{tick}</span></div>
        <div className="ff-heat-frame">
          {spectrum ? <FieldImage spectrum={spectrum} size={aperture.size} light={light} halfWidth={halfWidth} scale={scale}
            label="二維遠場繞射強度圖" onProbe={(point) => setSample(point ? { field: spectrum, ...point } : null)} /> :
            <div className="ff-pending" role="status">{error || '正在計算遠場繞射…'}</div>}
          <span className="ff-crosshair" aria-hidden="true" />
        </div>
        <div className="ff-legend" aria-label={scale === 'log' ? '對數刻度，十的負六次方至一' : '線性刻度，零至一'}>
          <i aria-hidden="true" />
          <div>{(scale === 'log' ? ['1', '10⁻²', '10⁻⁴', '10⁻⁶'] : ['1', '0.75', '0.5', '0.25', '0']).map((label) => <span key={label}>{label}</span>)}</div>
        </div>
        <div className="ff-x-axis" aria-hidden="true"><span>−{tick}</span><span>0</span><span>+{tick}</span></div>
        <p className="ff-x-caption">x (mm)</p>
        <p className="ff-y-caption">y (mm)</p>
      </div>
      <div className="ff-probe">
        {cursor ? <span>x {formatMm(cursor.x)} mm · y {formatMm(cursor.y)} mm · I / I₀ {cursor.intensity.toPrecision(3)}</span>
          : <span>屏幕範圍 x、y 均為 ±{tick} mm</span>}
      </div>
    </div>
  )
}
