import { expect, test, type Locator } from '@playwright/test'

async function centerColor(canvas: Locator) {
  return canvas.evaluate((el) => {
    const image = el as HTMLCanvasElement
    return Array.from(image.getContext('2d')!.getImageData(image.width >> 1, image.height >> 1, 1, 1).data)
  })
}

test('光學架構圖隨第一階段的波長、孔徑與屏幕距離更新', async ({ page }) => {
  await page.goto('./#/slits')
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
  await expect(setup.getByText('λ = 532.0 nm')).toBeVisible()
  await expect(setup.getByText('z = 2.5 m（孔徑至屏幕）')).toBeVisible()
  await expect(setup.getByText('a = 30.00 μm · N = 6')).toBeVisible()
  await expect(setup.getByText('d = 160.00 μm')).toBeVisible()
  await page.getByRole('button', { name: '單狹縫' }).click()
  await expect(setup.getByText('a = 40.00 μm · N = 1')).toBeVisible()
  await expect(setup.getByText('d = 160.00 μm')).toHaveCount(0)
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

test('手動拖曳同步光路與圖樣，共同座標、色階及物理強度比較正常', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/farfield')
  await page.getByRole('button', { name: '近遠場比較' }).click()
  const panel = page.getByRole('region', { name: '近遠場比較', exact: true })
  await expect(panel.getByText(/各圖自身峰值模式把每張圖的可見最大強度設為 1/)).toBeVisible()
  await expect(panel.getByText(/同一傳播距離下的 Fraunhofer 理論近似/)).toBeVisible()
  await expect(panel.getByRole('button', { name: /播放|暫停/ })).toHaveCount(0)
  const near = panel.getByRole('img', { name: 'Fresnel 近場強度圖' })
  const far = panel.getByRole('img', { name: 'Fraunhofer 遠場近似強度圖' })
  const readout = panel.locator('[data-current-distance]')
  const slider = panel.getByRole('slider', { name: '傳播距離滑桿' })
  const screen = panel.locator('[data-screen-position]')
  const observation = panel.getByRole('region', { name: '目前觀察' })
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
  const initialScreen = (await screen.getAttribute('data-screen-position'))!
  await expect(observation.getByText('近場特徵較明顯')).toBeVisible()
  await expect(near).toHaveAttribute('data-intensity-factor', '1')
  await panel.getByRole('combobox', { name: '強度歸一化' }).selectOption('shared')
  await expect(far).toHaveAttribute('data-intensity-factor', '1')
  expect(Number(await near.getAttribute('data-intensity-factor'))).toBeLessThan(1)
  await panel.getByRole('combobox', { name: '強度歸一化' }).selectOption('individual')
  await expect(near).toHaveAttribute('data-intensity-factor', '1')

  await slider.scrollIntoViewIfNeeded()
  const range = (await slider.boundingBox())!
  const y = range.y + range.height / 2
  await page.mouse.move(range.x + 8, y)
  await page.mouse.down()
  await page.mouse.move(range.x + range.width * 0.7, y, { steps: 3 })
  await page.mouse.move(range.x + range.width * 0.33, y, { steps: 3 })
  await page.mouse.up()
  const dragged = (await readout.getAttribute('data-current-distance'))!
  expect(dragged).not.toBe(initial)
  await expect(screen).not.toHaveAttribute('data-screen-position', initialScreen)
  await expect(near).toHaveAttribute('data-distance', dragged)

  await slider.press('End')
  await slider.press('Home')
  await slider.press('End')
  const latest = (await readout.getAttribute('data-current-distance'))!
  await expect(observation.getByText('接近遠場條件')).toBeVisible()
  await expect(observation.getByText('0.04000', { exact: true })).toBeVisible()
  await expect(screen).toHaveAttribute('data-screen-position', '707')
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
  await expect(screen).toHaveAttribute('data-screen-position', initialScreen)
  expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

test('比較頁孔徑、波長、物理原理與觀察內容都跟隨實驗參數', async ({ page }) => {
  await page.goto('./#/farfield')
  await page.getByRole('button', { name: '近遠場比較' }).click()
  const panel = page.getByRole('region', { name: '近遠場比較', exact: true })
  const optical = panel.getByRole('region', { name: '光學實驗架構' })
  await expect(optical.getByText('示意圖，非實際比例')).toBeVisible()
  await expect(optical.getByText('自由空間傳播', { exact: true })).toBeVisible()
  const opening = optical.locator('[data-aperture-outline]')
  const circle = (await opening.getAttribute('d'))!
  const distance = panel.locator('[data-current-distance]')
  const initialDistance = (await distance.getAttribute('data-current-distance'))!
  await panel.getByRole('combobox', { name: '共同孔徑' }).selectOption('rectangle')
  await expect(opening).not.toHaveAttribute('d', circle)
  const rectangle = (await opening.getAttribute('d'))!
  const sizeTransform = (await opening.getAttribute('transform'))!
  await panel.getByRole('spinbutton', { name: '孔徑尺寸' }).fill('700')
  await expect(opening).toHaveAttribute('data-size', '700')
  await expect(opening).not.toHaveAttribute('transform', sizeTransform)
  await panel.getByRole('spinbutton', { name: '旋轉角度' }).fill('30')
  await expect(opening).toHaveAttribute('data-angle', '30')
  await expect(opening).not.toHaveAttribute('d', rectangle)
  await panel.getByRole('spinbutton', { name: '波長' }).fill('500')
  await expect(optical.getByText(/λ = 500.0 nm/)).toBeVisible()
  await expect(distance).toHaveAttribute('data-current-distance', initialDistance)
  const observation = panel.getByRole('region', { name: '目前觀察' })
  await expect(observation.getByText(/半徑 R 為 .*波長 λ 為 500.0 nm/)).toBeVisible()
  await expect(observation.getByText(/長方孔遠場沿長、短邊對應軸/)).toBeVisible()

  await panel.getByRole('spinbutton', { name: '傳播距離', exact: true }).fill('500')
  await expect(observation.getByText('過渡區', { exact: true })).toBeVisible()
  await expect(panel.getByRole('img', { name: 'Fresnel 近場強度圖' })).toHaveAttribute('data-distance', '0.5')
  const formulas = panel.locator('math')
  await expect(formulas.first()).toBeHidden()
  await panel.getByText('物理原理', { exact: true }).click()
  await expect(formulas).toHaveCount(4)
  await expect(panel.getByRole('heading', { name: /惠更斯－菲涅耳原理/ })).toBeVisible()
  await expect(panel.getByRole('heading', { name: /菲涅耳近場繞射/ })).toBeVisible()
  await expect(panel.getByRole('heading', { name: /夫朗和斐遠場繞射/ })).toBeVisible()
  await expect(panel.getByRole('heading', { name: /菲涅耳數/ })).toBeVisible()
  const fresnel = panel.locator('math[aria-label="Fresnel 傳播公式"]')
  await expect(fresnel).toBeVisible()
  expect(await fresnel.evaluate((formula) => formula.namespaceURI)).toBe('http://www.w3.org/1998/Math/MathML')
  await expect(fresnel.locator('mfrac')).toHaveCount(2)
  await expect(panel.getByText(/此刻 λ = 500.0 nm、z = 500 mm/)).toBeVisible()
  await expect(panel.getByText(/0.1 可作為教學參考/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

test('三組教學預設套用已驗證的圖樣與可編輯參數', async ({ page }) => {
  await page.goto('./#/farfield')
  await page.getByRole('button', { name: '近遠場比較' }).click()
  const panel = page.getByRole('region', { name: '近遠場比較', exact: true })
  const guide = panel.getByRole('region', { name: '教學預設實驗' })
  const controls = panel.getByRole('region', { name: '近遠場控制' })
  const near = panel.getByRole('img', { name: 'Fresnel 近場強度圖' })
  const far = panel.getByRole('img', { name: 'Fraunhofer 遠場近似強度圖' })

  for (const [title, shape, wavelength, distance, formula, view] of [
    ['圓孔——從近場到遠場', 'circle', '632.8', '71.11', 'r₁ ≈ 1.22λz／D', '±0.39 mm'],
    ['方孔——十字形繞射', 'square', '532.0', '5000', 'sinc²', '±17.73 mm'],
    ['三角形——六方向亮紋', 'triangle', '632.8', '1200', 'I(fₓ, fᵧ) = I(−fₓ, −fᵧ)', '±5.062 mm'],
  ]) {
    const preset = guide.getByRole('button', { name: new RegExp(title) })
    await preset.click()
    await expect(preset).toHaveAttribute('aria-pressed', 'true')
    await expect(guide.getByText('實驗目標')).toBeVisible()
    await expect(guide.getByText('操作方式')).toBeVisible()
    await expect(guide.getByText('觀察重點')).toBeVisible()
    await expect(guide.getByText(formula, { exact: false })).toBeVisible()
    await expect(controls.getByRole('combobox', { name: '共同孔徑' })).toHaveValue(shape)
    await expect(controls.getByRole('combobox', { name: '屏幕視野' })).toHaveValue('auto')
    await expect(controls.getByRole('spinbutton', { name: '孔徑尺寸' })).toHaveValue('600.00')
    await expect(controls.getByRole('spinbutton', { name: '旋轉角度' })).toHaveValue('0.0')
    await expect(controls.getByRole('spinbutton', { name: '波長' })).toHaveValue(wavelength)
    await expect(controls.getByRole('spinbutton', { name: '傳播距離', exact: true })).toHaveValue(distance)
    await expect(panel.getByText('共同視野 ' + view, { exact: true })).toHaveCount(2)
    await expect(near).toBeVisible()
    await expect(far).toHaveAttribute('data-screen-half-width', (await near.getAttribute('data-screen-half-width'))!)
  }
  await controls.getByRole('spinbutton', { name: '旋轉角度' }).fill('30')
  await expect(panel.locator('[data-aperture-outline]')).toHaveAttribute('data-angle', '30')
  await guide.getByRole('button', { name: /三角形——六方向亮紋/ }).click()
  await expect(controls.getByRole('spinbutton', { name: '旋轉角度' })).toHaveValue('0.0')
})

test('顯示精度與固定視野不會改變送入 Worker 的原始數值', async ({ page }) => {
  type Captured = { aperture: { size: number; angle: number }; light: { wavelength: number; distance: number } }
  await page.addInitScript(() => {
    const postMessage = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (message, options) {
      if (message?.aperture && message?.light) {
        (window as Window & { lastComparison?: Captured }).lastComparison = message
      }
      Reflect.apply(postMessage, this, options === undefined ? [message] : [message, options])
    }
  })
  await page.goto('./#/farfield')
  await page.getByRole('button', { name: '近遠場比較' }).click()
  const panel = page.getByRole('region', { name: '近遠場比較', exact: true })
  await panel.getByRole('button', { name: /三角形——六方向亮紋/ }).click()
  const near = panel.getByRole('img', { name: 'Fresnel 近場強度圖' })
  const far = panel.getByRole('img', { name: 'Fraunhofer 遠場近似強度圖' })
  await expect(near).toBeVisible()
  const view = (await near.getAttribute('data-screen-half-width'))!
  await panel.getByRole('combobox', { name: '屏幕視野' }).selectOption('fixed')
  const wavelength = panel.getByRole('spinbutton', { name: '波長' })
  const size = panel.getByRole('spinbutton', { name: '孔徑尺寸' })
  const angle = panel.getByRole('spinbutton', { name: '旋轉角度' })
  const distance = panel.getByRole('spinbutton', { name: '傳播距離', exact: true })
  await wavelength.fill('626.355572695719')
  await size.fill('454.76762872019')
  await angle.fill('24.1010477598509')
  await distance.fill('1234.567891')
  await distance.blur()
  await expect(wavelength).toHaveValue('626.4')
  await expect(size).toHaveValue('454.77')
  await expect(angle).toHaveValue('24.1')
  await expect(distance).toHaveValue('1235')
  const optical = panel.getByRole('region', { name: '光學實驗架構' })
  await expect(optical.getByText(/λ = 626.4 nm/)).toBeVisible()
  await expect(optical.getByText(/454.77 μm · 24.1°/)).toBeVisible()
  await expect(near).toHaveAttribute('data-screen-half-width', view)
  await expect(far).toHaveAttribute('data-screen-half-width', view)
  const input = await page.evaluate(() => (window as Window & { lastComparison?: Captured }).lastComparison)
  expect(input?.aperture.size).toBeCloseTo(454.76762872019e-6, 15)
  expect(input?.aperture.angle).toBe(24.1010477598509)
  expect(input?.light.wavelength).toBeCloseTo(626.355572695719e-9, 18)
  expect(input?.light.distance).toBeCloseTo(1.234567891, 12)
})
