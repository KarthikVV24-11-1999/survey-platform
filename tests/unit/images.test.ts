import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImage } from "@/server/media/images";

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 50, b: 50 } } });

describe("processImage", () => {
  it("re-encodes to WebP and strips EXIF metadata (e.g. GPS)", async () => {
    const withExif = await solid(64, 64)
      .jpeg()
      .withExif({ IFD0: { Make: "SecretCam", ImageDescription: "home address" } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const out = await processImage(withExif);
    const meta = await sharp(out.webp).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(out.preview.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(out.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("downscales large images", async () => {
    const big = await solid(4000, 1000).png().toBuffer();
    const out = await processImage(big);
    expect(out.width).toBe(2048);
    expect(out.height).toBe(512);
  });

  it("rejects SVG even though libvips can read it", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    await expect(processImage(svg)).rejects.toThrow(/JPEG, PNG/);
  });

  it("rejects files that are not images", async () => {
    await expect(processImage(Buffer.from("<html>not an image</html>"))).rejects.toThrow(/supported image/);
    await expect(processImage(Buffer.alloc(0))).rejects.toThrow(/empty/);
  });

  it("rejects files over 4 MB before decoding", async () => {
    await expect(processImage(Buffer.alloc(4 * 1024 * 1024 + 1))).rejects.toThrow(/4 MB/);
  });
});
