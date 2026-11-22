import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { AperturePlate, OpticalBench } from './OpticalBench'
import { shapes, type Shape } from './farfield/apertures'
import { defaultSettings, toAperture } from './farfield/FarFieldControls'
import { lessons } from './farfield/shapeLessons'
import { formatLength, formatMm, formatSize, formatWavelength } from './format'
import { routes } from './navigation'
import { defaults, type Mode } from './settings'

const slitExamples = {
  single: { label: '單狹縫', count: 1, detail: '一道窄縫就能形成中央亮紋和兩側暗紋。' },
  double: { label: '雙狹縫', count: 2, detail: '兩條狹縫透出的波彼此疊加，在屏幕上形成明暗相間的條紋。' },
  grating: { label: 'N 縫光柵', count: defaults.count, detail: '多條等間距狹縫讓光集中在特定方向，形成較窄的主亮紋。' },
} satisfies Record<Mode, { label: string; count: number; detail: string }>

const experiments = [
  { id: 'slits', title: '一維干涉與繞射', description: '比較單狹縫、雙狹縫與 N 縫光柵的亮紋。' },
  { id: 'farfield', title: '二維孔徑與遠場繞射', description: '用九種孔徑探索形狀如何決定遠場圖案。' },
  { id: 'comparison', title: '近場與遠場比較', description: '手動移動屏幕，同時比較 Fresnel 與 Fraunhofer 圖案。' },
] as const

type Experiment = typeof experiments[number]['id']
const slitModes = Object.keys(slitExamples) as Mode[]
const comparisonShapes: readonly Shape[] = ['circle', 'square', 'triangle']

export function LabHome({ chooseMode, chooseShape }: {
  chooseMode: (mode: Mode) => void
  chooseShape: (shape: Shape) => void
}) {
  const [experiment, setExperiment] = useState<Experiment>('slits')
  const [mode, setMode] = useState<Mode>('single')
  const [shape, setShape] = useState<Shape>('circle')
  const [nearShape, setNearShape] = useState<Shape>('circle')
  const isSlit = experiment === 'slits'
  const isComparison = experiment === 'comparison'
  const activeShape = isComparison ? nearShape : shape
  const example = slitExamples[mode]
  const lesson = lessons[activeShape]
  const aperture = isSlit ? example.count : toAperture({ ...defaultSettings, shape: activeShape })
  const apertureName = isSlit ? example.label : lesson.title
  const description = isSlit ? example.detail : isComparison
    ? '在同一屏幕比較兩種模型。改變 z，可觀察 Fresnel 圖案如何接近遠場分布。'
    : lesson.observation

  return <div className="lab-home">
    <div className="intro home-intro">
      <h1>光的干涉與繞射互動實驗室</h1>
      <p>從光源、孔徑到觀察屏幕，透過即時模擬理解光的干涉、繞射與傳播。</p>
    </div>
    <section className="home-bench" aria-labelledby="home-bench-title">
      <div className="home-bench-heading">
        <h2 id="home-bench-title">光學實驗架構</h2>
        <span>示意圖，非實際比例</span>
      </div>
      <figure>
        <OpticalBench aperture={aperture} position={isComparison ? 41 : 88} distanceSymbol={isSlit ? 'L' : 'z'}
          label={`平行單色光垂直入射${apertureName}，波前經自由空間向右傳至觀察屏幕`} />
        <figcaption className="home-stages">
          <div><strong>平行單色光源 <span>Laser / Plane Wave</span></strong>
            <p>單色平面波垂直入射</p>
            <span className="home-measure">λ = {formatWavelength(isSlit ? defaults.wavelengthNm : defaultSettings.wavelengthNm)} nm</span></div>
          <div><strong>孔徑屏障 <span>Aperture</span></strong>
            <p>{apertureName} · 亮處透光，深色區遮光</p>
            <span className="home-measure">{isSlit ? `a = ${formatSize(defaults.widthUm)} μm`
              : `D = ${formatSize(defaultSettings.sizeUm)} μm（${lesson.size}）`}</span></div>
          <div><strong>自由空間傳播</strong>
            <p>波前向右傳播</p>
            <span className="home-measure">{isSlit ? `L = ${formatLength(defaults.distanceM)} m` : isComparison
              ? 'z 可手動調整' : `z = ${formatMm(defaultSettings.distanceMm * 1e-3)} mm`} · 從孔徑至屏幕</span></div>
          <div><strong>觀察屏幕 <span>Screen</span></strong>
            <p>在同一屏幕上觀察亮紋與暗紋</p></div>
        </figcaption>
      </figure>
    </section>

    <section className="home-experiments" aria-labelledby="home-experiments-title">
      <h2 id="home-experiments-title">選擇實驗</h2>
      <div className="home-cards" role="group" aria-label="實驗類型">
        {experiments.map(({ id, title, description }) => <button type="button" key={id}
          aria-pressed={experiment === id} aria-controls="home-preview" onClick={() => setExperiment(id)}>
          <svg viewBox="0 0 76 60" aria-hidden="true">
            {id === 'slits' ? <AperturePlate aperture={3} x={38} y={30} width={44} />
              : id === 'farfield' ? <AperturePlate aperture={toAperture({ ...defaultSettings, shape: 'triangle' })} x={38} y={30} width={44} />
              : <><AperturePlate aperture={toAperture(defaultSettings)} x={17} y={30} width={22} />
                <path d="M33 23Q44 30 33 37 M44 18Q58 30 44 42" className="path-diffracted" />
                <path d="M66 10V50" className="path-incident" /></>}
          </svg>
          <span><strong>{title}</strong><span>{description}</span></span>
        </button>)}
      </div>
      <div className="home-preview" id="home-preview">
        <svg className="home-preview-plate" viewBox="0 0 60 60" aria-hidden="true">
          <AperturePlate aperture={aperture} x={30} y={30} width={48} />
        </svg>
        <div className="home-preview-text">
          <h3 id="home-preview-title">孔徑預覽</h3>
          <div className="home-options" role="group" aria-labelledby="home-preview-title">
            {isSlit ? slitModes.map((id) => <button type="button" key={id} aria-pressed={mode === id}
              onClick={() => setMode(id)}>{slitExamples[id].label}</button>)
              : (isComparison ? comparisonShapes : shapes).map((id) => <button type="button" key={id} aria-pressed={activeShape === id}
                onClick={() => isComparison ? setNearShape(id) : setShape(id)}>{lessons[id].title}</button>)}
          </div>
          <p aria-live="polite">{apertureName}。{description}</p>
        </div>
        <a className="home-start" href={routes[experiment]} onClick={() => {
          if (isSlit) chooseMode(mode)
          else chooseShape(activeShape)
        }}>開始實驗 <ArrowRight size={17} aria-hidden="true" /></a>
      </div>
    </section>
  </div>
}
