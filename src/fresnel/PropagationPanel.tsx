import { useEffect, useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { apertureKey, apertureRadius, limits, shapes, spacingRatio, type Shape } from '../farfield/apertures'
import { formatAngle, formatFresnel, formatMm, formatSize } from '../format'
import { Parameter, ScaleSelector, toAperture, withApertureSize, type Settings } from '../farfield/FarFieldControls'
import type { IntensityScale } from '../farfield/intensity'
import { lessons } from '../farfield/shapeLessons'
import type { FrameInput } from './frames'
import { comparisonFactors, type Normalization } from './observation'
import { OpticalPath } from './OpticalPath'
import { comparisonWindow, distanceAt, distanceBounds, distancePosition, fresnelNumber } from './propagation'
import { PropagationObservation } from './PropagationObservation'
import { PropagationPlot } from './PropagationPlot'
import { PropagationPrinciples } from './PropagationPrinciples'
import { TeachingExperiments } from './TeachingExperiments'
import type { TeachingPreset } from './teachingPresets'
import { useFresnel } from './useFresnel'

export default function PropagationPanel({ active, settings, changeSettings }: {
  active: boolean
  settings: Settings
  changeSettings: (settings: Settings) => void
}) {
  const { shape, sizeUm, spacingUm, angle, wavelengthNm } = settings
  const aperture = useMemo(() => toAperture(settings), [shape, sizeUm, spacingUm, angle])
  const wavelength = wavelengthNm * 1e-9
  const bounds = distanceBounds(aperture, wavelength)
  const [requestedDistance, setRequestedDistance] = useState(bounds.initial)
  const [draftDistance, setDraftDistance] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [fixedHalfWidth, setFixedHalfWidth] = useState<number | null>(() => 2 * apertureRadius(aperture))
  const [activePreset, setActivePreset] = useState<TeachingPreset | null>(null)
  const [scale, setScale] = useState<IntensityScale>('log')
  const [normalization, setNormalization] = useState<Normalization>('individual')
  const distance = Math.min(bounds.max, Math.max(bounds.min, requestedDistance))
  const progress = Math.min(100, Math.max(0, distancePosition(distance, bounds.min, bounds.max)))
  const light = useMemo(() => ({ wavelength, distance }), [wavelength, distance])
  const { halfWidth, adequate, limited, limitReason } = comparisonWindow(aperture, light, fixedHalfWidth ?? false)
  const number = fresnelNumber(aperture, light)
  const fieldKey = [apertureKey(aperture), aperture.size, wavelength, distance, halfWidth].join(':')
  const input = useMemo<FrameInput>(() => ({ aperture, light, halfWidth, preview: dragging }), [aperture, light, halfWidth, dragging])
  const { current, workerError } = useFresnel(input, fieldKey, active && adequate)
  const reply = current?.reply
  const field = reply && 'field' in reply ? reply.field : undefined
  const failure = workerError || (reply && 'error' in reply ? reply.error : '')
  const status = failure || (adequate ? (field ? '' : '正在計算目前距離的圖樣…') : '取樣條件不足，請調整孔徑、波長或距離。')
  const minimumMm = bounds.min * 1000
  const maximumMm = bounds.max * 1000
  const invalidInput = draftDistance !== null && (draftDistance.trim() === '' || !Number.isFinite(Number(draftDistance))
    || Number(draftDistance) < minimumMm || Number(draftDistance) > maximumMm)
  const factors = comparisonFactors(field?.peaks, normalization)
  const lesson = lessons[shape]
  const apertureLabel = `${lesson.title} · ${lesson.size} ${formatSize(sizeUm)} μm · ${formatAngle(angle)}°`
    + (shape === 'double-circle' ? ` · 中心距 ${formatSize(spacingUm)} μm` : '')
  const diffractionScale = wavelength * distance / aperture.size
  const narrowView = adequate && fixedHalfWidth !== null && halfWidth < diffractionScale * 1.5

  useEffect(() => {
    if (!dragging) return
    const finish = () => setDragging(false)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    window.addEventListener('blur', finish)
    return () => {
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      window.removeEventListener('blur', finish)
    }
  }, [dragging])

  function changeOptics(next: Settings) {
    if (activePreset && next.shape !== activePreset.shape) setActivePreset(null)
    setRequestedDistance(distance)
    setDraftDistance(null)
    changeSettings(next)
  }

  function updateDistance(distance: number) {
    setRequestedDistance(distance)
    setDraftDistance(null)
  }

  function applyPreset(preset: TeachingPreset) {
    setActivePreset(preset)
    changeSettings({ ...withApertureSize(settings, preset.sizeUm), shape: preset.shape,
      angle: preset.angle, wavelengthNm: preset.wavelengthNm })
    updateDistance(preset.distanceM)
    setFixedHalfWidth(null)
    setScale('log')
    setNormalization('individual')
  }

  return <section className="propagation-panel" aria-label="近遠場比較">
    <OpticalPath aperture={aperture} sizeUm={sizeUm} wavelengthNm={wavelengthNm} distance={distance} position={progress} number={number} />
    <TeachingExperiments active={activePreset} apply={applyPreset} />

    <section className="control-card propagation-controls" aria-label="近遠場控制">
      <div className="propagation-heading">
        <h2>實驗參數</h2>
        <div className="propagation-readout">
          <span>傳播距離 z <output data-current-distance={distance}>{formatMm(distance)} mm</output></span>
          <span>Fresnel 數 N<sub>F</sub> <output>{formatFresnel(number)}</output></span>
        </div>
      </div>
      <div className="propagation-settings">
        <label>共同孔徑 <select value={shape} onChange={(event) => changeOptics({ ...settings, shape: event.target.value as Shape })}>
          {shapes.map((id) => <option key={id} value={id}>{lessons[id].title}</option>)}
        </select></label>
        <label>屏幕視野 <select value={fixedHalfWidth !== null ? 'fixed' : 'auto'}
          onChange={(event) => setFixedHalfWidth(event.target.value === 'fixed' ? halfWidth : null)}>
          <option value="fixed">固定視野{fixedHalfWidth !== null && ` ±${formatMm(fixedHalfWidth)} mm`}</option>
          <option value="auto">自動取景</option>
        </select></label>
        <label>強度歸一化 <select value={normalization} onChange={(event) => setNormalization(event.target.value as Normalization)}>
          <option value="individual">各圖自身峰值</option>
          <option value="shared">共同基準</option>
        </select></label>
        <ScaleSelector scale={scale} change={setScale} />
      </div>

      <div className="propagation-parameters">
        <Parameter label="孔徑尺寸" unit="μm" {...limits.size} value={sizeUm}
          change={(size) => changeOptics(withApertureSize(settings, size))} />
        <Parameter label="旋轉角度" unit="°" {...limits.angle} value={angle}
          change={(value) => changeOptics({ ...settings, angle: value })} />
        <Parameter label="波長" unit="nm" {...limits.wavelength} value={wavelengthNm}
          change={(value) => changeOptics({ ...settings, wavelengthNm: value })} />
        {shape === 'double-circle' && <Parameter label="雙圓孔中心間距" unit="μm"
          min={sizeUm * spacingRatio.min} max={sizeUm * spacingRatio.max}
          value={spacingUm} change={(value) => changeOptics({ ...settings, spacingUm: value })} />}
      </div>
      <div className="propagation-manual">
        <label htmlFor="propagation-distance-slider">傳播距離 z</label>
        <input id="propagation-distance-slider" className="slider" aria-label="傳播距離滑桿"
          aria-valuetext={`${formatMm(distance)} mm`} aria-describedby="propagation-range"
          type="range" min="0" max="100" step="any" value={progress}
          style={{ '--fill': progress + '%' } as React.CSSProperties}
          onPointerDown={() => setDragging(true)}
          onChange={(event) => updateDistance(distanceAt(event.currentTarget.valueAsNumber, bounds.min, bounds.max))} />
        <label className="propagation-distance">
          <input aria-label="傳播距離" inputMode="decimal" type="number" step="any" min={minimumMm} max={maximumMm}
            value={draftDistance ?? formatMm(distance)}
            aria-invalid={invalidInput} aria-describedby="propagation-range"
            onChange={(event) => {
              const mm = event.currentTarget.valueAsNumber
              setDraftDistance(event.currentTarget.value)
              if (mm >= minimumMm && mm <= maximumMm) setRequestedDistance(mm * 1e-3)
            }}
            onBlur={() => { if (!invalidInput) setDraftDistance(null) }} /> mm
        </label>
        <button type="button" className="ff-secondary" onClick={() => updateDistance(bounds.initial)}>
          <RotateCcw size={15} aria-hidden="true" /> 重設距離
        </button>
      </div>
      <p id="propagation-range" className={invalidInput ? 'ff-input-error' : 'propagation-hint'}>
        {invalidInput && '距離超出有效範圍。'}
        {distance !== requestedDistance && '已依目前條件將距離調整至可用範圍。'}
        可用距離 {formatMm(bounds.min)}–{formatMm(bounds.max)} mm · 滑桿採對數距離
      </p>
    </section>

    <section className="propagation-results" aria-labelledby="propagation-result-title">
      <div className="propagation-comparison-heading">
        <h2 id="propagation-result-title">繞射圖案比較</h2>
        <p>兩圖共用實際屏幕視野和色階。各圖自身峰值模式把每張圖的可見最大強度設為 1，便於比較圖樣。
          共同基準以相同入射振幅計算，兩圖都除以其中較高的可見峰值，保留模型預測的強度比例。</p>
      </div>
      {failure && <p className="ff-input-error" role="alert">{failure}</p>}
      {!adequate && !failure && <p className="propagation-view-warning">目前的孔徑取樣或有效視野不足。請調整孔徑尺寸、間距或傳播距離。</p>}
      {adequate && limited && <p className="propagation-view-warning">受{limitReason}限制，本次只比較 ±{formatMm(halfWidth)} mm 的有效區域。</p>}
      {narrowView && <p className="propagation-view-warning">固定視野只涵蓋中央附近。遠場代表尺度 λz／D 約 {formatMm(diffractionScale)} mm，切換「自動取景」可查看外側暗紋與旁瓣。</p>}
      <div className="propagation-grid" aria-busy={adequate && !field && !failure}>
        <PropagationPlot title="Fresnel 近場" field={field?.near} side={field?.side ?? 0} halfWidth={field?.halfWidth ?? halfWidth}
          scale={scale} distance={distance} status={status} apertureLimit={limited} normalization={normalization}
          intensityFactor={factors.near} apertureLabel={apertureLabel} wavelength={wavelengthNm} />
        <PropagationPlot title="Fraunhofer 遠場近似" field={field?.far} side={field?.side ?? 0} halfWidth={field?.halfWidth ?? halfWidth}
          scale={scale} distance={distance} status={status} apertureLimit={limited} normalization={normalization}
          intensityFactor={factors.far} apertureLabel={apertureLabel} wavelength={wavelengthNm}
          warning={'同一傳播距離下的 Fraunhofer 理論近似'
            + (number > 0.1 ? '。此條件下近似誤差可能偏大。' : '。')} />
      </div>
    </section>

    <PropagationObservation aperture={aperture} light={light} field={field} />
    <PropagationPrinciples aperture={aperture} light={light} number={number} />
  </section>
}
