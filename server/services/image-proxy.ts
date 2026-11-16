import sharp from "sharp";
import { isBlockedImageHost, safeUrl } from "../lib/security.ts";
import { imageProxyQuerySchema } from "../schemas.ts";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16_777_216;

export function parseImageTarget(query: unknown): string | null {
  const parsed = imageProxyQuerySchema.safeParse(query);
  const target = parsed.success ? safeUrl(parsed.data.url) : null;

  if (!target || isBlockedImageHost(new URL(target).hostname)) {
    return null;
  }

  return target;
}

async function readLimitedBody(
  response: Response,
  limit: number,
): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length"));

  if (Number.isFinite(declared) && declared > limit) {
    throw new Error("TooLarge");
  }

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length > limit) throw new Error("TooLarge");

    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;
      if (!value) continue;

      received += value.byteLength;

      if (received > limit) {
        await reader.cancel();
        throw new Error("TooLarge");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
}

export async function fetchImageAsJpeg(target: string): Promise<Buffer> {
  const response = await fetch(target, {
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
    headers: { Accept: "image/*" },
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok || !contentType.toLowerCase().startsWith("image/")) {
    throw new Error("UpstreamRejected");
  }

  const bytes = await readLimitedBody(response, MAX_IMAGE_BYTES);
  const jpeg = await sharp(bytes, {
    limitInputPixels: MAX_IMAGE_PIXELS,
    animated: false,
  })
    .rotate()
    .jpeg({ quality: 82 })
    .toBuffer();

  if (jpeg.length > MAX_IMAGE_BYTES) {
    throw new Error("TooLarge");
  }

  return jpeg;
}
