import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Claude Code's worktree tooling nests worktrees under .claude/worktrees/
    // inside the repo (untracked, but still on disk). Without this exclude,
    // running the suite from the main checkout after a merge double-discovers
    // every test file from any nested worktree copy, each resolving `next`/
    // `react` from its own separate node_modules — a dual-React-instance
    // hazard that crashes any test using a hook.
    exclude: [...configDefaults.exclude, "**/.claude/**"],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
