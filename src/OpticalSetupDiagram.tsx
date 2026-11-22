import { ScanLine } from 'lucide-react'
import { OpticalBench } from './OpticalBench'
import { formatLength, formatSize, formatWavelength } from './format'
import type { Optics } from './optics'

export function OpticalSetupDiagram({ optics }: { optics: Optics }) {
  const { wavelength, slitWidth, slitPitch, slitCount, distance } = optics
  return <section className="results-card optical-setup" aria-labelledby="optical-setup-title">
    <h2 id="optical-setup-title"><ScanLine size={19} aria-hidden="true" /> 光學實驗架構示意圖</h2>
    <figure>
      <OpticalBench aperture={slitCount} distanceSymbol="L"
        label={`平行單色光垂直入射 ${slitCount} 條狹縫，經自由空間傳至觀察屏幕`} />
      <div className="propagation-path-labels">
        <div><strong>平行單色光源</strong><span>λ = {formatWavelength(wavelength * 1e9)} nm</span></div>
        <div><strong>孔徑屏障</strong><span>a = {formatSize(slitWidth * 1e6)} μm · N = {slitCount}</span>
          {slitCount > 1 && <span>d = {formatSize(slitPitch * 1e6)} μm</span>}</div>
        <div><strong>自由空間傳播</strong><span>z = {formatLength(distance)} m（孔徑至屏幕）</span></div>
        <div><strong>觀察屏幕</strong><span>沿 x 方向觀察亮紋與暗紋</span></div>
      </div>
      <figcaption>教學示意，光源、孔徑與屏幕採示意比例。傳播距離 z 對應實驗參數中的 L。</figcaption>
    </figure>
  </section>
}
