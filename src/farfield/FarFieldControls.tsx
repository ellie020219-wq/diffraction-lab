import { useId, useState } from 'react'
import { Circle, CircleEllipsis, Hexagon, Pill, RotateCcw, SlidersHorizontal, Square, Triangle } from 'lucide-react'
import { limits, shapes, spacingRatio, type Aperture, type Shape } from './apertures'
import type { Illumination, IntensityScale } from './intensity'
import { lessons } from './shapeLessons'

export interface Settings {
  shape: Shape
  sizeUm: number
  angle: number
  spacingUm: number
  wavelengthNm: number
  distanceMm: number
}

export const defaultSettings: Settings = {
  shape: 'circle', sizeUm: 600, angle: 0, spacingUm: 1200, wavelengthNm: 632.8, distanceMm: 15000,
}

export function toAperture(settings: Settings): Aperture {
  return { shape: settings.shape, size: settings.sizeUm * 1e-6, angle: settings.angle, spacing: settings.spacingUm * 1e-6 }
}

export function toLight(settings: Settings): Illumination {
  return { wavelength: settings.wavelengthNm * 1e-9, distance: settings.distanceMm * 1e-3 }
}

const icons = { circle: Circle, square: Square, triangle: Triangle, hexagon: Hexagon, stadium: Pill, 'double-circle': CircleEllipsis }

export function ShapeSelector({ shape, change }: { shape: Shape; change: (shape: Shape) => void }) {
  return <div className="ff-shapes" role="group" aria-label="孔徑形狀">
    {shapes.map((id) => {
      const Icon = icons[id]
      return <button type="button" key={id} aria-pressed={id === shape} onClick={() => change(id)}>
        <Icon size={20} strokeWidth={1.65} aria-hidden="true" /> {lessons[id].title}
      </button>
    })}
  </div>
}

interface ParameterProps {
  label: string
  unit: string
  min: number
  max: number
  value: number
  change: (value: number) => void
}

function Parameter({ label, unit, min, max, value, change }: ParameterProps) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const input = draft === null ? value : Number(draft)
  const valid = draft !== '' && Number.isFinite(input) && input >= min && input <= max
  const numberLabel = (number: number) => Number(number.toFixed(6))
  function commit() {
    if (valid) setDraft(null)
  }

  return <div className="control ff-control">
    <div className="control-heading">
      <label htmlFor={id}>{label}</label>
      <div className="number-field">
        <input id={id} type="number" inputMode="decimal" step="any"
          min={min} max={max} value={draft ?? numberLabel(value)}
          aria-invalid={!valid} aria-describedby={!valid ? id + '-error' : undefined}
          onChange={(event) => {
            setDraft(event.currentTarget.value)
            const next = event.currentTarget.valueAsNumber
            if (next >= min && next <= max) change(next)
          }}
          onBlur={commit} onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') setDraft(null)
          }} />
        <span>{unit}</span>
      </div>
    </div>
    <input className="slider" aria-label={label + '滑桿'} type="range" min={min} max={max} step="any"
      value={value} style={{ '--fill': `${100 * (value - min) / (max - min)}%` } as React.CSSProperties}
      onChange={(event) => { setDraft(null); change(event.currentTarget.valueAsNumber) }} />
    {!valid && <p className="ff-input-error" id={id + '-error'}>請輸入 {numberLabel(min)} 至 {numberLabel(max)} {unit}。</p>}
  </div>
}

interface ControlsProps {
  settings: Settings
  change: (settings: Settings) => void
  reset: () => void
}

export function FarFieldControls({ settings, change, reset }: ControlsProps) {
  const { shape, sizeUm, spacingUm, angle, wavelengthNm, distanceMm } = settings
  const [resetId, setResetId] = useState(0)
  const [quickId, setQuickId] = useState(0)
  return <section className="control-card ff-controls" aria-labelledby="ff-controls-title">
    <div className="control-card-header">
      <h2 id="ff-controls-title"><SlidersHorizontal size={18} aria-hidden="true" /> 實驗參數</h2>
      <button type="button" className="reset" onClick={() => { setResetId(resetId + 1); reset() }}>
        <RotateCcw size={14} aria-hidden="true" /> 重設
      </button>
    </div>
    <div className="ff-fields" key={resetId}>
      <Parameter label="孔徑尺寸" unit="μm" {...limits.size} value={sizeUm}
        change={(size) => change({ ...settings, sizeUm: size,
          spacingUm: Math.min(size * spacingRatio.max, Math.max(size * spacingRatio.min, spacingUm)) })} />
      <Parameter label="旋轉角度" unit="°" {...limits.angle} value={angle} change={(value) => change({ ...settings, angle: value })} />
      <div>
        <Parameter key={quickId}
          label="波長" unit="nm" {...limits.wavelength} value={wavelengthNm} change={(value) => change({ ...settings, wavelengthNm: value })} />
        <div className="ff-wavelengths" role="group" aria-label="快速選擇波長">
          {[405, 532, 632.8].map((nm) => <button key={nm} type="button" aria-pressed={nm === wavelengthNm}
            onClick={() => { setQuickId(quickId + 1); change({ ...settings, wavelengthNm: nm }) }}>{nm} nm</button>)}
        </div>
      </div>
      <Parameter label="屏幕距離" unit="mm" {...limits.distance} value={distanceMm} change={(value) => change({ ...settings, distanceMm: value })} />
      {shape === 'double-circle' && <Parameter label="雙圓孔中心間距" unit="μm"
        min={sizeUm * spacingRatio.min} max={sizeUm * spacingRatio.max}
        value={spacingUm} change={(value) => change({ ...settings, spacingUm: value })} />}
    </div>
  </section>
}

export function ScaleSelector({ scale, change }: { scale: IntensityScale; change: (scale: IntensityScale) => void }) {
  return <div className="ff-scale" role="group" aria-label="強度刻度">
    <button type="button" aria-pressed={scale === 'log'} onClick={() => change('log')}>對數</button>
    <button type="button" aria-pressed={scale === 'linear'} onClick={() => change('linear')}>線性</button>
  </div>
}
