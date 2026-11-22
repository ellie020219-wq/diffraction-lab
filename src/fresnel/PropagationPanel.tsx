import { useEffect, useMemo, useState } from 'react'
import { Info, Pause, Play, RotateCcw } from 'lucide-react'
import { apertureKey, apertureRadius, shapes, type Shape } from '../farfield/apertures'
import { formatMm } from '../farfield/FarFieldCanvas'
import { ScaleSelector, toAperture, type Settings } from '../farfield/FarFieldControls'
import type { IntensityScale } from '../farfield/intensity'
import { lessons } from '../farfield/shapeLessons'
import type { FrameInput } from './frames'
import { comparisonWindow, distanceAt, distanceBounds, distancePosition, fresnelNumber } from './propagation'
import { PropagationPlot } from './PropagationPlot'
import { useFresnel } from './useFresnel'

export default function PropagationPanel({ settings, selectShape }: {
  settings: Settings
  selectShape: (shape: Shape) => void
}) {
  const { shape, sizeUm, spacingUm, angle, wavelengthNm } = settings
  const aperture = useMemo(() => toAperture(settings), [shape, sizeUm, spacingUm, angle])
  const wavelength = wavelengthNm * 1e-9
  const bounds = distanceBounds(aperture, wavelength)
  const [position, setPosition] = useState<number | null>(null)
  const [draftDistance, setDraftDistance] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [fixed, setFixed] = useState(true)
  const [scale, setScale] = useState<IntensityScale>('log')
  const progress = position ?? distancePosition(bounds.initial, bounds.min, bounds.max)
  const distance = position === null ? bounds.initial : distanceAt(progress, bounds.min, bounds.max)
  const light = useMemo(() => ({ wavelength, distance }), [wavelength, distance])
  const { halfWidth, adequate, limited } = comparisonWindow(aperture, light, fixed)
  const number = fresnelNumber(aperture, light)
  const fieldKey = [apertureKey(aperture), aperture.size, wavelength, distance, halfWidth].join(':')
  const input = useMemo<FrameInput>(() => ({ aperture, light, halfWidth, preview: playing }), [aperture, light, halfWidth, playing])
  const { current, workerError } = useFresnel(input, fieldKey, adequate)
  const reply = current?.reply
  const field = reply && 'field' in reply ? reply.field : undefined
  const failure = workerError || (reply && 'error' in reply ? reply.error : '')
  const status = failure || (adequate ? (field ? '' : '正在計算目前距離的圖樣…') : '取樣條件不足，請調整孔徑、波長或距離。')
  const minimumMm = bounds.min * 1000
  const maximumMm = bounds.max * 1000
  const invalidInput = draftDistance !== null && (draftDistance.trim() === '' || !Number.isFinite(Number(draftDistance))
    || Number(draftDistance) < minimumMm || Number(draftDistance) > maximumMm)

  useEffect(() => {
    if (!playing || !field) return
    if (progress >= 100) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => setPosition(Math.min(100, progress + 3.75)), 145)
    return () => clearTimeout(timer)
  }, [field, progress, playing])

  function setDistancePosition(position: number | null) {
    setPlaying(false)
    setDraftDistance(null)
    setPosition(position)
  }

  function togglePlayback() {
    if (!playing) {
      setDraftDistance(null)
      if (progress >= 100) setPosition(0)
    }
    setPlaying(!playing)
  }

  return <section className="propagation-panel" aria-label="近遠場比較">
    <section className="control-card propagation-controls" aria-label="近遠場控制">
      <div className="propagation-heading">
        <div>
          <h2>近遠場比較</h2>
          <p>以相同孔徑和距離比較兩種模型。兩圖各以畫面內的最大強度歸一化。</p>
        </div>
        <div className="propagation-readout">
          <span>傳播距離 z <output data-current-distance={distance}>{formatMm(distance)} mm</output></span>
          <span>Fresnel 數 N<sub>F</sub> <output>{number.toPrecision(4)}</output></span>
        </div>
      </div>
      <div className="propagation-settings">
        <label>共同孔徑 <select value={shape} onChange={(event) => { setPlaying(false); setDraftDistance(null); selectShape(event.target.value as Shape) }}>
          {shapes.map((id) => <option key={id} value={id}>{lessons[id].title}</option>)}
        </select></label>
        <p>{lessons[shape].size} {sizeUm} μm · {angle}° · {wavelengthNm} nm
          {shape === 'double-circle' && ` · 中心距 ${spacingUm} μm`}</p>
        <label>屏幕視野 <select value={fixed ? 'fixed' : 'auto'} onChange={(event) => setFixed(event.target.value === 'fixed')}>
          <option value="fixed">固定視野</option>
          <option value="auto">自動取景</option>
        </select></label>
        <ScaleSelector scale={scale} change={setScale} />
      </div>
      <div className="propagation-playback">
        <button type="button" className="ff-primary" onClick={togglePlayback} disabled={!playing && (!!failure || !adequate)}>
          {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {playing ? '暫停' : '播放'}
        </button>
        <input className="slider" aria-label="距離播放位置" aria-valuetext={`${formatMm(distance)} mm`}
          type="range" min="0" max="100" step="any" value={progress}
          style={{ '--fill': progress + '%' } as React.CSSProperties}
          onChange={(event) => setDistancePosition(event.currentTarget.valueAsNumber)} />
        <label className="propagation-distance">傳播距離
          <input aria-label="傳播距離" type="number" step="any" min={minimumMm} max={maximumMm}
            value={draftDistance ?? Number((distance * 1000).toPrecision(8))}
            aria-invalid={invalidInput} aria-describedby="propagation-range"
            onChange={(event) => {
              const mm = event.currentTarget.valueAsNumber
              setPlaying(false)
              setDraftDistance(event.currentTarget.value)
              if (mm >= minimumMm && mm <= maximumMm) setPosition(distancePosition(mm * 1e-3, bounds.min, bounds.max))
            }}
            onBlur={() => { if (!invalidInput) setDraftDistance(null) }} /> mm
        </label>
        <button type="button" className="ff-secondary" onClick={() => setDistancePosition(null)}>
          <RotateCcw size={15} aria-hidden="true" /> 重設距離
        </button>
      </div>
      <p id="propagation-range" className={invalidInput ? 'ff-input-error' : 'propagation-hint'}>
        {invalidInput && '距離超出有效範圍。'}可用距離 {formatMm(bounds.min)}–{formatMm(bounds.max)} mm · 滑桿採對數距離
      </p>
    </section>

    <div className={'ff-condition propagation-condition' + (number > 0.1 || !!failure ? ' has-warning' : '')}>
      <Info size={17} aria-hidden="true" />
      <div><p><strong>{number > 0.1 ? 'Fraunhofer 遠場近似誤差可能偏大' : '接近遠場條件'}</strong></p>
        <p>N<sub>F</sub> = R²／(λz)，此孔徑最遠透光點的半徑 R 為 {formatMm(apertureRadius(aperture))} mm。
          Fresnel 模型保留二次相位。N<sub>F</sub> 遠小於 1 時，Fraunhofer 近似與 Fresnel 圖樣逐漸接近。</p>
        {failure && <p role="alert">{failure}</p>}
      </div>
    </div>
    <div className="propagation-grid" aria-busy={adequate && !field && !failure}>
      <PropagationPlot title="Fresnel 近場" field={field?.near} side={field?.side ?? 0} halfWidth={field?.halfWidth ?? halfWidth}
        scale={scale} distance={distance} status={status} apertureLimit={limited} />
      <PropagationPlot title="Fraunhofer 遠場近似" field={field?.far} side={field?.side ?? 0} halfWidth={field?.halfWidth ?? halfWidth}
        scale={scale} distance={distance} status={status} apertureLimit={limited}
        warning={number > 0.1 ? '目前距離下的遠場近似預測' : undefined} />
    </div>
  </section>
}
