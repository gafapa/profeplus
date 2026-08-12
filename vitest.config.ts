import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default defineConfig((configEnvironment) => {
  const baseConfig = typeof viteConfig === "function" ? viteConfig(configEnvironment) : viteConfig;
  return mergeConfig(baseConfig, {
    test: {
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.test.{ts,tsx}", "src/vite-env.d.ts"],
        thresholds: {
          statements: 17,
          branches: 15,
          functions: 13,
          lines: 18
        }
      }
    }
  });
});
