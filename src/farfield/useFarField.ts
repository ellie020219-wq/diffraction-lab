import { useEffect, useRef, useState } from 'react'
import { apertureKey, type Aperture } from './apertures'
import { FarFieldEngine } from './engine'
import type { Spectrum } from './fft2'

export function useFarFieldEngine() {
  const [state, setState] = useState<{ engine: FarFieldEngine | null; error: string }>({ engine: null, error: '' })
  useEffect(() => {
    try {
      const engine = new FarFieldEngine(new Worker(new URL('./farfield.worker.ts', import.meta.url), { type: 'module' }))
      setState({ engine, error: '' })
      return () => engine.dispose()
    } catch {
      setState({ engine: null, error: '此瀏覽器無法啟動繞射運算，請使用支援 Web Worker 的瀏覽器。' })
    }
  }, [])
  return state
}

export function useFarField(engine: FarFieldEngine | null, aperture: Aperture) {
  const key = apertureKey(aperture)
  const geometry = useRef(aperture)
  geometry.current = aperture
  const [state, setState] = useState<{ key: string; field?: Spectrum; error?: string } | null>(null)

  useEffect(() => {
    if (!engine) return
    // The normalized geometry key is invariant under uniform scaling.
    const input = geometry.current
    let cancelBase: (() => void) | undefined
    let cancelDetail: (() => void) | undefined
    let detailDelay: ReturnType<typeof setTimeout> | undefined
    const delay = setTimeout(() => {
      cancelBase = engine.request('lab', input, 1024, (result) => {
        if ('error' in result) {
          setState({ key, error: result.error })
          return
        }
        setState({ key, field: result.spectrum })
        detailDelay = setTimeout(() => {
          cancelDetail = engine.request('lab', input, 2048, (detail) => {
            if ('spectrum' in detail) setState({ key, field: detail.spectrum })
          })
        }, 220)
      })
    }, 60)
    return () => {
      clearTimeout(delay)
      clearTimeout(detailDelay)
      cancelBase?.()
      cancelDetail?.()
    }
  }, [engine, key])

  return state?.key === key ? state : null
}
