import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "docs", // This is the default, but you can change it to 'build', 'output', etc.
  },
  base: "/",
});
