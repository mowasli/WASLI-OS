import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser', expect:{timeout:15000}, fullyParallel:false, workers:1, timeout:180_000,
 use:{baseURL:'http://127.0.0.1:3100',viewport:{width:1440,height:1000},trace:'retain-on-failure',launchOptions:{executablePath:process.env.WASLI_PLAYWRIGHT_BUNDLED==='true'?undefined:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}},
 webServer:{command:'node scripts/prepare-e2e.mjs && WASLI_DATA_DIR=.data/e2e npm run dev -- --port 3100',url:'http://127.0.0.1:3100/api/auth/session',timeout:120_000,reuseExistingServer:false},
 reporter:[['list']]
});
