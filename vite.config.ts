import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// L'application est servie par GitHub Pages sous /mini-cassiopee/.
export default defineConfig({
  base: '/mini-cassiopee/',
  plugins: [react()],
});
