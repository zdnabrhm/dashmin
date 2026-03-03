import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@dashmin/admin": path.resolve(__dirname, "./src"),
      "@dashmin/db": path.resolve(__dirname, "../../packages/db/src"),
      "@dashmin/ui/style.css": path.resolve(__dirname, "../../packages/ui/dist/style.css"),
      "@dashmin/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
  envDir: "../../",
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
});
