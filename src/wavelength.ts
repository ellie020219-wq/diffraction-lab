// An approximate display color for monochromatic visible light.
export function wavelengthColor(nm: number): readonly [number, number, number] {
  if (nm < 440) return [(440 - nm) / 60, 0, 1]
  if (nm < 490) return [0, (nm - 440) / 50, 1]
  if (nm < 510) return [0, 1, (510 - nm) / 20]
  if (nm < 580) return [(nm - 510) / 70, 1, 0]
  if (nm < 645) return [1, (645 - nm) / 65, 0]
  return [1, 0, 0]
}
