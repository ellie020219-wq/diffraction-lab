import { BookOpen } from 'lucide-react'
import { routes } from './navigation'

export function ModelGuide() {
  return <>
    <div className="intro">
      <h1>模型說明</h1>
      <p>三個實驗都從垂直入射的單色平面波出發，各自計算觀察屏幕上的光強度。</p>
    </div>
    <section className="model-section" id="model" aria-labelledby="model-title">
      <h2 id="model-title"><BookOpen size={20} aria-hidden="true" /> 一維干涉與繞射</h2>
      <div className="model-grid">
        <div>
          <h3>屏幕位置如何換算角度？</h3>
          <p className="equation">sin θ = x / √(L² + x²)</p>
          <p>以屏幕中央為原點，使用完整幾何關係。角度較大時，等間隔的 sin θ 對應到越來越遠的屏幕位置。</p>
        </div>
        <div>
          <h3>理論級次在哪裡？</h3>
          <p className="equation">d sin θ = mλ</p>
          <p>方框標示理論干涉級次，實心圓標示總強度的局部極大。單縫包絡會改變峰值的高度，也可能移動峰值的位置。</p>
        </div>
        <div>
          <h3>什麼時候會缺級？</h3>
          <p className="equation">ma = pd，p ≠ 0</p>
          <p>當理論干涉級次與單縫暗紋重合，該處強度為零。例如縫距是縫寬的三倍時，每第三級缺級。</p>
        </div>
      </div>
      <p className="model-note">模型假設單色平面波垂直入射。總孔徑寬度 D = a + (N − 1)d。當 D²／(λL) &gt; 0.1，實驗會提示遠場近似的誤差可能偏大。</p>
    </section>
    <section className="model-section" aria-labelledby="model-two-d">
      <h2 id="model-two-d">二維孔徑繞射</h2>
      <div className="model-grid">
        <div>
          <h3>孔徑如何變成遠場圖案？</h3>
          <p className="equation">I ∝ |FFT₂(A)|²</p>
          <p>將孔徑表示為透光與遮光區，再做二維傅立葉轉換。<a href={routes.farfield}>前往繞射模擬</a></p>
        </div>
        <div>
          <h3>屏幕距離為何重要？</h3>
          <p className="equation">N<sub>F</sub> = R² / (λz)</p>
          <p>z 從孔徑平面量至屏幕。比較實驗在同一位置顯示 Fresnel 傳播與 Fraunhofer 遠場近似。<a href={routes.comparison}>前往近遠場比較</a></p>
        </div>
      </div>
    </section>
  </>
}
