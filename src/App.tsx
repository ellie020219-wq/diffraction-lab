import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Aperture, BookOpen, Columns2, Grid2X2, Waves } from 'lucide-react'
import { Controls } from './Controls'
import { PatternChart, screenScales, type ScreenScale } from './PatternChart'
import { Results } from './Results'
import { SlitDiagram } from './SlitDiagram'
import { farFieldRatio, localMaxima, samplePattern, sinFromPosition, theory } from './optics'
import { automaticHalfWidth, defaults, greenGrating, toModel, type Mode, type Settings } from './settings'

const FarFieldPage = lazy(() => import('./farfield/FarFieldPage'))

function subscribeHash(change: () => void) {
  window.addEventListener('hashchange', change)
  return () => window.removeEventListener('hashchange', change)
}

const modes = [
  { id: 'single', label: '單狹縫', icon: Waves },
  { id: 'double', label: '雙狹縫', icon: Columns2 },
  { id: 'grating', label: 'N 縫光柵', icon: Grid2X2 },
] as const

export default function App() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash)
  const showFarField = hash === '#/farfield'

  useEffect(() => {
    if (showFarField) window.scrollTo(0, 0)
    else if (['#experiment', '#results', '#model'].includes(hash)) {
      document.getElementById(hash.slice(1))?.scrollIntoView()
    }
  }, [hash, showFarField])

  const [mode, setMode] = useState<Mode>('double')
  const [allSettings, setAllSettings] = useState<Record<Mode, Settings>>({
    single: defaults,
    double: defaults,
    grating: defaults,
  })
  const [scale, setScale] = useState<ScreenScale>('auto')
  const settings = allSettings[mode]
  const { optics, widthToPitch } = useMemo(() => toModel(mode, settings), [mode, settings])
  const halfWidth = automaticHalfWidth(optics) * screenScales[scale]
  const visibleU = sinFromPosition(halfWidth, optics.distance)
  const allTheory = useMemo(() => theory(optics, widthToPitch), [optics, widthToPitch])
  const visibleTheory = useMemo(() => allTheory.filter(({ x }) =>
    x !== null && Math.abs(x) <= halfWidth * (1 + 8 * Number.EPSILON)), [allTheory, halfWidth])
  const maxima = useMemo(() => localMaxima(optics, visibleU), [optics, visibleU])
  const samples = useMemo(() => samplePattern(optics, halfWidth, maxima, visibleTheory),
    [optics, halfWidth, maxima, visibleTheory])

  function changeSettings(next: Settings) {
    setAllSettings((previous) => ({ ...previous, [mode]: next }))
  }

  return (
    <>
      <a className="skip-link" href={showFarField ? "#/farfield" : "#experiment"}
        onClick={showFarField ? (event) => {
          event.preventDefault()
          const main = document.getElementById("farfield-content")
          main?.focus()
          main?.scrollIntoView()
        } : undefined}>跳至模擬實驗</a>
      <header className="site-header">
        <div className="header-inner">
          <a href="#" className="brand"><span className="brand-icon"><Aperture size={22} aria-hidden="true" /></span>
            光學實驗室
          </a>
          <nav aria-label="網站導覽">
            <a href="#experiment">模擬實驗</a>
            <a href="#results">理論數值</a>
            <a href="#model"><BookOpen size={15} aria-hidden="true" /> 模型說明</a>
            <a className="nav-farfield" href="#/farfield" aria-current={showFarField ? 'page' : undefined}>形狀 → 遠場繞射</a>
          </nav>
        </div>
      </header>
      <main className="page" hidden={showFarField}>
        <div className="intro">
          <span className="intro-label"><span /> Fraunhofer 遠場模擬</span>
          <h1>光的干涉與繞射</h1>
          <p>調整光源與狹縫，觀察屏幕上的光如何形成亮紋與暗紋。</p>
        </div>
        <section id="experiment" aria-label="模擬實驗">
          <div className="mode-selector" role="group" aria-label="狹縫模式">
            {modes.map(({ id, label, icon: Icon }) => (
              <button type="button" key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>
                <Icon size={19} strokeWidth={1.8} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          <div className="experiment-layout">
            <Controls key={mode} mode={mode} settings={settings} onChange={changeSettings}
              farRatio={farFieldRatio(optics)}
              onReset={() => { changeSettings(defaults); setScale('auto') }}
              onGratingExample={() => { changeSettings(greenGrating); setScale('auto') }} />
            <div className="experiment-output">
              <SlitDiagram slitWidth={optics.slitWidth} slitPitch={optics.slitPitch} slitCount={optics.slitCount} />
              <PatternChart model={optics} wavelengthNm={settings.wavelengthNm} samples={samples}
                halfWidth={halfWidth} theory={visibleTheory} maxima={maxima} scale={scale} onScaleChange={setScale} />
              <Results key={mode} single={mode === 'single'} visible={visibleTheory} all={allTheory} maxima={maxima} />
            </div>
          </div>
        </section>
        <section className="model-section" id="model" aria-labelledby="model-title">
          <h2 id="model-title"><BookOpen size={20} aria-hidden="true" /> 模型說明</h2>
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
      </main>
      {showFarField && <Suspense fallback={<p className="page ff-loading" role="status">正在載入遠場繞射實驗…</p>}>
        <FarFieldPage />
      </Suspense>}
      <footer className="site-footer"><Aperture size={16} aria-hidden="true" /> 光的干涉與繞射互動實驗室</footer>
    </>
  )
}
