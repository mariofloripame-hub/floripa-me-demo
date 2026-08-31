// scripts/generate-icons.test.mjs
import { describe, it, expect, afterAll } from "vitest";
import { rm, stat } from "fs/promises";
import { generateIcons } from "./generate-icons.mjs";

const OUT_DIR = "test-output/icons";

describe("generateIcons", () => {
  afterAll(async () => {
    await rm("test-output", { recursive: true, force: true });
  });

  it("writes a PNG file for each requested size", async () => {
    const files = await generateIcons(OUT_DIR, [64, 128]);
    expect(files).toEqual([`${OUT_DIR}/icon-64.png`, `${OUT_DIR}/icon-128.png`]);
    for (const file of files) {
      const stats = await stat(file);
      expect(stats.size).toBeGreaterThan(0);
    }
  });
});
