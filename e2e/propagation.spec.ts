import { expect, test, type Locator } from '@playwright/test'

async function centerColor(canvas: Locator) {
  return canvas.evaluate((el) => {
    const image = el as HTMLCanvasElement
    return Array.from(image.getContext('2d')!.getImageData(image.width >> 1, image.height >> 1, 1, 1).data)
  })
}

test('光學架構圖隨第一階段的波長、孔徑與屏幕距離更新', async ({ page }) => {
  await page.goto('./')
  const setup = page.getByRole('region', { name: '光學實驗架構示意圖' })
  await expect(setup.getByText('平行單色光源')).toBeVisible()
  await expect(setup.getByText('孔徑屏障')).toBeVisible()
  await expect(setup.getByText('觀察屏幕')).toBeVisible()
  await expect(setup.getByText(/教學示意.*採示意比例/)).toBeVisible()
  await expect(page.getByRole('region', { name: '即時狹縫示意圖' })).toBeVisible()

  await page.getByRole('button', { name: 'N 縫光柵' }).click()
  await page.getByRole('spinbutton', { name: /狹縫寬度/ }).fill('30')
  await page.getByRole('spinbutton', { name: /波長/ }).fill('532')
  await page.getByRole('spinbutton', { name: /屏幕距離/ }).fill('2.5')
  await page.getByRole('spinbutton', { name: /狹縫數量/ }).fill('6')
  await expect(setup.getByText('λ = 532 nm')).toBeVisible()
  await expect(setup.getByText('z = 2.5 m（孔徑至屏幕）')).toBeVisible()
  await expect(setup.getByText('a = 30 μm · N = 6')).toBeVisible()
  await expect(setup.getByText('d = 160 μm')).toBeVisible()
  await page.getByRole('button', { name: '單狹縫' }).click()
  await expect(setup.getByText('a = 40 μm · N = 1')).toBeVisible()
  await expect(setup.getByText('d = 160 μm')).toHaveCount(0)
})

test('新孔徑可調整、顯示物理刻度並可成為猜題的正確答案', async ({ page }) => {
  // This deterministic shuffle draws the cross and places its image at D.
  await page.addInitScript(() => { Math.random = () => 0.12 })
  await page.goto('./#/farfield')
  const axes = page.locator('.ff-aperture-scale')
  for (const name of ['長方形', '橢圓形', '十字形']) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.getByRole('img', { name: name + '的二值透光孔徑' })).toBeVisible()
    await expect(axes.getByText('x (μm)')).toBeVisible()
    await expect(axes.getByText('y (μm)')).toBeVisible()
    await expect(page.getByRole('heading', { name: name + '的繞射特徵' })).toBeVisible()
  }
  await page.getByRole('spinbutton', { name: '孔徑尺寸' }).fill('2000')
  await expect(axes.getByText('x (mm)')).toBeVisible()
  await page.getByRole('button', { name: '猜猜看' }).click()
  const answer = page.getByRole('button', { name: '選項 D' })
  await expect(answer).toBeEnabled()
  await answer.click()
  await expect(page.locator('.ff-answer')).toContainText('答對了！ 正確答案是 D。')
  await expect(page.getByRole('img', { name: '十字形孔徑圖' })).toBeVisible()
})

test('比較頁共用座標與色階，動畫和拖曳保持距離、Fresnel 數與畫格同步', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/farfield')
  await page.getByRole('button', { name: '近遠場比較' }).click()
  const panel = page.getByRole('region', { name: '近遠場比較', exact: true })
  await expect(panel.getByText(/各以畫面內的最大強度歸一化/)).toBeVisible()
  await expect(panel.getByText('Fraunhofer 遠場近似誤差可能偏大')).toBeVisible()
  const near = panel.getByRole('img', { name: 'Fresnel 近場強度圖' })
  const far = panel.getByRole('img', { name: 'Fraunhofer 遠場近似強度圖' })
  const readout = panel.locator('[data-current-distance]')
  const slider = panel.getByRole('slider', { name: '距離播放位置' })
  await expect(near).toBeVisible()
  await expect(far).toHaveAttribute('data-distance', (await readout.getAttribute('data-current-distance'))!)
  await expect(far).toHaveAttribute('data-screen-half-width', (await near.getAttribute('data-screen-half-width'))!)
  expect((await centerColor(near))[0]).toBeLessThan(20)
  expect(await centerColor(far)).toEqual([255, 234, 168, 255])

  const left = (await near.boundingBox())!
  const right = (await far.boundingBox())!
  if (testInfo.project.name.includes('手機')) expect(left.y + left.height).toBeLessThan(right.y)
  else {
    expect(left.x + left.width).toBeLessThan(right.x)
    expect(left.y).toBeCloseTo(right.y, 0)
  }
  await panel.getByRole('button', { name: '線性' }).click()
  await expect(near).toHaveAttribute('data-intensity-scale', 'linear')
  await expect(far).toHaveAttribute('data-intensity-scale', 'linear')

  const initial = (await readout.getAttribute('data-current-distance'))!
  await panel.getByRole('button', { name: '播放' }).click()
  await expect.poll(() => readout.getAttribute('data-current-distance')).not.toBe(initial)
  await panel.getByRole('button', { name: '暫停' }).click()
  const paused = (await readout.getAttribute('data-current-distance'))!
  await expect(near).toHaveAttribute('data-distance', paused)
  await expect(far).toHaveAttribute('data-distance', paused)
  await expect(panel.getByRole('button', { name: '播放' })).toBeVisible()

  await slider.scrollIntoViewIfNeeded()
  const range = (await slider.boundingBox())!
  const y = range.y + range.height / 2
  await page.mouse.move(range.x + 8, y)
  await page.mouse.down()
  await page.mouse.move(range.x + range.width * 0.7, y, { steps: 3 })
  await page.mouse.move(range.x + range.width * 0.33, y, { steps: 3 })
  await page.mouse.up()
  const dragged = (await readout.getAttribute('data-current-distance'))!
  expect(dragged).not.toBe(paused)
  await expect(near).toHaveAttribute('data-distance', dragged)

  await slider.press('End')
  await slider.press('Home')
  await slider.press('End')
  const latest = (await readout.getAttribute('data-current-distance'))!
  await expect(panel.getByText('接近遠場條件')).toBeVisible()
  await expect(panel.getByText('0.04000', { exact: true })).toBeVisible()
  await expect(near).toHaveAttribute('data-distance', latest)
  await expect(far).toHaveAttribute('data-distance', latest)
  const fieldExtent = (await near.getAttribute('data-screen-half-width'))!
  await panel.getByRole('combobox', { name: '屏幕視野' }).selectOption('auto')
  await expect(near).toBeVisible()
  await expect(near).not.toHaveAttribute('data-screen-half-width', fieldExtent)
  await expect(far).toHaveAttribute('data-screen-half-width', (await near.getAttribute('data-screen-half-width'))!)

  await panel.getByRole('spinbutton', { name: '傳播距離' }).fill('0')
  await expect(panel.getByRole('spinbutton', { name: '傳播距離' })).toHaveAttribute('aria-invalid', 'true')
  await expect(panel.getByText(/距離超出有效範圍/)).toBeVisible()
  await panel.getByRole('button', { name: '重設距離' }).click()
  await expect(near).toHaveAttribute('data-distance', initial)
  await expect(far).toHaveAttribute('data-distance', initial)
  expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})
