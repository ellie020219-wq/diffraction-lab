import { useMemo } from 'react'
import { Telescope } from 'lucide-react'
import type { Aperture } from '../farfield/apertures'
import type { Illumination } from '../farfield/intensity'
import { explainObservation } from './observation'
import type { Comparison } from './propagation'

export function PropagationObservation({ aperture, light, field }: {
  aperture: Aperture
  light: Illumination
  field?: Comparison
}) {
  const entry = useMemo(() => explainObservation(aperture, light), [aperture, light])
  const center = field ? field.near[(field.near.length - 1) / 2] : null
  return <section className="control-card propagation-observation" aria-labelledby="propagation-observation-title">
    <div className="propagation-path-heading">
      <h2 id="propagation-observation-title"><Telescope size={19} aria-hidden="true" /> 目前觀察</h2>
      <div className="propagation-readout">
        <span>{entry.regime}</span>
        <span>N<sub>F</sub> <output>{entry.number.toPrecision(4)}</output></span>
      </div>
    </div>
    <dl>
      <div><dt>圖樣特徵</dt><dd>{entry.feature} {entry.spatialFeature}
        {center !== null && ` Fresnel 圖的中央強度約為該圖峰值的 ${(center * 100).toPrecision(3)}%。`}
      </dd></div>
      <div><dt>參數如何改變圖樣</dt><dd>{entry.cause}</dd></div>
      <div><dt>試著觀察</dt><dd>{entry.suggestion}</dd></div>
    </dl>
  </section>
}
