import { FlaskConical } from 'lucide-react'
import { teachingPresets, type TeachingPreset } from './teachingPresets'

export function TeachingExperiments({ active, apply }: {
  active: TeachingPreset | null
  apply: (preset: TeachingPreset) => void
}) {
  return <section className="control-card propagation-experiments" aria-labelledby="propagation-experiments-title">
    <div className="propagation-path-heading">
      <h2 id="propagation-experiments-title"><FlaskConical size={19} aria-hidden="true" /> 教學預設實驗</h2>
      <span>套用後仍可自由調整參數</span>
    </div>
    <div className="propagation-presets" role="group" aria-label="教學預設">
      {teachingPresets.map((preset) =>
        <button key={preset.id} type="button" aria-pressed={active?.id === preset.id} onClick={() => apply(preset)}>
          <span>{preset.id}</span>{preset.title}
        </button>,
      )}
    </div>
    {active && <div className="propagation-preset-guide">
      <dl>
        <div><dt>實驗目標</dt><dd>{active.goal}</dd></div>
        <div><dt>操作方式</dt><dd>{active.steps}</dd></div>
        <div><dt>觀察重點</dt><dd>{active.observation}</dd></div>
      </dl>
      <p>{active.formula}</p>
    </div>}
  </section>
}
