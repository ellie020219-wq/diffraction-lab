import type { Shape } from './apertures'

interface Lesson {
  title: string
  size: string
  principle: string
  observation: string
  formula: string
  activity: string
}

export const lessons: Record<Shape, Lesson> = {
  circle: {
    title: '圓孔', size: '直徑',
    principle: '圓孔在每個方向的投影相同，產生圓對稱的艾里圖樣。',
    observation: '辨認中央亮斑與外圍的同心暗環。旋轉圓孔時，圖樣維持圓對稱。',
    formula: '第一暗環 r₁ ≈ 1.22 λz / D',
    activity: '固定屏幕範圍，把直徑加倍，觀察第一暗環的半徑如何減半。',
  },
  square: {
    title: '方孔', size: '邊長',
    principle: '方孔可分解成兩個互相垂直的矩形孔徑，兩個方向的 sinc² 強度相乘。',
    observation: '兩組邊的法線形成十字方向的亮紋。旋轉方孔時，十字也跟著旋轉。',
    formula: 'I = sinc²(πafₓ) · sinc²(πafᵧ)，sinc(t) = sin(t) / t',
    activity: '將角度從 0° 改為 30°，比較兩張圖中孔徑邊緣與亮紋方向。',
  },
  triangle: {
    title: '三角形', size: '外接圓直徑',
    principle: '三組邊各有一對互反的法線方向。實數透射函數的傅立葉振幅共軛對稱，強度在中心兩側相等。',
    observation: '找出沿三組邊法線向外延伸的六道亮紋。',
    formula: 'I(fₓ, fᵧ) = I(−fₓ, −fᵧ)',
    activity: '旋轉 30° 後，沿任一條亮紋向中心另一側找出對應的亮紋。',
  },
  hexagon: {
    title: '六邊形', size: '外接圓直徑',
    principle: '正六邊形的三組平行邊，各對應一對亮紋延伸方向。',
    observation: '三角形與六邊形都有六個主要方向。比較中央亮斑和側瓣之間的明暗分布。',
    formula: 'I(R₆₀° f) = I(f)',
    activity: '鎖定屏幕範圍，保留尺寸與波長，在三角形和六邊形間切換。',
  },
  stadium: {
    title: '體育場形', size: '短軸寬度',
    principle: '孔徑由一段長方形與兩端半圓組成。孔徑越窄的方向，空間頻率分布越寬。',
    observation: '在孔徑的短軸方向，中央亮斑和亮紋延伸得較遠。',
    formula: '特徵展寬 ∝ λz / 孔徑寬度',
    activity: '先辨認孔徑的長軸，再將它旋轉 90°，觀察展寬方向一起轉動。',
  },
  'double-circle': {
    title: '雙圓孔', size: '單孔直徑',
    principle: '兩個相同圓孔的複數光場疊加，留下圓孔的艾里包絡及等間距干涉條紋。',
    observation: '條紋垂直於兩孔中心連線，沿連線方向量到的條紋間距由中心距決定。',
    formula: 'I = I單圓孔 · cos²(πsf∥)，Δx∥ = λz / s',
    activity: '保持直徑與屏幕範圍，增大中心距，觀察同一個圓形包絡內的條紋變密。',
  },
}
