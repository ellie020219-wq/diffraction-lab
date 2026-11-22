import { FarFieldFft } from './fft2'
import type { WorkReply, WorkRequest } from './engine'

const transform = new FarFieldFft()
const scope = self as unknown as {
  onmessage: (event: MessageEvent<WorkRequest>) => void
  postMessage(reply: WorkReply, transfer?: Transferable[]): void
}

scope.onmessage = ({ data }) => {
  try {
    const spectrum = transform.calculate(data.aperture, data.resolution)
    scope.postMessage({ id: data.id, spectrum }, [spectrum.values.buffer, spectrum.real.buffer, spectrum.imag.buffer] as ArrayBuffer[])
  } catch (error) {
    scope.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : '繞射計算失敗，請檢查參數後再試。',
    })
  }
}
