import { BookOpen } from 'lucide-react'
import { apertureRadius, type Aperture } from '../farfield/apertures'
import { formatMm } from '../farfield/FarFieldCanvas'
import type { Illumination } from '../farfield/intensity'

export function PropagationPrinciples({ aperture, light, number }: {
  aperture: Aperture
  light: Illumination
  number: number
}) {
  const wavelength = Number((1e9 * light.wavelength).toPrecision(6))
  const distance = formatMm(light.distance)
  return <details className="control-card propagation-principles">
    <summary><BookOpen size={19} aria-hidden="true" /> 物理原理</summary>
    <div className="propagation-theory">
      <section>
        <h3>惠更斯－菲涅耳原理 <span>Huygens–Fresnel principle</span></h3>
        <p>孔徑上每一個透光點都對屏幕上的場有貢獻。將這些帶有振幅與相位的次波相加，有些位置的波會增強，有些會互相抵消。圖上的波前用來表示這種傳播。</p>
        <p>網站以平行單色光垂直照射薄孔徑。改變孔徑尺寸或轉角，就會改變可透光的位置與各方向的干涉分布。</p>
      </section>
      <section>
        <h3>菲涅耳近場繞射 <span>Fresnel diffraction</span></h3>
        <div className="physics-formula" tabIndex={0}>
          <math display="block" aria-label="Fresnel 傳播公式">
            <mi>U</mi><mo>(</mo><mi>x</mi><mo>,</mo><mi>y</mi><mo>,</mo><mi>z</mi><mo>)</mo><mo>=</mo>
            <mfrac><msup><mi>e</mi><mrow><mi>i</mi><mi>k</mi><mi>z</mi></mrow></msup>
              <mrow><mi>i</mi><mi>λ</mi><mi>z</mi></mrow></mfrac>
            <mo>∬</mo><msub><mi>U</mi><mn>0</mn></msub><mo>(</mo><mi>ξ</mi><mo>,</mo><mi>η</mi><mo>)</mo>
            <mi>exp</mi><mo>(</mo>
            <mfrac>
              <mrow><mi>i</mi><mi>k</mi><mo>[</mo>
                <msup><mrow><mo>(</mo><mi>x</mi><mo>−</mo><mi>ξ</mi><mo>)</mo></mrow><mn>2</mn></msup><mo>+</mo>
                <msup><mrow><mo>(</mo><mi>y</mi><mo>−</mo><mi>η</mi><mo>)</mo></mrow><mn>2</mn></msup><mo>]</mo>
              </mrow>
              <mrow><mn>2</mn><mi>z</mi></mrow>
            </mfrac><mo>)</mo><mo>ⅆ</mo><mi>ξ</mi><mo>ⅆ</mo><mi>η</mi>
          </math>
        </div>
        <div className="physics-formula">
          <math display="block" aria-label="繞射強度公式">
            <mi>I</mi><mo>(</mo><mi>x</mi><mo>,</mo><mi>y</mi><mo>,</mo><mi>z</mi><mo>)</mo><mo>=</mo>
            <msup><mrow><mo>|</mo><mi>U</mi><mo>(</mo><mi>x</mi><mo>,</mo><mi>y</mi><mo>,</mo><mi>z</mi><mo>)</mo><mo>|</mo></mrow><mn>2</mn></msup>
          </math>
        </div>
        <p>(ξ, η) 是孔徑面座標，(x, y) 是屏幕座標，z 是面間距，λ 是波長。模型用公尺計算這些量，介面把 z 和屏幕座標換算為 mm、λ 換算為 nm。k = 2π／λ 是波數（rad/m），i 是虛數單位，e 與 exp 表示自然指數，ⅆξⅆη 是孔徑面積元素（m²）。U₀ 與 U 分別是孔徑面及屏幕的複振幅，以入射振幅為單位。I 為以入射強度為單位的相對強度。</p>
        <p>Fresnel 傍軸近似保留傳播相位的二次項。網站以補零 FFT 計算，依相位取樣、頻率有效範圍及高階相位誤差限制視野。孔徑與視野相對距離越大，越需要留意這些限制。此刻 λ = {wavelength} nm、z = {distance} mm。</p>
      </section>
      <section>
        <h3>夫朗和斐遠場繞射 <span>Fraunhofer diffraction</span></h3>
        <div className="physics-formula" tabIndex={0}>
          <math display="block" aria-label="Fraunhofer 二維傅立葉轉換公式">
            <msub><mi>U</mi><mtext>遠場</mtext></msub><mo>∝</mo><msub><mi>ℱ</mi><mn>2</mn></msub>
            <mo>[</mo><msub><mi>U</mi><mn>0</mn></msub><mo>]</mo><mo>(</mo>
            <msub><mi>f</mi><mi>x</mi></msub><mo>,</mo><msub><mi>f</mi><mi>y</mi></msub><mo>)</mo>
          </math>
        </div>
        <p>當孔徑上的二次相位變化足夠小，遠場複振幅 U<sub>遠場</sub> 的分布由孔徑透射場 U₀ 的二維傅立葉轉換 ℱ₂ 決定。f<sub>x</sub> = x／(λz)、f<sub>y</sub> = y／(λz) 是空間頻率（m⁻¹）。其中 x、y、λ 和 z 以公尺代入。</p>
        <p>改變 λ 或 z 會改變頻譜投影到屏幕的實際尺寸。Fresnel 的二次相位不可忽略時，此圖仍可作為遠場理論對照。</p>
      </section>
      <section>
        <h3>菲涅耳數 <span>Fresnel number</span></h3>
        <div className="physics-formula">
          <math display="block" aria-label="Fresnel 數公式">
            <msub><mi>N</mi><mi>F</mi></msub><mo>=</mo>
            <mfrac><msup><mi>R</mi><mn>2</mn></msup><mrow><mi>λ</mi><mi>z</mi></mrow></mfrac>
          </math>
        </div>
        <p>R 是從孔徑中心到最遠透光點的距離，與 λ、z 一同以公尺計算。N<sub>F</sub> 無單位。此孔徑 R = {formatMm(apertureRadius(aperture))} mm，目前 N<sub>F</sub> = {number.toPrecision(4)}。</p>
        <p>N<sub>F</sub> 越小，孔徑二次相位越弱，遠場近似通常越好。0.1 可作為教學參考。實際可接受的誤差取決於孔徑形狀、觀察視野和精度要求。</p>
      </section>
    </div>
  </details>
}
