import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Project-specific Vite overrides go here.
  vite: {
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    // Add further Vite config (proxy, define, etc.) here as needed.
  },
});