import { defineConfig, presetIcons, presetUno } from 'unocss'

export default defineConfig({
    presets: [
        presetUno(),
        presetIcons({ autoInstall: true }),
    ],
    content: {
      pipeline: {
        include: [
          // the default
          /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
          // include js/ts files
          'src/**/*.{js,ts}',
        ],
      },
    },
})
