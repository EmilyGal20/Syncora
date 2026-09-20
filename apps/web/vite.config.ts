import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], server: { port: 8600, strictPort: true }, build:{rollupOptions:{output:{manualChunks(id){if(!id.includes('node_modules'))return;if(id.includes('@mui')||id.includes('@emotion'))return 'mui';if(id.includes('@tanstack')||id.includes('axios'))return 'data'}}}} })
