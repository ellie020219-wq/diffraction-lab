import { useState } from 'react'
import { ChevronLeft, ChevronRight, Table2 } from 'lucide-react'
import { type PatternPoint, type TheoreticalPoint } from './optics'

interface ResultsProps {
  single: boolean
  visible: TheoreticalPoint[]
  all: TheoreticalPoint[]
  maxima: PatternPoint[]
}

const pageSize = 9
const formatDegree = (u: number) => formatNumber(Math.asin(u) * 180 / Math.PI, 3) + '°'
const formatPosition = (x: number | null) => x === null ? '—' : formatNumber(1000 * x, 3)
const formatIntensity = (intensity: number) => intensity > 0 && intensity < 0.0001
  ? intensity.toExponential(2)
  : intensity.toFixed(4)

function formatNumber(number: number, digits: number) {
  return number.toFixed(digits).replace(/^-0(?=\.0+$)/, '0').replace('-', '−')
}

function formatOrder(order: number) {
  return order === 0 ? '0' : order > 0 ? '+' + order : '−' + Math.abs(order)
}

export function Results({ single, visible, all, maxima }: ResultsProps) {
  const [view, setView] = useState<'theory' | 'maxima'>('theory')
  const [scope, setScope] = useState<'visible' | 'all'>('visible')
  const [requestedPage, setPage] = useState(0)
  const theoretical = view === 'theory'
  const theoryName = single ? '理論暗紋' : '理論干涉級次'
  const points = scope === 'visible' ? visible : all
  const count = theoretical ? points.length : maxima.length
  const pages = Math.max(1, Math.ceil(count / pageSize))
  const page = Math.min(requestedPage, pages - 1)
  const start = page * pageSize
  const maxOrder = all.at(-1)?.order ?? 0
  const anyMissing = visible.some((point) => point.missing)
  const degreeSymbol = single ? 'p' : 'm'

  return (
    <section className="results-card" id="results" aria-labelledby="results-title">
      <div className="results-header">
        <div>
          <h2 id="results-title"><Table2 size={19} aria-hidden="true" /> 理論與數值</h2>
          <p>比對理論位置與總強度曲線上的峰值。</p>
        </div>
        {theoretical && <label className="scope-select">
          <span className="sr-only">理論資料範圍</span>
          <select value={scope} onChange={(event) => {
            setScope(event.target.value === 'all' ? 'all' : 'visible')
            setPage(0)
          }}>
            <option value="visible">目前屏幕範圍</option>
            <option value="all">{single ? '全部理論暗紋' : '全部可傳播級次'}</option>
          </select>
        </label>}
      </div>
      <div className="result-tabs" role="group" aria-label="數值表類型">
        <button type="button" aria-pressed={theoretical} onClick={() => { setView('theory'); setPage(0) }}>
          {theoryName}
        </button>
        <button type="button" aria-pressed={!theoretical} onClick={() => { setView('maxima'); setPage(0) }}>
          實際局部極大
        </button>
      </div>
      <div className="table-note">
        {theoretical ? (
          single
            ? <span>暗紋滿足 a sin θ = pλ。{!points.length && '目前範圍內沒有理論暗紋。'}</span>
            : <span>最高可傳播級次 |m| = <strong>{maxOrder}</strong>，第 ±{maxOrder + 1} 級不存在。
                {anyMissing && ' 目前屏幕範圍內有缺級。'}</span>
        ) : (
          <span>以下位置為目前屏幕範圍內的總強度峰值，包含主峰與側峰。</span>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <caption className="sr-only">{theoretical ? theoryName : '實際局部極大'}</caption>
          <thead>
            <tr>
              {theoretical && <th scope="col">級次 {degreeSymbol}</th>}
              <th scope="col">角度 θ</th>
              <th scope="col">屏幕位置 x (mm)</th>
              <th scope="col">相對強度 I / I₀</th>
              {theoretical && <th scope="col">狀態</th>}
            </tr>
          </thead>
          <tbody>
            {theoretical ? points.slice(start, start + pageSize).map((point) => (
              <tr key={point.order}>
                <th scope="row">{formatOrder(point.order)}</th>
                <td>{formatDegree(point.u)}</td>
                <td>{formatPosition(point.x)}</td>
                <td>{formatIntensity(point.intensity)}</td>
                <td className="table-status">
                  {point.missing
                    ? <span className="missing-status"><span aria-hidden="true">×</span> 缺級</span>
                    : single ? '暗紋' : point.order === 0 ? '中央亮紋' : '可傳播'}
                  {point.x === null && <small>掠射，無屏幕交點</small>}
                </td>
              </tr>
            )) : maxima.slice(start, start + pageSize).map((peak) => (
              <tr key={peak.u}>
                <td>{formatDegree(peak.u)}</td>
                <td>{formatPosition(peak.x)}</td>
                <td>{formatIntensity(peak.intensity)}</td>
              </tr>
            ))}
            {!count && <tr><td colSpan={5} className="empty-table">這個範圍內沒有可列出的暗紋。</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && <div className="table-pagination">
        <span>第 {start + 1}–{Math.min(count, start + pageSize)} 筆，共 {count} 筆</span>
        <div>
          <button type="button" aria-label="上一頁" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <button type="button" aria-label="下一頁" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>}
    </section>
  )
}
