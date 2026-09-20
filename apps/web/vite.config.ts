import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], server: { host:'0.0.0.0',port: 8600, strictPort: true,proxy:{'/api':{target:process.env.VITE_DEV_API_TARGET??'http://127.0.0.1:8500',changeOrigin:false}} }, build:{rollupOptions:{output:{manualChunks(id){if(!id.includes('node_modules'))return;if(id.includes('@mui')||id.includes('@emotion'))return 'mui';if(id.includes('@tanstack')||id.includes('axios'))return 'data'}}}} })
