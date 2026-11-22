import { useEffect, useState } from 'react'
import { Check, CircleHelp, RotateCcw, X } from 'lucide-react'
import { shapes, type Aperture, type Shape } from './apertures'
import type { FarFieldEngine } from './engine'
import type { Spectrum } from './fft2'
import { AperturePlot, FieldImage, formatMm } from './FarFieldCanvas'
import { lessons } from './shapeLessons'

const light = { wavelength: 632.8e-9, distance: 18 }
const size = 0.6e-3
const halfWidth = 5.5 * light.wavelength * light.distance / size
const letters = ['A', 'B', 'C', 'D']

function shuffled<T>(items: readonly T[], random: () => number) {
  const order = [...items]
  for (let index = order.length - 1; index > 0; index--) {
    const pick = Math.floor(random() * (index + 1))
    ;[order[index], order[pick]] = [order[pick], order[index]]
  }
  return order
}

export function makeQuestion(previous?: Shape, random = Math.random) {
  const correct = shuffled(shapes.filter((shape) => shape !== previous), random)[0]
  const distractors = shuffled(shapes.filter((shape) => shape !== correct), random).slice(0, 3)
  return { correct, options: shuffled([correct, ...distractors], random) }
}

function quizAperture(shape: Shape): Aperture {
  return { shape, size, spacing: 2.25 * size, angle: 0 }
}

function QuizRound({
  engine, error, question, picked, choose,
}: {
  engine: FarFieldEngine | null
  error: string
  question: ReturnType<typeof makeQuestion>
  picked: Shape | null
  choose: (shape: Shape) => void
}) {
  const [fields, setFields] = useState<Partial<Record<Shape, Spectrum>>>({})
  const [failure, setFailure] = useState('')
  const { correct, options } = question
  useEffect(() => {
    if (!engine) return
    let active = true
    const cancellations: Array<() => void> = []
    function load(index: number) {
      if (!active || index >= options.length || !engine) return
      const shape = options[index]
      cancellations.push(engine.request('quiz', quizAperture(shape), 2048, (result) => {
        if (!active) return
        if ('error' in result) {
          setFailure(result.error)
          return
        }
        setFields((previous) => ({ ...previous, [shape]: result.spectrum }))
        load(index + 1)
      }))
    }
    load(0)
    return () => { active = false; cancellations.forEach((cancel) => cancel()) }
  }, [engine, options])

  const ready = options.every((shape) => fields[shape])
  return <>
    <div className="ff-quiz-grid">
      <div className="ff-quiz-question">
        <h3>題目孔徑</h3>
        <AperturePlot aperture={quizAperture(correct)} label={picked === null ? '題目孔徑圖' : lessons[correct].title + '孔徑圖'} />
      </div>
      <div className="ff-quiz-options">
        <div className="ff-quiz-options-heading">
          <h3>選擇對應的繞射圖</h3>
          <p>共用視野 ±{formatMm(halfWidth)} mm · 對數刻度</p>
        </div>
        {!ready && <p className="ff-quiz-status" role="status">{error || failure || '正在計算四個選項…'}</p>}
        <div className="ff-option-grid">
          {options.map((shape, index) => {
            const field = fields[shape]
            const selected = picked === shape
            const revealed = picked !== null && shape === correct
            return <button key={shape} type="button" disabled={!ready || picked !== null}
              className={'ff-option' + (revealed ? ' ff-option-correct' : selected ? ' ff-option-incorrect' : '')}
              aria-label={'選項 ' + letters[index]} onClick={() => choose(shape)}>
              <span className="ff-option-picture">
                {field && <FieldImage spectrum={field} size={size} light={light} halfWidth={halfWidth}
                  scale="log" label={'選項 ' + letters[index] + ' 的繞射圖'} compact />}
              </span>
              <span className="ff-option-label">
                <b>{letters[index]}</b>
                {revealed ? <><Check size={15} aria-hidden="true" /> 正確答案</>
                  : selected ? <><X size={15} aria-hidden="true" /> 你的選擇</> : '選項'}
              </span>
            </button>
          })}
        </div>
      </div>
    </div>
    {picked !== null && <div className={picked === correct ? 'ff-answer is-correct' : 'ff-answer is-incorrect'} role="status">
      <h3>{picked === correct ? '答對了！' : '再觀察一下'} 正確答案是 {letters[options.indexOf(correct)]}。</h3>
      <p>{lessons[correct].title}。{lessons[correct].principle} {lessons[correct].observation}</p>
    </div>}
  </>
}

export function FarFieldQuiz({ engine, error }: { engine: FarFieldEngine | null; error: string }) {
  const [state, setState] = useState(() => ({ question: makeQuestion(), id: 1, picked: null as Shape | null, correct: 0, total: 0 }))

  function next(reset: boolean) {
    setState((previous) => ({
      question: makeQuestion(previous.question.correct),
      id: previous.id + 1,
      picked: null,
      correct: reset ? 0 : previous.correct,
      total: reset ? 0 : previous.total,
    }))
  }

  return <section className="ff-card ff-quiz" aria-labelledby="ff-quiz-title">
    <div className="ff-quiz-heading">
      <div><h2 id="ff-quiz-title"><CircleHelp size={20} aria-hidden="true" /> 猜猜看</h2>
        <p>根據孔徑的形狀和邊緣方向，選出對應的遠場圖案。</p>
      </div>
      <p className="ff-score" aria-live="polite">答對 <strong>{state.correct}</strong>／已作答 {state.total} 題</p>
    </div>
    <QuizRound key={state.id} engine={engine} error={error} question={state.question} picked={state.picked}
      choose={(shape) => setState((previous) => previous.picked === null ? {
        ...previous, picked: shape, correct: previous.correct + Number(shape === previous.question.correct), total: previous.total + 1,
      } : previous)} />
    <div className="ff-quiz-actions">
      <button type="button" className="ff-secondary" onClick={() => next(true)}><RotateCcw size={15} aria-hidden="true" /> 重新開始</button>
      <button type="button" className="ff-primary" disabled={state.picked === null} onClick={() => next(false)}>下一題</button>
    </div>
  </section>
}
