import { useId, useMemo } from 'react'
import { Aperture as ApertureIcon } from 'lucide-react'
import { apertureRadius, apertureSampler, type Aperture } from '../farfield/apertures'
import { formatMm } from '../farfield/FarFieldCanvas'
import { lessons } from '../farfield/shapeLessons'

const cells = 96

function apertureSilhouette(aperture: Aperture) {
  const sample = apertureSampler(aperture)
  const step = 2.1 * apertureRadius(aperture) / cells
  const shape: string[] = []
  for (let row = 0; row < cells; row++) {
    const y = (cells / 2 - row - 0.5) * step
    let start = 0
    let inside = false
    for (let column = 0; column <= cells; column++) {
      const open = column < cells && sample((column + 0.5 - cells / 2) * step, y)
      if (open && !inside) start = column
      if (!open && inside) shape.push(`M${start} ${row}h${column - start}v1H${start}z`)
      inside = open
    }
  }
  return shape.join('')
}

export function OpticalPath({ aperture, sizeUm, wavelengthNm, distance, position }: {
  aperture: Aperture
  sizeUm: number
  wavelengthNm: number
  distance: number
  position: number
}) {
  const arrow = useId()
  const outline = useMemo(() => apertureSilhouette(aperture), [aperture])
  const radius = apertureRadius(aperture)
  const opening = Math.max(26, Math.min(76, 26 + 17 * Math.log10(radius / 10e-6)))
  const plateX = 261
  const centerY = 78
  // The slider expresses log distance. Use its bounded span for the sketch.
  const screenX = 432 + 275 * position / 100
  const waveOrigin = plateX + 48
  const wavefronts = Array.from({ length: 4 }, (_, i) => waveOrigin + (screenX - waveOrigin) * (i + 1) / 5)
  const lesson = lessons[aperture.shape]

  return <section className="control-card propagation-path" aria-labelledby="propagation-path-title">
    <div className="propagation-path-heading">
      <h2 id="propagation-path-title"><ApertureIcon size={19} aria-hidden="true" /> 光學實驗架構</h2>
      <span>示意圖，非實際比例</span>
    </div>
    <figure>
      <svg viewBox="0 0 768 171" className="propagation-path-sketch" role="img"
        aria-label={`平行入射波由雷射光源穿過${lesson.title}，向右傳播至 ${formatMm(distance)} mm 外的屏幕`}>
        <defs>
          <marker id={arrow} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto-start-reverse">
            <path d="M1 1L5.5 3.5L1 6" fill="none" stroke="#a4c3b6" strokeWidth="1.15" />
          </marker>
        </defs>
        <path d={`M 38 ${centerY} H ${screenX}`} className="path-axis" />
        <path d="M 35 59 H 103 L 117 66 V 90 L 103 97 H 35 Q 29 97 29 91 V 65 Q 29 59 35 59Z" className="path-laser" />
        <path d="M 42 66 H 97 M 42 90 H 97" className="path-housing" />
        <rect x="113" y="65" width="10" height="26" rx="3" className="path-opening" />
        {[150, 177, 204].map(x => <path key={x} className="path-incident" d={`M${x} 51 V 105`} />)}
        <path d="M 142 41 H 217" className="path-direction" markerEnd={`url(#${arrow})`} />
        <rect x={plateX - 48} y={30} width={96} height={96} rx={7} className="path-plate" />
        <path className="path-opening" d={outline} transform={`translate(${plateX - opening / 2} ${centerY - opening / 2}) scale(${opening / cells})`}
          data-aperture-outline="true" data-size={sizeUm} data-angle={aperture.angle} />
        {wavefronts.map((x, index) => {
          const spread = 11 + 9 * index
          return <path key={index} className="path-diffracted" opacity={0.89 - index * 0.12}
            d={`M ${x - 8} ${centerY - spread} Q ${x + 12} ${centerY} ${x - 8} ${centerY + spread}`} />
        })}
        <path d={`M ${plateX + 60} 23 H ${screenX - 23}`} className="path-direction" markerEnd={`url(#${arrow})`} />
        <g transform={`translate(${screenX} 0)`} data-screen-position={screenX}>
          <rect x="-4" y="33" width="10" height="91" rx="2" className="path-screen" />
          <path d="M 1 67 V 89" className="path-screen-mark" />
          <path d="M 6 124 L 16 133 H -15 L -4 124" className="path-laser" />
        </g>
        <path d={`M ${plateX} 129 V 154 M ${screenX} 135 V 154`} className="path-measure" />
        <text x={(plateX + screenX) / 2} y="145" className="path-distance-symbol">z</text>
        <path d={`M ${plateX + 5} 151 H ${screenX - 5}`} className="path-direction"
          markerStart={`url(#${arrow})`} markerEnd={`url(#${arrow})`} />
      </svg>
      <figcaption className="propagation-path-labels">
        <div><strong>雷射光源</strong><span>平行入射波 · λ = {wavelengthNm} nm</span></div>
        <div><strong>孔徑 Aperture</strong><span>{lesson.title} · {lesson.size} {sizeUm} μm · {aperture.angle}°</span></div>
        <div><strong>自由空間傳播</strong><span>波前向右傳播 · z = {formatMm(distance)} mm</span></div>
        <div><strong>觀察屏幕 Screen</strong><span>在 x、y 平面取樣強度</span></div>
      </figcaption>
    </figure>
  </section>
}
