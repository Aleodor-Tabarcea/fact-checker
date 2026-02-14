import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
  // The plugin handles the nasty Rollup chunking logic for us
  plugins: [viteSingleFile()],
  build: {
    target: "esnext",
    cssCodeSplit: false,
    brotliSize: false
    // We completely remove rollupOptions to let the plugin do its job
  },
})