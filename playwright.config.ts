import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4180/diffraction-lab/'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  projects: [
    { name: '桌面 Chromium', use: { ...devices['Desktop Chrome'] } },
    { name: '手機 Chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4180 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  },
})
