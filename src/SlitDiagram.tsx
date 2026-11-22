import { Columns2 } from 'lucide-react'
import type { Optics } from './optics'

type SlitGeometry = Pick<Optics, 'slitWidth' | 'slitPitch' | 'slitCount'>

const micrometers = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 6, useGrouping: false })
const lengthLabel = (meters: number) => micrometers.format(meters * 1e6) + ' μm'

function Dimension({ start, end, label, className }: {
  start: number
  end: number
  label: string
  className: string
}) {
  return (
    <div className={className}>
      <span className="slit-dimension-rule" style={{ left: start + '%', width: (end - start) + '%' }} />
      <span className="slit-dimension-label" style={{ left: `clamp(5em, ${(start + end) / 2}%, 100% - 5em)` }}>{label}</span>
    </div>
  )
}

export function SlitDiagram({ slitWidth, slitPitch, slitCount }: SlitGeometry) {
  const isArray = slitCount > 1
  const extent = slitWidth + (slitCount - 1) * slitPitch
  const viewWidth = isArray ? extent / 0.76 : 240e-6
  const percent = (position: number) => 50 + 100 * position / viewWidth
  const openingPercent = 100 * slitWidth / viewWidth
  const centers = Array.from({ length: slitCount }, (_, index) => (index - (slitCount - 1) / 2) * slitPitch)
  const firstOfPair = Math.floor((slitCount - 1) / 2)
  const widthCenter = centers[Math.floor(slitCount / 2)]
  const width = lengthLabel(slitWidth)
  const pitch = lengthLabel(slitPitch)
  const showDetail = openingPercent < 2

  return (
    <section className="results-card slit-diagram" aria-labelledby="slit-diagram-title">
      <div className="slit-diagram-header">
        <h2 id="slit-diagram-title"><Columns2 size={19} aria-hidden="true" /> 即時狹縫示意圖</h2>
        <span className="slit-diagram-count">N = {slitCount}</span>
      </div>
      <figure className="slit-diagram-figure" aria-label={`狹縫寬度 a = ${width}，${isArray ? `中心距 d = ${pitch}，` : ''}狹縫數量 N = ${slitCount}`}>
        <div className="slit-overview">
          <Dimension className="slit-width-marker" start={percent(widthCenter - slitWidth / 2)}
            end={percent(widthCenter + slitWidth / 2)} label={`a = ${width}`} />
          <div className="slit-barrier" aria-hidden="true">
            {centers.map((center, index) => (
              <span className="slit-opening" key={index} style={{
                left: percent(center - slitWidth / 2) + '%',
                width: openingPercent + '%',
              }} />
            ))}
          </div>
          {isArray && <div className="slit-center-ticks" aria-hidden="true">
            {centers.map((center, index) => <i key={index} style={{ left: percent(center) + '%' }} />)}
          </div>}
          {isArray && <Dimension className="slit-pitch-marker" start={percent(centers[firstOfPair])}
            end={percent(centers[firstOfPair + 1])} label={`d = ${pitch}`} />}
        </div>
        {showDetail && <div className="slit-detail">
          <span>單縫局部放大</span>
          <div className="slit-detail-figure">
            <div className="slit-barrier" aria-hidden="true"><span className="slit-opening" style={{ left: '34%', width: '32%' }} /></div>
            <Dimension className="slit-pitch-marker" start={34} end={66} label={`a = ${width}`} />
          </div>
        </div>}
        <figcaption className="slit-diagram-legend">
          <span><i className="slit-legend-barrier" aria-hidden="true" /> 不透光屏障</span>
          <span><i className="slit-legend-opening" aria-hidden="true" /> 透光狹縫</span>
          {isArray && <span>下緣短線標出狹縫中心</span>}
        </figcaption>
      </figure>
    </section>
  )
}
