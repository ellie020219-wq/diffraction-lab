import { formatWavelength } from './format'
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Crosshair, Expand, ScanLine } from 'lucide-react'
import { intensityAt, sinFromPosition, type Optics, type PatternPoint, type TheoreticalPoint } from './optics'
import { wavelengthColor } from './wavelength'

export const screenScales = { near: 0.5, auto: 1, wide: 2, far: 2.5 }
export type ScreenScale = keyof typeof screenScales

interface Sample {
  x: number
  intensity: number
  envelope: number
}

interface ChartProps {
  model: Optics
  wavelengthNm: number
  samples: Sample[]
  theory: TheoreticalPoint[]
  maxima: PatternPoint[]
  halfWidth: number
  scale: ScreenScale
  onScaleChange: (scale: ScreenScale) => void
}

const plotLeft = 40
const plotRight = 15
const plotTop = 12
const plotBottom = 47
const colors = {
  total: '#ffd092',
  envelope: '#83bcae',
  order: '#a6abdc',
  missing: '#f7a29d',
  text: '#a3b9b1',
  grid: '#2b4440',
  axis: '#4f6861',
}

function prepareCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  const context = canvas.getContext('2d')
  context?.setTransform(ratio, 0, 0, ratio, 0, 0)
  return context
}

function compactNumber(number: number, digits = 4) {
  return Number(number.toPrecision(digits)).toString().replace('-', '−')
}

type Draw = (canvas: HTMLCanvasElement, width: number, height: number) => void

function useCanvas(ref: RefObject<HTMLCanvasElement | null>, draw: Draw) {
  useLayoutEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const paint = () => draw(canvas, canvas.clientWidth, canvas.clientHeight)
    paint()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [ref, draw])
}

export function PatternChart({
  model, wavelengthNm, samples, theory, maxima, halfWidth, scale, onScaleChange,
}: ChartProps) {
  const plot = useRef<HTMLCanvasElement>(null)
  const screen = useRef<HTMLCanvasElement>(null)
  const [envelope, setEnvelope] = useState(true)
  const [markers, setMarkers] = useState(true)
  const [probe, setProbe] = useState<number | null>(null)
  const single = model.slitCount === 1
  const unit = halfWidth >= 1 ? 'm' : 'mm'
  const displayFactor = unit === 'm' ? 1 : 1000
  const probeX = probe === null ? null : probe * halfWidth
  const probeIntensity = probeX === null ? null : intensityAt(model, sinFromPosition(probeX, model.distance))
  const probeLeft = probe === null ? undefined : `${(1 + probe) * 50}%`

  const drawPlot = useCallback<Draw>((canvas, width, height) => {
    if (width <= plotLeft + plotRight || height <= plotBottom) return
    const context = prepareCanvas(canvas, width, height)
    if (!context) return
    const right = width - plotRight
    const bottom = height - plotBottom
    const px = (x: number) => plotLeft + (right - plotLeft) * (x / halfWidth + 1) / 2
    const py = (intensity: number) => bottom - intensity * (bottom - plotTop)
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      context.beginPath()
      context.moveTo(x1, y1)
      context.lineTo(x2, y2)
      context.stroke()
    }

    context.font = '11px ui-monospace, monospace'
    context.lineWidth = 1
    context.textBaseline = 'middle'
    context.textAlign = 'right'
    context.fillStyle = colors.text
    context.strokeStyle = colors.grid
    context.setLineDash([3, 5])
    for (let i = 0; i <= 4; i++) {
      const tick = i / 4
      line(plotLeft, py(tick), right, py(tick))
      context.fillText(tick === 1 || tick === 0 ? tick.toFixed(1) : String(tick), plotLeft - 8, py(tick))
    }

    context.textAlign = 'center'
    const divisions = width < 520 ? 4 : 8
    for (let i = 0; i <= divisions; i++) {
      const x = halfWidth * (2 * i / divisions - 1)
      const xx = px(x)
      context.strokeStyle = i === divisions / 2 ? colors.axis : colors.grid
      line(xx, plotTop, xx, bottom)
      context.fillText(compactNumber(x * displayFactor), Math.min(width - 18, Math.max(plotLeft, xx)), bottom + 17)
    }
    context.font = '12px system-ui, sans-serif'
    context.fillText('屏幕位置 x (' + unit + ')', (right + plotLeft) / 2, height - 8)
    context.setLineDash([])
    context.strokeStyle = colors.axis
    line(plotLeft, bottom, right, bottom)

    context.save()
    context.beginPath()
    context.rect(plotLeft - 1, 0, right - plotLeft + 2, bottom + 9)
    context.clip()

    const trace = (key: 'intensity' | 'envelope') => {
      context.beginPath()
      samples.forEach((sample, index) => {
        const x = px(sample.x)
        const y = py(sample[key])
        if (index === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      })
    }
    const fill = context.createLinearGradient(0, plotTop, 0, bottom)
    fill.addColorStop(0, 'rgba(255, 195, 126, .30)')
    fill.addColorStop(1, 'rgba(255, 195, 126, .025)')
    trace('intensity')
    context.lineTo(right, bottom)
    context.lineTo(plotLeft, bottom)
    context.closePath()
    context.fillStyle = fill
    context.fill()

    if (envelope && !single) {
      context.strokeStyle = colors.envelope
      context.lineWidth = 1.4
      context.setLineDash([5, 5])
      trace('envelope')
      context.stroke()
      context.setLineDash([])
    }

    context.strokeStyle = colors.total
    context.lineWidth = 2
    context.lineJoin = 'round'
    trace('intensity')
    context.stroke()

    if (markers) {
      for (const point of theory) {
        if (point.x === null) continue
        const x = px(point.x)
        const y = py(point.intensity)
        context.lineWidth = 1.45
        context.strokeStyle = point.missing ? colors.missing : colors.order
        if (point.missing) {
          line(x - 4, y - 4, x + 4, y + 4)
          line(x - 4, y + 4, x + 4, y - 4)
        } else {
          context.strokeRect(x - 3, y - 3, 6, 6)
        }
      }
      context.fillStyle = colors.total
      context.strokeStyle = '#142823'
      for (const peak of maxima) {
        context.beginPath()
        context.arc(px(peak.x), py(peak.intensity), 3, 0, Math.PI * 2)
        context.fill()
        context.stroke()
      }
    }

    context.restore()
  }, [displayFactor, envelope, halfWidth, markers, maxima, samples, single, theory, unit])

  const drawScreen = useCallback<Draw>((canvas, width, height) => {
    if (width <= 0 || height <= 0) return
    const context = prepareCanvas(canvas, width, height)
    if (!context) return
    const [red, green, blue] = wavelengthColor(wavelengthNm)
    const columns = context.createImageData(canvas.width, 1)

    for (let column = 0; column < columns.width; column++) {
      let average = 0
      for (const offset of [0.125, 0.375, 0.625, 0.875]) {
        const x = (2 * (column + offset) / columns.width - 1) * halfWidth
        average += intensityAt(model, sinFromPosition(x, model.distance)) / 4
      }
      const brightness = average ** 0.55
      const white = 50 * brightness
      const index = 4 * column
      columns.data[index] = 7 + 185 * red * brightness + white
      columns.data[index + 1] = 13 + 179 * green * brightness + white
      columns.data[index + 2] = 13 + 179 * blue * brightness + white
      columns.data[index + 3] = 255
    }
    context.putImageData(columns, 0, 0)
    context.imageSmoothingEnabled = false
    context.drawImage(canvas, 0, 0, canvas.width, 1, 0, 0, width, height)

    const center = width / 2
    context.strokeStyle = 'rgba(255,255,255,.6)'
    context.beginPath()
    context.moveTo(center, height - 8)
    context.lineTo(center, height)
    context.stroke()
  }, [halfWidth, model, wavelengthNm])

  useCanvas(plot, drawPlot)
  useCanvas(screen, drawScreen)

  return (
    <section className="visual-card" aria-labelledby="chart-title">
      <div className="visual-header">
        <div>
          <h2 id="chart-title">遠場強度分布</h2>
          <p>相對強度 <span className="mono">I / I₀</span></p>
        </div>
        <div className="chart-toggles">
          {!single && <button type="button" aria-pressed={envelope} onClick={() => setEnvelope(!envelope)}>
            <span className="legend-line envelope-line" /> 包絡線
          </button>}
          <button type="button" aria-pressed={markers} onClick={() => setMarkers(!markers)}>
            <Crosshair size={14} aria-hidden="true" /> 位置標記
          </button>
        </div>
      </div>
      <div className="chart-legend">
        <span><i className="legend-line" />總強度</span>
        {envelope && !single && <span><i className="legend-line envelope-line" />單縫包絡</span>}
        {markers && <>
          <span><i className="legend-order" />{single ? '理論暗紋' : '理論干涉級次'}</span>
          <span><i className="legend-peak" />實際局部極大</span>
          {!single && <span><i className="legend-missing">×</i>缺級</span>}
        </>}
      </div>
      <div className="plot-area">
        <canvas className="plot-canvas" tabIndex={0} ref={plot}
          aria-label="強度曲線。使用左右方向鍵量測屏幕位置，理論位置與局部極大也可在下方數值表查閱。"
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const fraction = (event.clientX - rect.left - plotLeft) / (rect.width - plotLeft - plotRight)
            setProbe(Math.max(-1, Math.min(1, 2 * fraction - 1)))
          }}
          onPointerLeave={() => setProbe(null)}
          onBlur={() => setProbe(null)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setProbe(null)
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              const step = event.shiftKey ? 0.1 : 0.01
              setProbe((current) => Math.max(-1, Math.min(1, (current ?? 0) + (event.key === 'ArrowLeft' ? -step : step))))
            }
          }}
        />
        {probeIntensity !== null && <div className="plot-probe-area" aria-hidden="true">
          <div className="plot-probe-line" style={{ left: probeLeft }}>
            <span style={{ top: `${100 * (1 - probeIntensity)}%` }} />
          </div>
        </div>}
      </div>
      <div className="screen-section">
        <div className="screen-heading">
          <h3><ScanLine size={16} aria-hidden="true" /> 屏幕亮紋</h3>
          <span className="screen-meta">λ = {formatWavelength(wavelengthNm)} nm <span className="screen-dot">·</span> 亮度 ∝ I<sup>0.55</sup></span>
        </div>
        <div className="screen-image">
          <canvas ref={screen} className="screen-canvas" role="img" aria-label="依照波長上色的屏幕亮紋"
            data-wavelength={wavelengthNm} />
          {probe !== null && <div className="screen-probe" aria-hidden="true" style={{ left: probeLeft }} />}
        </div>
      </div>
      <div className="chart-footer">
        <div className="chart-probe">
          {probeX === null || probeIntensity === null
            ? <span>屏幕範圍 ±{compactNumber(halfWidth * displayFactor)} {unit}</span>
            : <span>x = {compactNumber(probeX * displayFactor)} {unit} · I / I₀ = {compactNumber(probeIntensity)}</span>}
        </div>
        <label className="scale-select">
          <Expand size={14} aria-hidden="true" />
          <span className="sr-only">屏幕檢視範圍</span>
          <select value={scale} onChange={(event) => onScaleChange(event.target.value as ScreenScale)}>
            <option value="near">近看 · 0.5×</option>
            <option value="auto">自動範圍</option>
            <option value="wide">廣角 · 2×</option>
            <option value="far">廣角 · 2.5×</option>
          </select>
        </label>
      </div>
    </section>
  )
}
