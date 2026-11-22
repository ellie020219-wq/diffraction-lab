import { useMemo, useState } from 'react'
import { Columns2, Grid2X2, Waves } from 'lucide-react'
import { Controls } from './Controls'
import { OpticalSetupDiagram } from './OpticalSetupDiagram'
import { PatternChart, screenScales, type ScreenScale } from './PatternChart'
import { Results } from './Results'
import { SlitDiagram } from './SlitDiagram'
import { farFieldRatio, localMaxima, samplePattern, sinFromPosition, theory } from './optics'
import { automaticHalfWidth, defaults, greenGrating, toModel, type Mode, type Settings } from './settings'

const modes = [
  { id: 'single', label: '單狹縫', icon: Waves },
  { id: 'double', label: '雙狹縫', icon: Columns2 },
  { id: 'grating', label: 'N 縫光柵', icon: Grid2X2 },
] as const

export function SlitExperiment({ mode, setMode }: { mode: Mode; setMode: (mode: Mode) => void }) {
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

  return <>
    <div className="intro">
      <span className="intro-label"><span /> Fraunhofer 遠場模擬</span>
      <h1>光的干涉與繞射</h1>
      <p>調整光源與狹縫，觀察屏幕上的光如何形成亮紋與暗紋。</p>
    </div>
    <nav className="experiment-links" aria-label="一維實驗導覽">
      <a href="#experiment">模擬實驗</a>
      <a href="#results">理論數值</a>
    </nav>
    <section id="experiment" aria-label="模擬實驗">
      <div className="mode-selector" role="group" aria-label="狹縫模式">
        {modes.map(({ id, label, icon: Icon }) => (
          <button type="button" key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>
            <Icon size={19} strokeWidth={1.8} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      <div className="experiment-layout">
        <OpticalSetupDiagram optics={optics} />
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
  </>
}
