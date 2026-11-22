import { describe, expect, it, vi } from 'vitest'
import { FarFieldEngine, type WorkReply, type WorkRequest } from './engine'
import type { Aperture } from './apertures'
import type { Spectrum } from './fft2'
import { makeQuestion } from './FarFieldQuiz'

class FakeWorker {
  onmessage: ((event: MessageEvent<WorkReply>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  jobs: WorkRequest[] = []
  postMessage(request: WorkRequest) { this.jobs.push(request) }
  terminate = vi.fn()
  finish(id: number) {
    const spectrum: Spectrum = { side: 1, fftSide: 1024, apertureSize: 0.001, step: 250,
      values: Float32Array.of(1), real: Float32Array.of(1), imag: Float32Array.of(0) }
    this.onmessage?.({ data: { id, spectrum } } as MessageEvent<WorkReply>)
  }
}

const square: Aperture = { shape: 'square', angle: 0, size: 0.001, spacing: 0.002 }

describe('遠場 Worker 排程', () => {
  it('快速切換只發布最新參數的結果，忽略遲到或重複回覆', () => {
    const worker = new FakeWorker()
    const engine = new FarFieldEngine(worker)
    const stale = vi.fn()
    const superseded = vi.fn()
    const latest = vi.fn()
    const cancel = engine.request('lab', square, 1024, stale)
    cancel()
    engine.request('lab', { ...square, angle: 12 }, 1024, superseded)
    engine.request('lab', { ...square, angle: 35 }, 1024, latest)
    expect(worker.jobs.map(({ aperture }) => aperture.angle)).toEqual([0])
    worker.finish(worker.jobs[0].id)
    expect(worker.jobs.map(({ aperture }) => aperture.angle)).toEqual([0, 35])
    worker.finish(worker.jobs[0].id)
    expect(stale).not.toHaveBeenCalled()
    expect(latest).not.toHaveBeenCalled()
    worker.finish(worker.jobs[1].id)
    expect(superseded).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledTimes(1)
    engine.dispose()
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('優先處理等待中的模擬，等比縮放重用同一份頻譜', () => {
    const worker = new FakeWorker()
    const engine = new FarFieldEngine(worker)
    const noop = vi.fn()
    engine.request('quiz', { ...square, shape: 'triangle' }, 1024, noop)
    engine.request('quiz', { ...square, shape: 'hexagon' }, 1024, noop)
    engine.request('lab', square, 1024, noop)
    worker.finish(worker.jobs[0].id)
    expect(worker.jobs[1].aperture.shape).toBe('square')
    worker.finish(worker.jobs[1].id)
    expect(worker.jobs[2].aperture.shape).toBe('hexagon')
    const cached = vi.fn()
    engine.request('lab', { ...square, size: square.size * 2 }, 1024, cached)
    expect(worker.jobs).toHaveLength(3)
    expect(cached).toHaveBeenCalledTimes(1)
  })
})

it('猜題包含四個不同選項及正確答案，下一題可排除上一題孔徑', () => {
  const round = makeQuestion(undefined, () => 0.37)
  expect(round.options).toContain(round.correct)
  expect(new Set(round.options).size).toBe(4)
  expect(makeQuestion(round.correct, () => 0.37).correct).not.toBe(round.correct)
})
