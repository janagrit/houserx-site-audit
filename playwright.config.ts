import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './data/pages';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  // Pages that keep their media pull ~14 MB (two multi-MB GIFs). More workers saturate the connection.
  workers: 3,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['./reporters/summary-table.ts'], ['html', { open: 'never' }]],
  // One baseline per screenshot, no OS suffix: baselines are only ever made in the Linux container (see README).
  snapshotPathTemplate: '{testDir}/{testFileDir}/__screenshots__/{arg}{ext}',
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /[\\/]mobile[\\/]/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /[\\/]mobile[\\/].*\.spec\.ts$/ },
  ],
});
