const length = new Intl.NumberFormat('zh-TW', { maximumSignificantDigits: 4, useGrouping: false })

export const formatWavelength = (nanometers: number) => nanometers.toFixed(1)
export const formatSize = (micrometers: number) => micrometers.toFixed(2)
export const formatAngle = (degrees: number) => degrees.toFixed(1)
export const formatLength = (value: number) => length.format(value)
export const formatMm = (meters: number) => formatLength(meters * 1000)
export const formatFresnel = (number: number) => number.toPrecision(4)

export function formatParameter(value: number, unit?: string) {
  switch (unit) {
    case 'nm': return formatWavelength(value)
    case 'μm': return formatSize(value)
    case '°': return formatAngle(value)
    case 'mm':
    case 'm': return formatLength(value)
    default: return String(value)
  }
}
