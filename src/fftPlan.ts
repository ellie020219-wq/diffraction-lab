export function fftPlan(side: number) {
  const reverse = new Uint32Array(side)
  const cosine = new Float64Array(side / 2)
  const sine = new Float64Array(side / 2)
  for (let i = 1; i < side; i++) {
    reverse[i] = (reverse[i >> 1] >> 1) | ((i & 1) * (side >> 1))
  }
  for (let i = 0; i < side / 2; i++) {
    const phase = -2 * Math.PI * i / side
    cosine[i] = Math.cos(phase)
    sine[i] = Math.sin(phase)
  }

  return (real: Float64Array, imag: Float64Array, offset = 0) => {
    for (let i = 0; i < side; i++) {
      const j = reverse[i]
      if (j > i) {
        const savedReal = real[offset + i]
        const savedImag = imag[offset + i]
        real[offset + i] = real[offset + j]
        imag[offset + i] = imag[offset + j]
        real[offset + j] = savedReal
        imag[offset + j] = savedImag
      }
    }
    for (let size = 2; size <= side; size *= 2) {
      const half = size / 2
      const stride = side / size
      for (let block = offset; block < offset + side; block += size) {
        for (let i = 0; i < half; i++) {
          const first = block + i
          const second = first + half
          const c = cosine[i * stride]
          const s = sine[i * stride]
          const re = c * real[second] - s * imag[second]
          const im = s * real[second] + c * imag[second]
          real[second] = real[first] - re
          imag[second] = imag[first] - im
          real[first] += re
          imag[first] += im
        }
      }
    }
  }
}
