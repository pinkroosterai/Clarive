import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === "production";
  const hasSentryUpload =
    isProd &&
    !!process.env.VITE_SENTRY_DSN &&
    !!process.env.SENTRY_AUTH_TOKEN;

  return {
    server: {
      host: "::",
      port: 8080,
      allowedHosts: ["dev.clarive.app"],
      hmr: {
        overlay: false,
      },
    },
    build: {
      sourcemap: isProd ? "hidden" : false,
    },
    plugins: [
      react(),
      hasSentryUpload &&
        sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          release: { name: process.env.VITE_SENTRY_RELEASE },
          sourcemaps: {
            filesToDeleteAfterUpload: "./dist/**/*.map",
          },
          telemetry: false,
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      include: ["diff", "@dnd-kit/core"],
    },
  };
});
