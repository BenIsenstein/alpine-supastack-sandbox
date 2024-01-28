// vite.config.ts
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [UnoCSS(), tsconfigPaths()],
})