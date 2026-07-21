import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "github-pages",
  base: "/Life-Dashboard-AI/",
  publicDir: "../public",
  plugins: [react()],
  build: {
    outDir: "../gh-pages-dist",
    emptyOutDir: true,
  },
});
