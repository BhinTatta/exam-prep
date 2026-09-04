/** Guard before even decoding the source file — keeps a huge upload from hanging the tab. */
export const MAX_AVATAR_SOURCE_BYTES = 20 * 1024 * 1024;

/** Server-side backstop. The client always produces something far smaller than this. */
export const MAX_AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024;

const AVATAR_OUTPUT_SIZE = 512;
const AVATAR_JPEG_QUALITY = 0.86;

export type PixelCrop = { x: number; y: number; width: number; height: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that image"));
    img.src = src;
  });
}

/**
 * Crops `imageSrc` to `pixelCrop` and re-encodes it as a downscaled square JPEG,
 * so every avatar upload comfortably fits under the server-side size limit
 * regardless of the source file's resolution.
 */
export async function cropImageToAvatar(imageSrc: string, pixelCrop: PixelCrop): Promise<Blob> {
  const image = await loadImage(imageSrc);
  // Never upscale a crop that's already smaller than the target — avoids
  // blowing up a low-res source into a blurry, needlessly large file.
  const size = Math.min(AVATAR_OUTPUT_SIZE, Math.round(pixelCrop.width));

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size,
  );

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", AVATAR_JPEG_QUALITY),
  );
  if (!blob) throw new Error("Couldn't process that image");
  return blob;
}
