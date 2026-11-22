import { useEffect, useState } from 'react'
import { FrameQueue, type FrameInput, type FrameReply } from './frames'

export function useFresnel(input: FrameInput, key: string, enabled: boolean) {
  const [queue, setQueue] = useState<FrameQueue | null>(null)
  const [workerError, setWorkerError] = useState('')
  const [result, setResult] = useState<{ key: string; reply: FrameReply } | null>(null)

  useEffect(() => {
    try {
      const queue = new FrameQueue(new Worker(new URL('./fresnel.worker.ts', import.meta.url), { type: 'module' }))
      setQueue(queue)
      return () => queue.dispose()
    } catch {
      setWorkerError('此瀏覽器無法啟動近場 Web Worker。')
    }
  }, [])

  useEffect(() => {
    if (!queue || !enabled) return
    let cancel: (() => void) | undefined
    const delay = setTimeout(() => {
      cancel = queue.request(input, (reply) => setResult({ key, reply }))
    }, input.preview ? 0 : 80)
    return () => {
      clearTimeout(delay)
      cancel?.()
    }
  }, [queue, input, key, enabled])

  return { current: result?.key === key ? result : null, workerError }
}
