# 光的干涉與繞射互動實驗室

繁體中文 Fraunhofer 遠場模擬。以 React、TypeScript 與 Vite 製作，可在瀏覽器端操作單狹縫、雙狹縫、N 縫光柵及六種二維孔徑。

## 本機預覽

建議使用 Node.js 22 LTS，至少 22.12。

```bash
npm ci
npm run dev
```

開啟終端顯示的 Vite 位址，預設為 `http://localhost:5173/diffraction-lab/`。若要預覽正式產物，先執行 `npm run build`，再執行 `npm run preview`，預設位址為 `http://localhost:4173/diffraction-lab/`。

## 操作與模型

- 選擇單狹縫、雙狹縫或 N 縫光柵。用滑桿或數值欄位調整波長、縫寬、中心距、屏幕距離和狹縫數量。各模式保留自己的設定。
- 圖上的空心方框代表理論干涉級次，實心圓代表總強度曲線的局部極大，叉號代表缺級。可在下方切換數值表，分別查閱位置、角度與強度。單狹縫模式的方框代表理論暗紋。
- 在圖上移動指標可讀取屏幕位置和強度。用鍵盤時，聚焦曲線後按左右方向鍵，按住 Shift 可加大移動量，按 Esc 結束量測。
- 光柵模式的 532 nm／600 lines/mm 範例採用線密度換算出的精確縫距。前三個正級次約為 18.6146°、39.6726°、73.2557°。第四級需要 sin θ = 1.2768，超出傳播範圍。

物理運算以公尺為長度單位，使用 `sin θ = x / hypot(L, x)`。單縫相對強度為 `sinc²(πa sin θ / λ)`，其中 `sinc(z) = sin(z) / z`。多縫乘上 `[sin(Nβ) / (N sin β)]²`，其中 `β = πd sin θ / λ`。所有模式都以中央強度正規化。理論級次由 `d sin θ = mλ` 求得。級次與單縫包絡暗紋重合時滿足 `ma = pd`，其中 `p` 為非零整數。局部極大以總強度函數在各波瓣內求得。

## 形狀 → 遠場繞射

從導覽列進入「形狀 → 遠場繞射」，或開啟 `/diffraction-lab/#/farfield`。選擇圓孔、方孔、三角形、六邊形、體育場形或雙圓孔，可用數值欄或滑桿調整尺寸、旋轉、波長、距離及雙圓孔中心距。預設以對數色階顯示弱亮紋。按「固定屏幕範圍」可在同一組 mm 座標比較不同參數。切換到「猜猜看」可從四張共用尺度的計算圖作答、查看解說和重設分數。

頁面在 Web Worker 對 512 × 512 的二值遮罩做二維 FFT。各軸補零至 1024，停止調整後加密至 2048。零頻取樣移到中央，屏幕座標以 `x = λ z fₓ` 與 `y = λ z fᵧ` 換算，強度以中央值正規化。色階下限為 10⁻⁶。頁面以孔徑最遠透光半徑 R 估算 `N₍F₎ = R² / (λ z)`，並檢查可用視野與取樣條件。圓孔暗環另用 16384 點中心 FFT 剖面與二次插值完成數值驗收。

`reference/generated/` 收錄六張獨立參考圖與線性強度數值。圓孔、方孔和雙圓孔採解析解，三角形、六邊形和體育場形採連續孔徑積分。裝有 NumPy、SciPy 與 Pillow 時，可執行 `python reference/generate.py` 重建。

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
| `src/App.tsx`、`src/Controls.tsx`、`src/Results.tsx` | 模式切換、參數控制、理論及實際峰值表 |
| `src/PatternChart.tsx`、`src/wavelength.ts`、`src/styles.css` | 強度曲線、亮紋、色彩與響應式介面 |
| `src/farfield/`、`e2e/farfield.spec.ts` | 二維孔徑、Worker、畫布、遊戲與驗收 |
| `reference/generate.py`、`reference/generated/` | 六種形狀的獨立連續孔徑參考圖與剖面 |
| `src/main.tsx`、`index.html` | 網站入口 |
| `src/optics.test.ts`、`src/App.test.tsx`、`e2e/lab.spec.ts` | 物理、元件與瀏覽器測試 |
| `package.json`、`package-lock.json`、`tsconfig.json`、`vite.config.ts`、`playwright.config.ts` | 依賴、建置及測試設定 |
| `.github/workflows/pages.yml`、`.github/workflows/pages-smoke.yml` | CI、GitHub Pages 部署與公開站點驗收 |
