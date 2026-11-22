import { FresnelPropagation } from './propagation'
import type { FrameRequest, FrameReply } from './frames'

const solver = new FresnelPropagation()
const scope = self as unknown as {
  onmessage: (event: MessageEvent<FrameRequest>) => void
  postMessage(reply: FrameReply, transfer?: Transferable[]): void
}
scope.onmessage = ({ data }) => {
  const { id, aperture, light, halfWidth, preview } = data
  try {
    const field = solver.compare(aperture, light, halfWidth, preview)
    scope.postMessage({ id, field }, [field.near.buffer, field.far.buffer] as ArrayBuffer[])
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : '近場圖樣計算失敗，請調整參數。' })
  }
}
