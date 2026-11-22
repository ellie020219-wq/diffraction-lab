import { readFileSync } from 'node:fs'
import { expect, test, type Locator } from '@playwright/test'
import { referenceShapes, type Shape } from '../src/farfield/apertures'
import { intensityColor } from '../src/farfield/intensity'
import { lessons } from '../src/farfield/shapeLessons'

const reference = JSON.parse(readFileSync(new URL('../reference/generated/profiles.json', import.meta.url), 'utf8')) as {
  dimension: number; intensity: Record<Shape, number[]>
}

async function renderedColors(canvas: Locator, count: number) {
  return canvas.evaluate((element, dimension) => {
    const image = element as HTMLCanvasElement
    const context = image.getContext('2d')!
    const { data } = context.getImageData(0, 0, image.width, image.height)
    const pixels: number[][] = []
    for (let row = 0; row < dimension; row++) {
      for (let column = 0; column < dimension; column++) {
        const x = Math.round(column * (image.width - 1) / (dimension - 1))
        const y = Math.round((dimension - 1 - row) * (image.height - 1) / (dimension - 1))
        const offset = 4 * (y * image.width + x)
        pixels.push([data[offset], data[offset + 1], data[offset + 2]])
      }
    }
    return pixels
  }, count)
}

test('六種正式畫布皆符合獨立參考圖的亮紋與色階', async ({ page }) => {
  test.setTimeout(45_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/farfield')
  await expect(page.getByRole('heading', { name: '形狀 → 遠場繞射' })).toBeVisible()
  await page.getByRole('spinbutton', { name: '孔徑尺寸' }).fill('1000')
  await page.getByRole('spinbutton', { name: '屏幕距離' }).fill('10000')
  const field = page.getByRole('img', { name: '二維遠場繞射強度圖' })
  for (const shape of referenceShapes) {
    await page.getByRole('button', { name: lessons[shape].title, exact: true }).click()
    if (shape === 'double-circle') await page.getByRole('spinbutton', { name: '雙圓孔中心間距' }).fill('2000')
    await expect(field).toHaveAttribute('data-fft', '2048')
    const halfWidth = Number(await field.getAttribute('data-screen-half-width'))
    expect(halfWidth).toBeCloseTo(0.037968, 10)
    const colors = await renderedColors(field, reference.dimension)
    const middle = colors[Math.floor(colors.length / 2)]
    expect(middle).toEqual([255, 234, 168])
    const expected = reference.intensity[shape].map((value) => intensityColor(value, 'log'))
    const error = colors.reduce((sum, color, index) => sum + color.reduce((channels, value, channel) =>
      channels + Math.abs(value - expected[index][channel]), 0), 0) / (3 * colors.length)
    expect(error, shape + ' RGB 平均差').toBeLessThan(19)
  }
  await expect(page.getByRole('button', { name: '對數' })).toHaveAttribute('aria-pressed', 'true')
  const original = await renderedColors(field, 21)
  await page.getByRole('button', { name: '線性' }).click()
  await expect(page.getByRole('button', { name: '線性' })).toHaveAttribute('aria-pressed', 'true')
  expect(await renderedColors(field, 21)).not.toEqual(original)
  expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})

test('更改參數、快速拖曳與輸入驗證，返回第一階段仍保留設定', async ({ page }) => {
  await page.goto('./#/slits')
  await page.getByRole('spinbutton', { name: /波長/ }).fill('520')
  await page.getByRole('link', { name: '二維孔徑繞射' }).click()
  await page.getByRole('button', { name: '體育場形', exact: true }).click()
  const field = page.getByRole('img', { name: '二維遠場繞射強度圖' })
  await expect(field).toHaveAttribute('data-fft', '2048')
  const initial = await renderedColors(field, 15)
  const slider = page.getByRole('slider', { name: '旋轉角度滑桿' })
  await slider.scrollIntoViewIfNeeded()
  const bounds = (await slider.boundingBox())!
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(bounds.x + 7, y)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * .66, y, { steps: 4 })
  await page.mouse.move(bounds.x + bounds.width * .22, y, { steps: 4 })
  await page.mouse.up()
  const angle = page.getByRole('spinbutton', { name: '旋轉角度' })
  expect(Number(await angle.inputValue())).toBeGreaterThan(0)
  await angle.fill('30')
  await expect(slider).toHaveValue('30')
  await expect(page.locator('[data-aperture]')).toHaveAttribute('data-aperture', /^stadium:30:/)
  await expect(field).toHaveAttribute('data-fft', '2048')
  expect(await renderedColors(field, 15)).not.toEqual(initial)

  const size = page.getByRole('spinbutton', { name: '孔徑尺寸' })
  await size.fill('-1')
  await expect(size).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('請輸入 20.00 至 2000.00 μm。')).toBeVisible()
  await expect(field).toBeVisible()
  await size.fill('1200')
  await expect(size).toHaveAttribute('aria-invalid', 'false')
  await page.getByRole('button', { name: '532.0 nm' }).click()
  await expect(page.getByRole('spinbutton', { name: '波長' })).toHaveValue('532.0')
  const distance = page.getByRole('spinbutton', { name: '屏幕距離' })
  await distance.fill('100')
  await expect(page.getByText('遠場條件不足 · 模型示意')).toBeVisible()
  await expect(field).toBeVisible()
  await distance.fill('15000')
  await page.getByRole('button', { name: '固定屏幕範圍' }).click()
  const fixedWidth = await field.getAttribute('data-screen-half-width')
  await distance.fill('9600')
  await expect(field).toHaveAttribute('data-screen-half-width', fixedWidth!)
  await page.getByRole('link', { name: '一維干涉與繞射', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: /波長/ })).toHaveValue('520.0')
  await page.getByRole('link', { name: '二維孔徑繞射' }).click()
  await page.reload()
  await expect(field).toBeVisible()
})

test('猜題四張圖使用相同物理視野，支援正誤、計分、換題及重設', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0 })
  await page.goto('./#/farfield')
  await page.getByRole('button', { name: '猜猜看' }).click()
  await expect(page.getByRole('img', { name: '題目孔徑圖' })).toBeVisible()
  await expect(page.getByRole('button', { name: '下一題' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '選項 D' })).toBeEnabled()
  const widths = await page.locator('.ff-option canvas').evaluateAll((canvases) =>
    canvases.map((canvas) => canvas.getAttribute('data-screen-half-width')))
  expect(widths).toHaveLength(4)
  expect(new Set(widths).size).toBe(1)
  await page.getByRole('button', { name: '選項 D' }).click()
  await expect(page.getByText('答對了！ 正確答案是 D。')).toBeVisible()
  await expect(page.locator('.ff-score')).toHaveText('答對 1／已作答 1 題')
  await expect(page.getByRole('button', { name: '選項 A' })).toBeDisabled()
  await page.getByRole('button', { name: '下一題' }).click()
  await expect(page.getByRole('button', { name: '選項 A' })).toBeEnabled()
  await page.getByRole('button', { name: '選項 A' }).click()
  await expect(page.getByText('再觀察一下 正確答案是 D。')).toBeVisible()
  await expect(page.locator('.ff-score')).toHaveText('答對 1／已作答 2 題')
  await page.getByRole('button', { name: '重新開始' }).click()
  await expect(page.locator('.ff-score')).toHaveText('答對 0／已作答 0 題')
  await expect(page.getByRole('button', { name: '下一題' })).toBeDisabled()
})
