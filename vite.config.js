import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Built for older phones too: iOS 13+ Safari, Chrome/Samsung Internet on
// Android 7+, Firefox. Modern syntax is lowered; see src/polyfills.js.
export default defineConfig({
  plugins: [react()],
  build: {
    target: ["es2019", "safari13", "chrome70", "firefox70", "edge79"],
    cssTarget: ["safari13", "chrome70", "firefox70", "edge79"],
    rollupOptions: { output: { manualChunks: { three: ["three"], react: ["react", "react-dom"], icons: ["lucide-react"] } } },
  },
});
