// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('實驗室介面', () => {
  it('切換模式時顯示相應參數，保留各模式的設定', () => {
    render(<App />)
    fireEvent.change(screen.getByRole('spinbutton', { name: /波長/ }), { target: { value: '520' } })
    fireEvent.click(screen.getByRole('button', { name: '單狹縫' }))
    expect(screen.queryByRole('spinbutton', { name: /狹縫間距/ })).toBeNull()
    expect(screen.getByRole('table', { name: '理論暗紋' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'N 縫光柵' }))
    expect(screen.getByRole('spinbutton', { name: /狹縫數量/ })).toHaveValue(5)
    fireEvent.click(screen.getByRole('button', { name: '雙狹縫' }))
    expect(screen.getByRole('spinbutton', { name: /波長/ })).toHaveValue(520)
  })

  it('滑桿、數值輸入與屏幕渲染參數同步，範圍外輸入會限制到合法值', () => {
    render(<App />)
    const field = screen.getByRole('spinbutton', { name: /波長/ })
    const slider = screen.getByRole('slider', { name: '波長滑桿' })
    fireEvent.change(slider, { target: { value: '550' } })
    expect(field).toHaveValue(550)
    expect(screen.getByRole('img', { name: /屏幕亮紋/ })).toHaveAttribute('data-wavelength', '550')
    fireEvent.change(field, { target: { value: '500' } })
    expect(slider).toHaveValue('500')
    fireEvent.change(field, { target: { value: '98' } })
    fireEvent.blur(field)
    expect(field).toHaveValue(380)
    expect(slider).toHaveValue('380')
    fireEvent.click(screen.getByRole('button', { name: '重設' }))
    expect(field).toHaveValue(632.8)
  })

  it('條件改變後重算缺級，並以另一張表顯示總強度峰值', () => {
    render(<App />)
    fireEvent.change(screen.getByRole('spinbutton', { name: /狹縫寬度/ }), { target: { value: '20' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: /狹縫間距/ }), { target: { value: '60' } })
    const theory = screen.getByRole('table', { name: '理論干涉級次' })
    const order = within(theory).getByRole('rowheader', { name: '+3' }).closest('tr')!
    expect(within(order).getByText('缺級')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '實際局部極大' }))
    const peaks = screen.getByRole('table', { name: '實際局部極大' })
    expect(within(peaks).queryByRole('columnheader', { name: /級次/ })).toBeNull()
    expect(within(peaks).getAllByRole('row').length).toBeGreaterThan(2)
  })

  it('光柵預設會選用精確的 600 lines/mm，且介面說明第四級不存在', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'N 縫光柵' }))
    fireEvent.click(screen.getByRole('button', { name: /套用 532 nm/ }))
    expect(screen.getByText(/第 ±4 級不存在/)).toBeVisible()
    const results = screen.getByRole('table', { name: '理論干涉級次' })
    expect(within(results).getByText('73.256°')).toBeVisible()
    expect(within(results).queryByRole('rowheader', { name: '+4' })).toBeNull()
  })
})
