import { apertureRadius, type Aperture } from '../farfield/apertures'
import { formatMm, formatWavelength } from '../format'
import type { Illumination } from '../farfield/intensity'
import { lessons } from '../farfield/shapeLessons'
import { fresnelNumber, type Comparison } from './propagation'

export type Normalization = 'individual' | 'shared'

export function comparisonFactors(peaks: Comparison['peaks'] | undefined, normalization: Normalization) {
  if (normalization === 'individual' || !peaks) return { near: 1, far: 1 }
  const reference = Math.max(peaks.near, peaks.far)
  return { near: peaks.near / reference, far: peaks.far / reference }
}

export function propagationRegime(number: number) {
  if (number >= 1) return '近場特徵較明顯'
  if (number > 0.1) return '過渡區'
  return '接近遠場條件'
}

export function explainObservation(aperture: Aperture, light: Illumination) {
  const number = fresnelNumber(aperture, light)
  const radius = apertureRadius(aperture)
  const scale = light.wavelength * light.distance / aperture.size
  const regime = propagationRegime(number)
  let feature: string
  let suggestion: string

  if (number >= 1) {
    feature = `在 z = ${formatMm(light.distance)} mm，孔徑中心與邊緣的二次相位差約 ${(Math.PI * number).toPrecision(3)} rad。這會改變近場中央和邊緣的亮紋。`
    suggestion = '將距離略微拉近或拉遠，觀察 Fresnel 圖的中央明暗及孔徑邊緣附近的條紋。'
  } else if (number > 0.1) {
    feature = `中心到孔徑邊緣的二次相位差約 ${(Math.PI * number).toPrecision(3)} rad。兩圖的主要亮區可能相似，可從暗紋和外側亮紋找出差異。`
    suggestion = '維持共同視野，對照兩圖的第一道暗紋。增大 z 後再比較一次。'
  } else {
    feature = `孔徑上的二次相位變化約 ${(Math.PI * number).toPrecision(3)} rad，Fresnel 圖通常逐漸接近遠場的孔徑頻譜。所需距離仍取決於孔徑、視野與允許誤差。`
    suggestion = '試著切換自動取景查看較外側的亮紋，再用共同基準比較兩個模型預測的強度。'
  }

  let spatialFeature = `遠場的代表性尺度 λz／D 約為 ${formatMm(scale)} mm。 ${lessons[aperture.shape].observation}`
  if (aperture.shape === 'circle') {
    spatialFeature = `圓孔遠場的第一暗環半徑約為 ${formatMm(1.22 * scale)} mm。距離較短時，Fresnel 圖的亮環與中央明暗會隨 z 改變。`
  } else if (aperture.shape === 'double-circle') {
    spatialFeature = `雙圓孔遠場的條紋間距約為 ${formatMm(light.wavelength * light.distance / aperture.spacing)} mm，條紋方向垂直於兩孔中心連線。`
  } else if (aperture.shape === 'rectangle') {
    spatialFeature = `長方孔遠場沿長、短邊對應軸的第一零點距中心約 ${formatMm(scale)} mm、${formatMm(2 * scale)} mm，兩軸隨孔徑一起旋轉。`
  } else if (aperture.shape === 'ellipse') {
    spatialFeature = `橢圓孔遠場沿長、短軸的第一暗環距中心約 ${formatMm(1.22 * scale)} mm、${formatMm(2.44 * scale)} mm，暗環沿短軸方向較寬。`
  }
  if (number < 1 && (aperture.shape === 'square' || aperture.shape === 'triangle')) {
    suggestion = '改變旋轉角度約 30.0°，再比對外側亮紋一起轉過的方向。'
  }
  const cause = `半徑 R 為 ${formatMm(radius)} mm，波長 λ 為 ${formatWavelength(light.wavelength * 1e9)} nm。增加 z 或 λ 會降低菲涅耳數，使遠場圖樣在屏幕上展寬。`
  return { number, regime, feature, spatialFeature, cause, suggestion }
}
