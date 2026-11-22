import { MoveRight, ScanLine, Waves } from 'lucide-react'
import { formatLength, formatSize, formatWavelength } from './format'
import type { Optics } from './optics'

export function OpticalSetupDiagram({ optics }: { optics: Optics }) {
  const { wavelength, slitWidth, slitPitch, slitCount, distance } = optics
  return <section className="results-card optical-setup" aria-labelledby="optical-setup-title">
    <h2 id="optical-setup-title"><ScanLine size={19} aria-hidden="true" /> 光學實驗架構示意圖</h2>
    <figure>
      <ol className="optical-path">
        <li>
          <span className="optical-symbol optical-light" aria-hidden="true"><Waves size={23} /></span>
          <strong>平行單色光源</strong>
          <span className="optical-value">λ = {formatWavelength(wavelength * 1e9)} nm</span>
        </li>
        <li>
          <MoveRight className="optical-direction" size={20} aria-hidden="true" />
          <span className="optical-symbol optical-mask" aria-hidden="true" />
          <strong>孔徑屏障</strong>
          <span className="optical-value">a = {formatSize(slitWidth * 1e6)} μm · N = {slitCount}</span>
          {slitCount > 1 && <span className="optical-value">d = {formatSize(slitPitch * 1e6)} μm</span>}
        </li>
        <li>
          <MoveRight className="optical-direction" size={20} aria-hidden="true" />
          <span className="optical-symbol optical-screen" aria-hidden="true" />
          <strong>觀察屏幕</strong>
          <span className="optical-value">z = {formatLength(distance)} m（孔徑至屏幕）</span>
        </li>
      </ol>
      <figcaption>教學示意，光源、孔徑與屏幕採示意比例。傳播距離 z 對應實驗參數中的 L。</figcaption>
    </figure>
  </section>
}
