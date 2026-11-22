import { Aperture as ApertureIcon } from 'lucide-react'
import type { Aperture } from '../farfield/apertures'
import { formatAngle, formatFresnel, formatMm, formatSize, formatWavelength } from '../format'
import { lessons } from '../farfield/shapeLessons'
import { OpticalBench } from '../OpticalBench'
import { propagationRegime } from './observation'

export function OpticalPath({ aperture, sizeUm, wavelengthNm, distance, position, number }: {
  aperture: Aperture
  sizeUm: number
  wavelengthNm: number
  distance: number
  position: number
  number: number
}) {
  const lesson = lessons[aperture.shape]

  return <section className="control-card propagation-path" aria-labelledby="propagation-path-title">
    <div className="propagation-path-heading">
      <h2 id="propagation-path-title"><ApertureIcon size={19} aria-hidden="true" /> 光學實驗架構</h2>
      <span>示意圖，非實際比例</span>
    </div>
    <figure>
      <OpticalBench aperture={aperture} position={position}
        label={`平行入射波由雷射光源穿過${lesson.title}，向右傳播至 ${formatMm(distance)} mm 外的屏幕`} />
      <figcaption className="propagation-path-labels">
        <div><strong>平行單色光</strong><span>入射光向右 · λ = {formatWavelength(wavelengthNm)} nm</span></div>
        <div><strong>孔徑平面 Aperture</strong><span>{lesson.title} · {lesson.size} {formatSize(sizeUm)} μm · {formatAngle(aperture.angle)}°</span></div>
        <div><strong>自由空間傳播</strong><span>波前向右傳播 · z = {formatMm(distance)} mm</span></div>
        <div><strong>觀察屏幕 Screen</strong><span>在 x、y 平面取樣強度</span></div>
      </figcaption>
    </figure>
    <div className="propagation-path-explanation">
      <span className="propagation-regime">{propagationRegime(number)} · N<sub>F</sub> = {formatFresnel(number)}</span>
      <p>屏幕越遠，繞射圖案逐漸接近 Fraunhofer 遠場分布。菲涅耳數用於估計近似程度，實際適用性隨孔徑形狀、取樣與精度要求而變。</p>
    </div>
  </section>
}
