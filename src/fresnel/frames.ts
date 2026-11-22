import type { Aperture } from '../farfield/apertures'
import type { Illumination } from '../farfield/intensity'
import type { Comparison } from './propagation'

export interface FrameInput {
  aperture: Aperture
  light: Illumination
  halfWidth: number
  preview: boolean
}
export type FrameRequest = FrameInput & { id: number }
export type FrameReply = { id: number } & ({ field: Comparison } | { error: string })

interface FramePort {
  postMessage: (message: FrameRequest) => void
  onmessage: ((event: MessageEvent<FrameReply>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  terminate: () => void
}

interface Job {
  request: FrameRequest
  receive: (result: FrameReply) => void
}

export class FrameQueue {
  private active?: Job
  private pending?: Job
  private latestId = 0
  private failed = false

  constructor(private readonly worker: FramePort) {
    worker.onmessage = ({ data }) => {
      if (this.active?.request.id !== data.id) return
      const complete = this.active
      this.active = undefined
      if (data.id === this.latestId) complete.receive(data)
      this.start()
    }
    worker.onerror = () => {
      this.failed = true
      const latest = this.pending ?? this.active
      this.pending = this.active = undefined
      if (latest?.request.id === this.latestId) {
        latest.receive({ id: this.latestId, error: '近場運算無法啟動，請重新整理頁面。' })
      }
    }
  }

  request(input: FrameInput, receive: Job['receive']) {
    const id = ++this.latestId
    if (this.failed) {
      receive({ id, error: '近場運算無法啟動，請重新整理頁面。' })
      return () => {}
    }
    this.pending = { request: { id, ...input }, receive }
    this.start()
    return () => {
      if (this.pending?.request.id === id) this.pending = undefined
      if (this.latestId === id) this.latestId++
    }
  }

  private start() {
    if (this.active || !this.pending) return
    this.active = this.pending
    this.pending = undefined
    this.worker.postMessage(this.active.request)
  }

  dispose() {
    this.worker.terminate()
    this.active = this.pending = undefined
  }
}
