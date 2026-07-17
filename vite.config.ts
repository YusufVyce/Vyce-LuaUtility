import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Özel Vite ayarlarını buraya ekliyoruz
  vite: {
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    // Gerekirse buraya başka Vite ayarları (proxy, define vb.) gelebilir
  },
});