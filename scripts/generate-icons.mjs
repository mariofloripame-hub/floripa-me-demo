// scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "fs/promises";

const SVG = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00E6C8"/>
      <stop offset="100%" stop-color="#00A8E0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="#0B1416"/>
  <circle cx="176" cy="176" r="150" fill="url(#g)" opacity="0.35"/>
  <text x="256" y="336" font-family="Georgia, serif" font-size="260" font-weight="800" fill="#00E6C8" text-anchor="middle">F</text>
</svg>`;

export async function generateIcons(outDir = "public/icons", sizes = [192, 512]) {
  await mkdir(outDir, { recursive: true });
  const written = [];
  for (const size of sizes) {
    const filePath = `${outDir}/icon-${size}.png`;
    await sharp(Buffer.from(SVG)).resize(size, size).png().toFile(filePath);
    written.push(filePath);
  }
  return written;
}

const isMain = process.argv[1] && process.argv[1].endsWith("generate-icons.mjs");
if (isMain) {
  generateIcons().then((files) => console.log("Generated:", files.join(", ")));
}
