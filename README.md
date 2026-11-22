# 光的干涉與繞射互動實驗室

以 React、TypeScript 與 Vite 製作的繁體中文光學實驗室。首頁可預覽光路及孔徑，再進入一維干涉與繞射、二維孔徑遠場繞射或近遠場比較。

## 本機預覽

建議使用 Node.js 22 LTS，至少 22.12。

```bash
npm ci
npm run dev
```

開啟終端顯示的 Vite 位址，預設為 `http://localhost:5173/diffraction-lab/`。若要預覽正式產物，先執行 `npm run build`，再執行 `npm run preview`，預設位址為 `http://localhost:4173/diffraction-lab/`。

## 操作與模型

首頁的 SVG 提供教學預覽。點選實驗卡片後可切換預覽孔徑，再按「開始實驗」。網站導覽與「返回首頁」保留同一次瀏覽中的實驗設定。可使用 `#/slits`、`#/farfield`、`#/comparison` 直接開啟實驗。

- 選擇單狹縫、雙狹縫或 N 縫光柵。用滑桿或數值欄位調整波長、縫寬、中心距、屏幕距離和狹縫數量。各模式保留自己的設定。
- 圖上的空心方框代表理論干涉級次，實心圓代表總強度曲線的局部極大，叉號代表缺級。可在下方切換數值表，分別查閱位置、角度與強度。單狹縫模式的方框代表理論暗紋。
- 在圖上移動指標可讀取屏幕位置和強度。用鍵盤時，聚焦曲線後按左右方向鍵，按住 Shift 可加大移動量，按 Esc 結束量測。
- 光柵模式的 532 nm／600 lines/mm 範例採用線密度換算出的精確縫距。前三個正級次約為 18.6146°、39.6726°、73.2557°。第四級需要 sin θ = 1.2768，超出傳播範圍。

物理運算以公尺為長度單位，使用 `sin θ = x / hypot(L, x)`。單縫相對強度為 `sinc²(πa sin θ / λ)`，其中 `sinc(z) = sin(z) / z`。多縫乘上 `[sin(Nβ) / (N sin β)]²`，其中 `β = πd sin θ / λ`。所有模式都以中央強度正規化。理論級次由 `d sin θ = mλ` 求得。級次與單縫包絡暗紋重合時滿足 `ma = pd`，其中 `p` 為非零整數。局部極大以總強度函數在各波瓣內求得。

## 形狀 → 遠場繞射

從導覽列進入「二維孔徑繞射」，或開啟 `/diffraction-lab/#/farfield`。選擇圓孔、方孔、三角形、六邊形、體育場形、雙圓孔、長方形、橢圓形或十字形，可用數值欄或滑桿調整尺寸、旋轉、波長、距離及雙圓孔中心距。預設以對數色階顯示弱亮紋。按「固定屏幕範圍」可在同一組 mm 座標比較不同參數。切換到「猜猜看」可從四張共用尺度的計算圖作答、查看解說和重設分數。

頁面在 Web Worker 對 512 × 512 的二值遮罩做二維 FFT。各軸補零至 1024，停止調整後加密至 2048。零頻取樣移到中央，屏幕座標以 `x = λ z fₓ` 與 `y = λ z fᵧ` 換算，強度以中央值正規化。色階下限為 10⁻⁶。頁面以孔徑最遠透光半徑 R 估算 `N₍F₎ = R² / (λ z)`，並檢查可用視野與取樣條件。圓孔暗環另用 16384 點中心 FFT 剖面與二次插值完成數值驗收。

`reference/generated/` 收錄六張獨立參考圖與線性強度數值。圓孔、方孔和雙圓孔採解析解，三角形、六邊形和體育場形採連續孔徑積分。裝有 NumPy、SciPy 與 Pillow 時，可執行 `python reference/generate.py` 重建。

## 光學架構與近遠場比較

第一階段的光學架構圖標示平行單色光、孔徑屏障、觀察屏幕及即時物理尺寸。圖中的元件採教學示意比例，即時狹縫圖則以正確寬距比例描繪孔徑。

從導覽列直接進入「近場與遠場比較」，也可在二維孔徑實驗切換到「近遠場比較」，用同一孔徑、波長、距離、mm 視野及色階觀察兩種模型。預設按各圖的可見峰值歸一，以比較圖案形狀。共同基準模式以兩個模型中較高的可見峰值為分母，保留單位入射複振幅下的相對強度。使用對數滑桿或直接輸入距離可移動光路示意圖的屏幕。比較頁保有獨立的屏幕距離，並共用第二階段的孔徑與波長設定。「目前觀察」和可展開的「物理原理」補充現值、公式及取樣限制。


「教學預設實驗」以自動取景及對數色階凸顯暗紋與旁瓣。圓孔從 71.11 mm 開始觀察 Airy 圓環，方孔在 5000 mm 比較軸向十字亮紋，三角孔在 1200 mm 查看六方向亮紋。三組孔徑尺寸均為 600.00 μm，方孔採 532.0 nm，其餘採 632.8 nm。切換「固定視野」會記住目前的毫米座標，超過取樣限制時顯示實際裁切範圍。

Fresnel 採縮放 FFT。在孔徑加上二次相位 `exp(iπ(x²+y²)/(λz))`，再做補零二維 FFT，以 `x_s = λzf_x` 和 `y_s = λzf_y` 對應輸出。場振幅乘上 `Δa²/(λz)`，輸出二次相位的模長為 1。這個方法可用同一傳播模型連續跨越近場與遠場。視野受 FFT 頻率、全菲涅耳積分相位取樣、傍軸四次項相位上限與現有遠場頻譜支援限制。比較頁顯示 `N_F = R²/(λz)`。較大時，Fraunhofer 圖代表遠場近似的預測。

## 測試與正式建置

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Vitest 驗證物理公式、缺級、峰值及介面狀態。Playwright 使用正式的 `dist/` 產物，在桌面及手機 Chromium 版型驗證互動。Linux 若缺瀏覽器系統相依項，可執行 `npx playwright install --with-deps chromium`。若環境已有 Chromium，可將 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指向執行檔。

## GitHub Pages 部署

1. 確認儲存庫可使用 GitHub Pages。在 GitHub 的 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。
2. 將專案提交並推送到 `main`，或在 **Actions** 對 `main` 手動執行 **Verify and deploy GitHub Pages**。如果採用其他部署分支，更新 `.github/workflows/pages.yml` 內的分支條件。
3. 工作流程會安裝依賴、執行 Vitest、正式建置及 Playwright，通過後將 `dist/` 部署到 Pages。部署網址可在 workflow 的 `github-pages` 環境或 **Settings → Pages** 查看。
4. 獨立的 `Check public GitHub Pages` 工作流程會在部署成功後等待公開站點提供新版本，並從公開網址重跑桌面和手機的 Playwright 測試。Vite 的 `base` 設為 `/diffraction-lab/`，對應此儲存庫的 Pages 路徑。

## 檔案結構

| 路徑 | 用途 |
| --- | --- |
| `src/optics.ts`、`src/settings.ts` | SI 物理模型、精確缺級判斷、參數與範例 |
| `src/App.tsx`、`src/navigation.ts`、`src/ModelGuide.tsx` | 網站導覽與模型說明 |
| `src/LabHome.tsx`、`src/OpticalBench.tsx`、`e2e/home.spec.ts` | 實驗室首頁、共用 SVG 光路與驗收 |
| `src/SlitExperiment.tsx`、`src/Controls.tsx`、`src/Results.tsx` | 模式切換、參數控制、理論及實際峰值表 |
| `src/PatternChart.tsx`、`src/wavelength.ts`、`src/styles.css` | 強度曲線、亮紋、色彩與響應式介面 |
| `src/farfield/`、`e2e/farfield.spec.ts` | 二維孔徑、Worker、畫布、遊戲與驗收 |
| `reference/generate.py`、`reference/generated/` | 六種形狀的獨立連續孔徑參考圖與剖面 |
| `src/OpticalSetupDiagram.tsx`、`src/fresnel/`、`e2e/propagation.spec.ts` | 光學架構、近遠場比較、手動距離控制與驗收 |
| `src/main.tsx`、`index.html` | 網站入口 |
| `src/optics.test.ts`、`src/App.test.tsx`、`e2e/lab.spec.ts` | 物理、元件與瀏覽器測試 |
| `package.json`、`package-lock.json`、`tsconfig.json`、`vite.config.ts`、`playwright.config.ts` | 依賴、建置及測試設定 |
| `.github/workflows/pages.yml`、`.github/workflows/pages-smoke.yml` | CI、GitHub Pages 部署與公開站點驗收 |
