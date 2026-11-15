import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base './' : vercel(맨 위 주소)과 GitHub Pages(/Youtube_Mixer/ 아래) 둘 다에서 동작
export default defineConfig({
  base: './',
  plugins: [react()],
});
