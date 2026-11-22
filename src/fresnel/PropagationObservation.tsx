import { useMemo } from 'react'
import { Telescope } from 'lucide-react'
import { formatFresnel } from '../format'
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
  const centerIndex = field ? (field.near.length - 1) / 2 : 0
  const nearCenter = field?.near[centerIndex]
  const farCenter = field?.far[centerIndex]
  const measured = nearCenter !== undefined && farCenter !== undefined
    ? `兩圖各以峰值為 100%，近場中央為 ${(nearCenter * 100).toPrecision(3)}%，遠場中央為 ${(farCenter * 100).toPrecision(3)}%。`
    : ''
  return <section className="control-card propagation-observation" aria-labelledby="propagation-observation-title">
    <div className="propagation-path-heading">
      <h2 id="propagation-observation-title"><Telescope size={19} aria-hidden="true" /> 目前觀察</h2>
      <div className="propagation-readout">
        <span>{entry.regime}</span>
        <span>N<sub>F</sub> <output>{formatFresnel(entry.number)}</output></span>
      </div>
    </div>
    <dl>
      <div><dt>兩圖的差異</dt><dd>{entry.feature} {measured}</dd></div>
      <div><dt>孔徑特徵</dt><dd>{entry.spatialFeature}</dd></div>
      <div><dt>參數如何改變圖樣</dt><dd>{entry.cause}</dd></div>
      <div><dt>試著觀察</dt><dd>{entry.suggestion}</dd></div>
    </dl>
  </section>
}
