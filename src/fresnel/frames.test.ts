import { expect, it, vi } from 'vitest'
import { FrameQueue, type FrameInput, type FrameReply, type FrameRequest } from './frames'

class FakeWorker {
  onmessage: ((event: MessageEvent<FrameReply>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  jobs: FrameRequest[] = []
  postMessage(request: FrameRequest) { this.jobs.push(request) }
  terminate = vi.fn()
  finish(index: number) {
    const id = this.jobs[index].id
    this.onmessage?.({ data: { id, error: '' } } as MessageEvent<FrameReply>)
  }
}

const input: FrameInput = {
  aperture: { shape: 'circle', size: 6e-4, angle: 0, spacing: 0 },
  light: { wavelength: 632.8e-9, distance: 0.1 },
  halfWidth: 3e-4,
  preview: false,
}

it('拖曳距離時僅執行及顯示最後一筆待處理畫格', () => {
  const worker = new FakeWorker()
  const queue = new FrameQueue(worker)
  const stale = vi.fn()
  const skipped = vi.fn()
  const latest = vi.fn()
  queue.request(input, stale)
  queue.request({ ...input, light: { ...input.light, distance: 0.2 } }, skipped)
  queue.request({ ...input, light: { ...input.light, distance: 0.3 } }, latest)
  expect(worker.jobs).toHaveLength(1)
  worker.finish(0)
  worker.finish(0)
  expect(stale).not.toHaveBeenCalled()
  expect(skipped).not.toHaveBeenCalled()
  expect(worker.jobs[1].light.distance).toBe(0.3)
  worker.finish(1)
  expect(latest).toHaveBeenCalledTimes(1)
  queue.dispose()
  expect(worker.terminate).toHaveBeenCalledOnce()
})

it('取消畫格後不發布結果', () => {
  const worker = new FakeWorker()
  const queue = new FrameQueue(worker)
  const receive = vi.fn()
  const cancel = queue.request(input, receive)
  cancel()
  worker.finish(0)
  expect(receive).not.toHaveBeenCalled()
})
