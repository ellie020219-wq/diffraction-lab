import { apertureKey, type Aperture } from './apertures'
import type { FftSide, Spectrum } from './fft2'

export interface WorkRequest {
  id: number
  aperture: Aperture
  resolution: FftSide
}

export type WorkReply = { id: number; spectrum: Spectrum } | { id: number; error: string }
export type WorkResult = { spectrum: Spectrum } | { error: string }
export type Channel = 'lab' | 'quiz'

interface WorkerPort {
  postMessage(request: WorkRequest): void
  onmessage: ((event: MessageEvent<WorkReply>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  terminate(): void
}

interface Job {
  key: string
  request: WorkRequest
  receive: (result: WorkResult) => void
  cancelled: boolean
}

const spectrumBytes = (spectrum: Spectrum) => spectrum.values.byteLength + spectrum.real.byteLength + spectrum.imag.byteLength
const cacheBudget = 12 * 1024 * 1024

export class FarFieldEngine {
  private nextId = 0
  private active: Job | null = null
  private readonly pending = new Map<Channel, Job>()
  private readonly cache = new Map<string, Spectrum>()
  private bytes = 0
  private failed = false

  constructor(private readonly port: WorkerPort) {
    port.onmessage = ({ data }) => this.accept(data)
    port.onerror = () => {
      this.failed = true
      const jobs = [...this.pending.values(), this.active].filter((job) => job !== null)
      this.pending.clear()
      this.active = null
      jobs.forEach((job) => {
        if (!job.cancelled) job.receive({ error: '繞射運算暫時無法啟動，請重新整理頁面。' })
      })
    }
  }

  request(channel: Channel, aperture: Aperture, resolution: FftSide, receive: Job['receive']) {
    const key = apertureKey(aperture) + ':' + resolution
    const cached = this.cache.get(key)
    if (cached) {
      this.cache.delete(key)
      this.cache.set(key, cached)
      receive({ spectrum: cached })
      return () => {}
    }
    if (this.failed) {
      receive({ error: '繞射運算暫時無法啟動，請重新整理頁面。' })
      return () => {}
    }
    const previous = this.pending.get(channel)
    if (previous) previous.cancelled = true
    const job = { key, request: { id: ++this.nextId, aperture, resolution }, receive, cancelled: false }
    this.pending.set(channel, job)
    this.dispatch()

    return () => {
      job.cancelled = true
      if (this.pending.get(channel) === job) this.pending.delete(channel)
    }
  }

  private dispatch() {
    if (this.active || this.failed) return
    const channel = this.pending.has('lab') ? 'lab' : 'quiz'
    const job = this.pending.get(channel)
    if (!job) return
    this.pending.delete(channel)
    const cached = this.cache.get(job.key)
    if (cached) {
      job.receive({ spectrum: cached })
      this.dispatch()
      return
    }
    this.active = job
    this.port.postMessage(job.request)
  }

  private accept(reply: WorkReply) {
    const job = this.active
    if (!job || job.request.id !== reply.id) return
    this.active = null

    if ('spectrum' in reply) {
      const { spectrum } = reply
      this.cache.set(job.key, spectrum)
      this.bytes += spectrumBytes(spectrum)
      for (const [key, field] of this.cache) {
        if (this.bytes <= cacheBudget) break
        this.cache.delete(key)
        this.bytes -= spectrumBytes(field)
      }
    }
    if (!job.cancelled) job.receive(reply)
    this.dispatch()
  }

  dispose() {
    this.port.terminate()
    this.pending.clear()
    this.cache.clear()
    this.active = null
  }
}
