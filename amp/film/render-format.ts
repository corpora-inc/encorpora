/** Resolution names use the short side: 2160p is 3840×2160, or its portrait rotation. */
export function renderFormat(resolution: number, tall = false) {
  if (![360, 540, 720, 1080, 1440, 2160].includes(resolution)) {
    throw new Error("--res must be 360, 540, 720, 1080, 1440 or 2160");
  }
  const width = tall ? 1080 : 1920, height = tall ? 1920 : 1080;
  const scale = resolution / 1080;
  return { width, height, scale, pixelWidth: Math.round(width * scale), pixelHeight: Math.round(height * scale) };
}
