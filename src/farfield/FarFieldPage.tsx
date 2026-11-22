import { lazy, Suspense, useEffect, useState } from 'react'
import { Aperture as ApertureIcon, CircleHelp, Focus, GitCompareArrows, Info, Lock, Unlock } from 'lucide-react'
import { apertureKey, samplingCheck } from './apertures'
import { OpticalBench } from '../OpticalBench'
import { routes } from '../navigation'
import { formatAngle, formatFresnel, formatMm, formatSize, formatWavelength } from '../format'
import { AperturePlot, FarFieldPlot } from './FarFieldCanvas'
import { defaultSettings, FarFieldControls, ScaleSelector, ShapeSelector, toAperture, toLight, type Settings } from './FarFieldControls'
import { FarFieldQuiz } from './FarFieldQuiz'
import { screenLimits, type IntensityScale } from './intensity'
import { lessons } from './shapeLessons'
import { useFarField, useFarFieldEngine } from './useFarField'

const PropagationPanel = lazy(() => import('../fresnel/PropagationPanel'))

export default function FarFieldPage({ tab, settings, setSettings }: {
  tab: 'lab' | 'quiz' | 'comparison' | null
  settings: Settings
  setSettings: (settings: Settings) => void
}) {
  const [quizStarted, setQuizStarted] = useState(tab === 'quiz')
  const [comparisonOpened, setComparisonOpened] = useState(tab === 'comparison')
  const isComparison = tab === 'comparison'
  useEffect(() => {
    if (tab === 'quiz') setQuizStarted(true)
    if (tab === 'comparison') setComparisonOpened(true)
  }, [tab])
  const [scale, setScale] = useState<IntensityScale>('log')
  const [fixed, setFixed] = useState<number | null>(null)
  const { engine, error } = useFarFieldEngine()
  const aperture = toAperture(settings)
  const light = toLight(settings)
  const result = useFarField(tab === 'lab' ? engine : null, aperture)
  const lesson = lessons[settings.shape]
  const { halfWidth, fresnel, samplingAdequate, clipped } = screenLimits(aperture, light, fixed)
  const warning = fresnel > 0.1 || !samplingAdequate || clipped

  return <div className="ff-page">
    <div className="intro ff-intro">
      <span className="intro-label"><span /> {isComparison ? 'Fresnel 與 Fraunhofer' : '二維 Fraunhofer 遠場模擬'}</span>
      <h1>{isComparison ? '近場與遠場比較' : <>形狀 <span>→</span> 遠場繞射</>}</h1>
      <p>{isComparison ? '移動觀察屏幕，比較同一孔徑在相同距離下的兩種繞射預測。'
        : '讓平面波穿過不同的孔徑，觀察形狀、尺寸和方向如何改變屏幕上的光。'}</p>
    </div>
    <div className="ff-tabs" role="group" aria-label="學習模式">
      <button type="button" aria-pressed={tab === 'lab'} onClick={() => { window.location.hash = routes.farfield }}>
        <Focus size={17} aria-hidden="true" /> 繞射模擬
      </button>
      <button type="button" aria-pressed={tab === 'quiz'} onClick={() => { window.location.hash = routes.quiz }}>
        <CircleHelp size={17} aria-hidden="true" /> 猜猜看
      </button>
      <button type="button" aria-pressed={tab === 'comparison'} onClick={() => { window.location.hash = routes.comparison }}>
        <GitCompareArrows size={17} aria-hidden="true" /> 近遠場比較
      </button>
    </div>
    <section aria-label="二維繞射模擬" hidden={tab !== 'lab'}>
      <details className="ff-card farfield-setup">
        <summary>光學實驗架構示意圖</summary>
        <figure>
          <OpticalBench aperture={aperture} label={`平行單色光垂直入射${lesson.title}，經自由空間傳至觀察屏幕`} />
          <figcaption>λ = {formatWavelength(settings.wavelengthNm)} nm · {lesson.title} · {lesson.size} {formatSize(settings.sizeUm)} μm · z = {formatMm(light.distance)} mm（孔徑至屏幕）。光路採教學示意比例。</figcaption>
        </figure>
      </details>
      <ShapeSelector shape={settings.shape} change={(shape) => setSettings({ ...settings, shape })} />
      <div className="ff-lab-grid">
        <div className="ff-left-rail">
          <section className="visual-card ff-aperture ff-figure" aria-labelledby="ff-aperture-title">
            <div className="ff-figure-heading">
              <div><h2 id="ff-aperture-title"><ApertureIcon size={19} aria-hidden="true" /> 孔徑形狀</h2>
                <p>{lesson.title} · {lesson.size} {formatSize(settings.sizeUm)} μm</p>
              </div>
              <span className="ff-angle">{formatAngle(settings.angle)}°</span>
            </div>
            <AperturePlot aperture={aperture} label={lesson.title + '的二值透光孔徑'} showScale />
            <div className="ff-aperture-legend">
              <span><i /> 透光區</span>
              <span><i /> 遮光區</span>
            </div>
          </section>
          <FarFieldControls settings={settings} change={setSettings}
            reset={() => { setSettings(defaultSettings); setScale('log'); setFixed(null) }} />
        </div>
        <div className="ff-right-rail">
          <section className="visual-card ff-field ff-figure" aria-labelledby="ff-pattern-title" data-aperture={apertureKey(aperture)}>
            <div className="ff-figure-heading">
              <div><h2 id="ff-pattern-title"><Focus size={19} aria-hidden="true" /> 遠場繞射圖</h2><p>相對強度 <span className="mono">I / I₀</span></p></div>
              <ScaleSelector scale={scale} change={setScale} />
            </div>
            {fresnel > 0.1 && <p className="ff-field-warning" role="status">
                {fresnel >= 1 ? '遠場條件不足 · 模型示意' : '遠場近似誤差可能偏大'}
              </p>}
            <FarFieldPlot aperture={aperture} light={light} halfWidth={halfWidth} spectrum={result?.field}
              scale={scale} error={error || result?.error} />
            <div className="ff-field-footer">
              <span className="mono">512 × 512{result?.field && ' → ' + result.field.fftSide + ' × ' + result.field.fftSide}</span>
              <button type="button" className="ff-lock" aria-pressed={fixed !== null} onClick={() => setFixed(fixed === null ? halfWidth : null)}>
                {fixed === null ? <Unlock size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
                {fixed === null ? '固定屏幕範圍' : '解除固定範圍'}
              </button>
            </div>
          </section>
          <section className="ff-card ff-lesson" aria-labelledby="ff-lesson-title">
            <div className={warning ? 'ff-condition has-warning' : 'ff-condition'}>
              <Info size={17} aria-hidden="true" />
              <div>
                <p><strong>{fresnel > 0.1 ? '遠場近似誤差可能偏大' : '遠場條件良好'}</strong>
                  <span className="mono"> N<sub>F</sub> = {formatFresnel(fresnel)}</span></p>
                {fresnel > 0.1 && <p>圖像為 Fraunhofer 模型的預測。增大屏幕距離或縮小孔徑可改善遠場條件。</p>}
                {!samplingAdequate && <p>孔徑特徵取樣不足，請加大雙圓孔間距或使用較大的特徵尺寸。</p>}
                {clipped && <p>可用屏幕範圍縮至 ±{formatMm(halfWidth)} mm，以符合近軸與取樣範圍。</p>}
              </div>
            </div>
            <h2 id="ff-lesson-title">{lesson.title}的繞射特徵</h2>
            <dl className="ff-lesson-body">
              <div><dt>物理原理</dt><dd>{lesson.principle}</dd></div>
              <div><dt>觀察重點</dt><dd>{lesson.observation}</dd></div>
              <div><dt>關鍵公式</dt><dd className="ff-formula">{lesson.formula}</dd></div>
              <div><dt>試著操作</dt><dd>{lesson.activity}</dd></div>
            </dl>
            <details className="ff-model">
              <summary>取樣與屏幕座標</summary>
              <p>輸入為 0 或 1 的透射遮罩，孔徑取樣間距為 {formatSize(samplingCheck(aperture).step * 1e6)} μm。FFT 移頻後以 x = λzfₓ、y = λzfᵧ 對應屏幕，中央強度歸一化為 1。</p>
              <p>以孔徑中心到最遠透光點的距離 R 計算 N₍F₎ = R²／(λz)。0.1 為教學參考。屏幕顯示限制為 r／z ≤ 0.1。</p>
            </details>
          </section>
        </div>
      </div>
    </section>
    {(comparisonOpened || tab === 'comparison') && <div hidden={tab !== 'comparison'}>
      <Suspense fallback={<p role="status">正在載入近遠場比較…</p>}>
        <PropagationPanel active={tab === 'comparison'} settings={settings} changeSettings={setSettings} />
      </Suspense>
    </div>}
    {(quizStarted || tab === 'quiz') && <div hidden={tab !== 'quiz'}>
      <FarFieldQuiz engine={tab === 'quiz' ? engine : null} error={error} />
    </div>}
  </div>
}
