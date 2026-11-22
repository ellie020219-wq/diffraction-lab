import { useId, useState } from 'react'
import { FlaskConical, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { formatFresnel, formatParameter } from './format'
import { type Mode, type Settings } from './settings'

interface NumberControlProps {
  label: string
  symbol: string
  unit?: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  hint?: string
  spectral?: boolean
}

function NumberControl({
  label, symbol, unit, value, min, max, step, onChange, hint, spectral,
}: NumberControlProps) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const shown = formatParameter(value, unit)
  const withinBounds = (number: number) => number >= min && number <= max

  function commit() {
    if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))) {
      const number = Math.min(max, Math.max(min, Number(draft)))
      const committed = step === 1 ? Math.round(number) : number
      if (committed !== value) onChange(committed)
    }
    setDraft(null)
  }

  return (
    <div className="control">
      <div className="control-heading">
        <label htmlFor={id}>{label} <span className="symbol">{symbol}</span></label>
        <div className="number-field">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step === 1 ? 1 : 'any'}
            value={draft ?? shown}
            onChange={(event) => {
              const next = event.currentTarget.value
              setDraft(next)
              const number = event.currentTarget.valueAsNumber
              if (withinBounds(number) && (step !== 1 || Number.isInteger(number))) onChange(number)
            }}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            aria-describedby={hint ? id + '-hint' : undefined}
          />
          {unit && <span>{unit}</span>}
        </div>
      </div>
      <input
        className={spectral ? 'slider slider-spectral' : 'slider'}
        aria-label={label + '滑桿'}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${100 * (value - min) / Math.max(max - min, step)}%` } as React.CSSProperties}
        onChange={(event) => {
          setDraft(null)
          onChange(event.currentTarget.valueAsNumber)
        }}
      />
      {hint && <div className="control-hint" id={id + '-hint'}>{hint}</div>}
    </div>
  )
}

interface ControlsProps {
  mode: Mode
  settings: Settings
  onChange: (settings: Settings) => void
  onReset: () => void
  onGratingExample: () => void
  farRatio: number
}

export function Controls({ mode, settings, onChange, onReset, onGratingExample, farRatio }: ControlsProps) {
  const { wavelengthNm, widthUm, pitchUm, distanceM, count, density } = settings
  return (
    <aside className="control-card" aria-labelledby="controls-title">
      <div className="control-card-header">
        <h2 id="controls-title"><SlidersHorizontal size={18} aria-hidden="true" /> 實驗參數</h2>
        <button className="reset" type="button" onClick={onReset}>
          <RotateCcw size={14} aria-hidden="true" /> 重設
        </button>
      </div>
      <NumberControl label="波長" symbol="λ" unit="nm" value={wavelengthNm}
        min={380} max={780} step={0.1} spectral onChange={(value) => onChange({ ...settings, wavelengthNm: value })} />
      <NumberControl label="狹縫寬度" symbol="a" unit="μm" value={widthUm}
        min={0.2} max={mode === 'single' ? 160 : Math.min(160, pitchUm)} step={0.1}
        onChange={(value) => onChange({ ...settings, widthUm: value })} />
      {mode !== 'single' && <NumberControl label="狹縫間距" symbol="d" unit="μm" value={pitchUm}
        min={0.4} max={400} step={0.1}
        hint={density === null ? '相鄰狹縫的中心距離' : `${density} lines/mm · 相鄰狹縫的中心距離`}
        onChange={(value) => onChange({ ...settings, pitchUm: value, density: null, widthUm: Math.min(widthUm, value) })} />}
      <NumberControl label="屏幕距離" symbol="L" unit="m" value={distanceM}
        min={0.1} max={8} step={0.01} onChange={(value) => onChange({ ...settings, distanceM: value })} />
      {mode === 'grating' && <NumberControl label="狹縫數量" symbol="N" value={count}
        min={3} max={24} step={1} onChange={(value) => onChange({ ...settings, count: value })} />}

      {mode === 'grating' && (
        <button className="example-button" type="button" onClick={onGratingExample}>
          <FlaskConical size={16} aria-hidden="true" />
          <span>套用 532.0 nm／600 lines/mm</span>
        </button>
      )}
      <div className={farRatio > 0.1 ? 'condition condition-warning' : 'condition'} aria-live="polite">
        <div><span className="state-dot" />{farRatio > 0.1 ? '遠場近似誤差可能偏大' : '遠場條件良好'}</div>
        <span>D²／(λL) = {formatFresnel(farRatio)}</span>
      </div>
    </aside>
  )
}
