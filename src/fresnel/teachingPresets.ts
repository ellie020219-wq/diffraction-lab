import type { Shape } from '../farfield/apertures'

export interface TeachingPreset {
  id: 'A' | 'B' | 'C'
  title: string
  shape: Shape
  sizeUm: number
  wavelengthNm: number
  angle: number
  distanceM: number
  goal: string
  steps: string
  observation: string
  formula: string
}

const redNm = 632.8
const circleSizeUm = 600

export const teachingPresets: readonly TeachingPreset[] = [
  {
    id: 'A', title: '圓孔——從近場到遠場',
    shape: 'circle', sizeUm: circleSizeUm, wavelengthNm: redNm, angle: 0,
    distanceM: (circleSizeUm * 0.5e-6) ** 2 / (2 * redNm * 1e-9),
    goal: '看出圓孔近場如何逐漸接近 Airy 圓環。',
    steps: '慢慢增大 z，保留自動取景，讓圓環留在畫面內。',
    observation: '先看中心的明暗，再比對兩圖的第一暗環與外圈。',
    formula: '遠場第一暗環半徑 r₁ ≈ 1.22λz／D，D 為圓孔直徑。',
  },
  {
    id: 'B', title: '方孔——十字形繞射',
    shape: 'square', sizeUm: 600, wavelengthNm: 532, angle: 0, distanceM: 5,
    goal: '找出方孔直邊與遠場十字亮紋的方向關係。',
    steps: '將孔徑旋轉 30°，再比較尺寸或 z 變化時的條紋間隔。',
    observation: '亮紋沿著邊緣的垂直方向延伸，並隨孔徑一起轉動。',
    formula: '遠場強度是兩個互相垂直的 sinc² 分布的乘積。',
  },
  {
    id: 'C', title: '三角形——六方向亮紋',
    shape: 'triangle', sizeUm: 600, wavelengthNm: redNm, angle: 0, distanceM: 1.2,
    goal: '辨認三角孔遠場的六個主要亮紋方向。',
    steps: '沿亮紋找到相對的一道。增大 z，觀察兩圖的中央和外側亮紋如何接近。',
    observation: '三組邊緣各對應一對正負法線方向。自動取景與對數色階可保留較弱的外側亮紋。',
    formula: '實數透射函數的遠場強度有中心反演對稱性，I(fₓ, fᵧ) = I(−fₓ, −fᵧ)。',
  },
]
