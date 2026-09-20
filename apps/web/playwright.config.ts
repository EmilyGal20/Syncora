import { defineConfig, devices } from '@playwright/test'
export default defineConfig({testDir:'./e2e',fullyParallel:true,retries:1,use:{baseURL:'http://localhost:8600',trace:'on-first-retry'},projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},{name:'mobile',use:{...devices['Pixel 5'],viewport:{width:390,height:844}}}],webServer:{command:'npm run dev',url:'http://localhost:8600',reuseExistingServer:true}})

