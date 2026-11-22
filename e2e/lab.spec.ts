import { expect, test, type Locator } from '@playwright/test'

async function canvasImage(canvas: Locator) {
  return canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL())
}

test('能操作三種模式，數值、曲線和亮紋會跟著變動', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./')
  await expect(page).toHaveTitle(/光的干涉與繞射/)
  const canvas = page.getByRole('img', { name: '依照波長上色的屏幕亮紋' })
  const curve = page.locator('.plot-canvas')
  await expect(canvas).toBeVisible()
  const previousScreen = await canvasImage(canvas)
  const previousCurve = await canvasImage(curve)
  await canvas.evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    const context = canvas.getContext('2d')!
    const pixel = (x: number) => context.getImageData(x, Math.floor(canvas.height / 2), 1, 1).data[0]
    if (pixel(Math.floor(canvas.width / 2)) < 185 || pixel(Math.floor(canvas.width / 10)) > 60) {
      throw new Error('屏幕中央應有亮紋，外側應較暗')
    }
  })

  await page.getByRole('spinbutton', { name: /波長/ }).fill('530')
  await expect(canvas).toHaveAttribute('data-wavelength', '530')
  await expect.poll(() => canvasImage(canvas)).not.toBe(previousScreen)
  await expect.poll(() => canvasImage(curve)).not.toBe(previousCurve)
  await page.getByRole('button', { name: '單狹縫' }).click()
  await expect(page.getByRole('spinbutton', { name: /狹縫間距/ })).toHaveCount(0)
  await expect(page.getByRole('table', { name: '理論暗紋' })).toBeVisible()

  await page.getByRole('button', { name: 'N 縫光柵' }).click()
  await page.getByRole('spinbutton', { name: /狹縫寬度/ }).fill('20')
  await page.getByRole('spinbutton', { name: /狹縫間距/ }).fill('60')
  await page.getByRole('spinbutton', { name: /狹縫數量/ }).fill('4')
  const table = page.getByRole('table', { name: '理論干涉級次' })
  for (const order of ['−3', '+3']) {
    await expect(table.getByRole('row').filter({
      has: page.getByRole('rowheader', { name: order, exact: true }),
    })).toContainText('缺級')
  }
  await expect(page.locator('.chart-legend')).toContainText('缺級')
  const markedCurve = await canvasImage(curve)
  await page.getByRole('button', { name: '位置標記' }).click()
  await expect(page.getByRole('button', { name: '位置標記' })).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => canvasImage(curve)).not.toBe(markedCurve)
  await page.getByRole('button', { name: '實際局部極大' }).click()
  await expect(page.getByRole('table', { name: '實際局部極大' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /級次/ })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('光柵預設涵蓋三個正級次，第四級不存在，頁面在視窗內排版', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'N 縫光柵' }).click()
  await page.getByRole('button', { name: /套用 532 nm/ }).click()
  await expect(page.getByText(/第 ±4 級不存在/)).toBeVisible()
  const table = page.getByRole('table', { name: '理論干涉級次' })
  for (const [order, angle] of [['+1', '18.615°'], ['+2', '39.673°'], ['+3', '73.256°']]) {
    await expect(table.getByRole('row').filter({
      has: page.getByRole('rowheader', { name: order, exact: true }),
    })).toContainText(angle)
  }
  await expect(table.getByRole('rowheader', { name: '+4', exact: true })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  const plot = page.locator('.plot-canvas')
  await plot.focus()
  await plot.press('ArrowRight')
  await expect(page.locator('.chart-probe')).toContainText('I / I₀')
  await plot.press('Escape')
  await expect(page.locator('.chart-probe')).toContainText('屏幕範圍')
})

test('屏幕檢視、全部級次與分頁可操作', async ({ page }) => {
  await page.goto('./')
  const range = page.getByRole('combobox', { name: '屏幕檢視範圍' })
  const visible = await page.locator('.chart-probe').textContent()
  await range.selectOption('wide')
  await expect(page.locator('.chart-probe')).not.toHaveText(visible ?? '')
  await page.getByRole('combobox', { name: '理論資料範圍' }).selectOption('all')
  await expect(page.getByRole('button', { name: '上一頁' })).toBeDisabled()
  await page.getByRole('button', { name: '下一頁' }).click()
  await expect(page.getByRole('button', { name: '上一頁' })).toBeEnabled()
  await expect(page.getByText(/第 10–18 筆/)).toBeVisible()
})
